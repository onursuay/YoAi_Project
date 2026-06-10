/* ──────────────────────────────────────────────────────────
   Inngest Function: official-ads/refresh

   Resmi Meta/Google dokümanlarını ARKA PLANDA tarar (aylık cron veya
   admin on-demand). Her KAYNAK ayrı bir step.run — her step ayrı Vercel
   invocation'ı (≤ maxDuration), Inngest aralarında durability sağlar.
   Böylece 10+ kaynak × (Firecrawl + AI parser) iş, senkron HTTP 60/120s
   limitine takılmadan tamamlanır (önceki 504 GATEWAY_TIMEOUT fix).

   Concurrency 1: aynı anda tek tarama (mükerrer snapshot önlenir).
   ────────────────────────────────────────────────────────── */

import { inngest } from '../client'
import {
  loadRefreshSources,
  refreshSingleSource,
  resolveRefreshDeps,
  applySourceOutcome,
  type RefreshResult,
} from '@/lib/yoai/officialAdsDocsRefresh'
import { openRefreshRun, closeRefreshRun, notifyRefresh } from '@/lib/yoai/officialAdsRefreshRunner'

export const officialAdsRefresh = inngest.createFunction(
  {
    id: 'official-ads-refresh',
    name: 'Resmi reklam dokümanı taraması',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'official-ads/refresh' }],
  },
  async ({ step, logger }) => {
    const { supabase } = await import('@/lib/supabase/client')
    if (!supabase) {
      logger.error('[official-ads/refresh] supabase yapılandırılmamış')
      return { ok: false, error: 'supabase_unavailable' }
    }

    const runId = await step.run('open-run', async () => openRefreshRun(supabase))
    const sources = await step.run('load-sources', async () => loadRefreshSources(supabase))

    const deps = resolveRefreshDeps(supabase)
    const result: RefreshResult = {
      checkedSources: 0,
      changedSources: 0,
      failedSources: 0,
      reviewRequiredCount: 0,
      createdDrafts: 0,
      changed: [],
      failed: [],
    }

    // Kaynak-başına step → her biri ayrı invocation, timeout riski yok
    for (const source of sources) {
      result.checkedSources++
      const outcome = await step.run(`source:${source.id}`, async () =>
        refreshSingleSource(supabase, source, deps),
      )
      applySourceOutcome(result, outcome)
    }

    await step.run('close-run', async () => {
      await closeRefreshRun(supabase, runId, result)
      return { ok: true }
    })
    await step.run('notify', async () => ({ notified: await notifyRefresh(result) }))

    logger.info(
      `[official-ads/refresh] checked=${result.checkedSources} changed=${result.changedSources} drafts=${result.createdDrafts} reviewReq=${result.reviewRequiredCount}`,
    )
    return {
      ok: true,
      checkedSources: result.checkedSources,
      changedSources: result.changedSources,
      createdDrafts: result.createdDrafts,
      reviewRequiredCount: result.reviewRequiredCount,
    }
  },
)
