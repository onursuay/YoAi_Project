/* ──────────────────────────────────────────────────────────
   Inngest Function: yoalgoritma/scan.user

   Tek kullanıcı için durable AI engine taraması — Anthropic
   Message Batches API üzerinden async.

   Akış (step.run idempotent durable):
     1. fetch     — Meta + Google deep data
     2. submit    — her platform için bir request içeren batch oluştur
     3. poll      — batch processing_status='ended' olana kadar bekle
                    (step.sleep 60s × max 24h; Anthropic SLA)
     4. retrieve  — batch results stream'i topla
     5. persist   — ai_engine_runs + child tablolar + daily-run

   Concurrency: 5  — aynı anda en fazla 5 user batch yönetilir.
                     (Inngest Free plan eşzamanlılık tavanı 5; plan yükseltilirse
                      bu değer artırılabilir.)
   Retries: 2  — Inngest-level retry; idempotent persist (upsert).
   ────────────────────────────────────────────────────────── */

import { inngest } from '../client'
import { getAnthropicClient } from '@/lib/anthropic/client'
import { buildBatchRequestParams, parseBatchResult } from '@/lib/yoai/ai/agent'
import {
  gatherUserScanInputs,
  scanContextFromFetched,
  persistAccountAndDailyRun,
  writeFailedRun,
} from '@/lib/yoai/ai/scanUser'
import type { AiEngineResult, AiPlatform } from '@/lib/yoai/ai/types'

const POLL_INTERVAL = '60s'
const MAX_POLLS = 1440  // 60s × 1440 ≈ 24h (Anthropic batch SLA üst sınırı)

export const yoalgoritmaScanUser = inngest.createFunction(
  {
    id: 'yoalgoritma-scan-user',
    name: 'YoAlgoritma — Per-User AI Scan (Batch)',
    concurrency: { limit: 5 },
    retries: 2,
    triggers: [{ event: 'yoalgoritma/scan.user' }],
  },
  async ({ event, step, logger }) => {
    const userId = String(event.data?.userId ?? '')
    if (!userId) throw new Error('userId zorunlu')

    // 1) Fetch user campaign data
    const scanInputs = await step.run('fetch-user-data', async () => {
      return await gatherUserScanInputs(userId)
    })

    const metaCtx = scanContextFromFetched(scanInputs.meta, scanInputs.industry)
    const googleCtx = scanContextFromFetched(scanInputs.google, scanInputs.industry)

    if (!metaCtx && !googleCtx) {
      logger.info(`[scan.user] ${userId}: tarama yapılacak hesap yok`)
      return { userId, skipped: true, reason: 'no-active-account' }
    }

    // 2) Build batch requests — her platform için bir entry
    const requestEntries: Array<{ custom_id: string; platform: AiPlatform; accountId: string }> = []
    const batchRequests: Array<{ custom_id: string; params: any }> = []

    for (const ctx of [metaCtx, googleCtx]) {
      if (!ctx) continue
      const customId = `${userId}|${ctx.platform}|${ctx.accountId}`.slice(0, 64)
      const params = buildBatchRequestParams({ ctx, industry: scanInputs.industry, businessContext: scanInputs.businessContext })
      requestEntries.push({ custom_id: customId, platform: ctx.platform, accountId: ctx.accountId })
      batchRequests.push({ custom_id: customId, params })
    }

    // 3) Submit batch
    const batch = await step.run('submit-batch', async () => {
      const client = getAnthropicClient()
      const b = await client.messages.batches.create({ requests: batchRequests as any })
      return { id: b.id, processing_status: b.processing_status }
    })

    logger.info(`[scan.user] ${userId}: batch submitted id=${batch.id}`)

    // 4) Poll until ended
    let endedStatus: { id: string; processing_status: string } | null = null
    for (let i = 0; i < MAX_POLLS; i++) {
      await step.sleep(`wait-poll-${i}`, POLL_INTERVAL)
      const status = await step.run(`poll-${i}`, async () => {
        const client = getAnthropicClient()
        const b = await client.messages.batches.retrieve(batch.id)
        return { id: b.id, processing_status: b.processing_status }
      })
      if (status.processing_status === 'ended') {
        endedStatus = status
        break
      }
    }

    if (!endedStatus) {
      // 24h içinde bitmedi — Anthropic genelde bitirir, bu noktada anomali
      for (const e of requestEntries) {
        await writeFailedRun(userId, e.platform, e.accountId, 'Batch 24 saatte tamamlanamadı (SLA aşımı)')
      }
      throw new Error(`Batch ${batch.id} 24h içinde tamamlanmadı`)
    }

    // 5) Retrieve results
    const batchResults = await step.run('retrieve-results', async () => {
      const client = getAnthropicClient()
      const stream = await client.messages.batches.results(batch.id)
      const collected: Array<{ custom_id: string; result: any }> = []
      for await (const r of stream) {
        collected.push({ custom_id: r.custom_id, result: r.result })
      }
      return collected
    })

    // 6) Process + persist each result
    const aiResults: Array<{ platform: AiPlatform; accountId: string; aiResult: AiEngineResult }> = []
    for (const entry of requestEntries) {
      const found = batchResults.find(r => r.custom_id === entry.custom_id)
      if (!found) {
        await writeFailedRun(userId, entry.platform, entry.accountId, 'Batch sonucunda custom_id bulunamadı')
        continue
      }
      const result = found.result
      if (result.type !== 'succeeded') {
        const errMsg = result.type === 'errored'
          ? `Batch errored: ${JSON.stringify(result.error?.error ?? result.error).slice(0, 500)}`
          : `Batch ${result.type}`
        await writeFailedRun(userId, entry.platform, entry.accountId, errMsg)
        continue
      }
      const message = result.message
      const params = batchRequests.find(b => b.custom_id === entry.custom_id)?.params
      const model = params?.model ?? 'unknown'
      const aiResult = parseBatchResult(message, model, 0)
      aiResults.push({ platform: entry.platform, accountId: entry.accountId, aiResult })
    }

    if (aiResults.length === 0) {
      return { userId, batchId: batch.id, completed: 0 }
    }

    const persistOut = await step.run('persist-results', async () => {
      return await persistAccountAndDailyRun({ userId, scanInputs, results: aiResults })
    })

    return {
      userId,
      batchId: batch.id,
      completed: aiResults.length,
      totalAlerts: persistOut.totalAlerts,
      totalOpportunities: persistOut.totalOpportunities,
      totalSuggestions: persistOut.totalSuggestions,
    }
  },
)
