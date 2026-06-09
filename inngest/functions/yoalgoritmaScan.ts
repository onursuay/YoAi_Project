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
import { officialKnowledgeBlock } from '@/lib/yoai/ai/docs/officialKnowledgeBlock'
import {
  gatherUserScanInputs,
  scanContextFromFetched,
  persistAccountAndDailyRun,
  writeFailedRun,
} from '@/lib/yoai/ai/scanUser'
import { scrapeDeclaredCompetitors } from '@/lib/yoai/ai/competitorScanStep'
import type { AiEngineResult, AiPlatform } from '@/lib/yoai/ai/types'
import type { YoaiScope } from '@/lib/yoai/businessScope'

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
    // Çoklu işletme (Faz 1): cron fan-out scope'u event.data'ya gömer (headless).
    // scope yoksa → mevcut birleşik davranış (sıfır regresyon).
    const scope = (event.data?.scope ?? undefined) as YoaiScope | undefined

    // 0) Rakip scrape (A4) — YOALGORITMA_SCRAPE_COMPETITORS=true ise beyan
    //    edilen rakipleri Apify ile tarar (7g cache, max 3 rakip). Flag kapalıysa
    //    no-op. Soft-fail: scrape hatası taramayı ASLA bozmaz. fetch'ten ÖNCE
    //    çalışır ki cache'lenmiş rakip verisi payload okumasına yansısın.
    const scrapeSummary = await step.run('scrape-competitors', async () => {
      try {
        return await scrapeDeclaredCompetitors(userId)
      } catch (e) {
        logger.warn(`[scan.user] ${userId}: competitor scrape soft-fail: ${e instanceof Error ? e.message : e}`)
        return { enabled: false, reason: 'exception', attempted: 0, scraped: 0, cachedSkipped: 0, errors: 1 }
      }
    })
    if (scrapeSummary.enabled) {
      logger.info(`[scan.user] ${userId}: competitor scrape — scraped=${scrapeSummary.scraped} cached=${scrapeSummary.cachedSkipped} errors=${scrapeSummary.errors}`)
    }

    // 1) Fetch user campaign data (+ business context + rakip analizi)
    //    scope varsa yalnız o işletmenin Meta+Google hesabı/profili
    const scanInputs = await step.run('fetch-user-data', async () => {
      return await gatherUserScanInputs(userId, scope)
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
      // Anthropic Batch API custom_id pattern: ^[a-zA-Z0-9_-]{1,64}$ — pipe/dot/colon yasak
      const rawCustomId = `${userId}_${ctx.platform}_${ctx.accountId}`.replace(/[^a-zA-Z0-9_-]/g, '_')
      const customId = rawCustomId.slice(0, 64)
      const competitorContext =
        ctx.platform === 'Meta' ? scanInputs.competitorContext.meta : scanInputs.competitorContext.google
      // Onaylı resmi bilgi bloğu (alt-proje B) — empty-safe; yoksa eklenmez
      const kb = await officialKnowledgeBlock(ctx.platform)
      const params = buildBatchRequestParams(
        {
          ctx,
          industry: scanInputs.industry,
          businessContext: scanInputs.businessContext,
          competitorContext,
        },
        kb ? [kb] : undefined,
      )
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
