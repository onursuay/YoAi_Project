/* ──────────────────────────────────────────────────────────
   YoAi — Resmi Reklam Doküman Taraması Orkestrasyonu

   official_ads_refresh_runs kaydı aç/kapat + owner bildirim.
   Hem Inngest (kaynak-başına step) hem inline (dev) akışı paylaşır.
   ────────────────────────────────────────────────────────── */

import { runOfficialAdsDocsRefresh, type RefreshResult } from './officialAdsDocsRefresh'
import { notifyOwnerOfficialAdsChanges } from './officialAdsChangeNotifier'

export async function openRefreshRun(supabase: any): Promise<string | null> {
  const startedAt = new Date().toISOString()
  try {
    const { data } = await supabase
      .from('official_ads_refresh_runs')
      .insert({ started_at: startedAt, status: 'running', created_at: startedAt })
      .select('id')
      .single()
    return data?.id ?? null
  } catch {
    return null
  }
}

export function refreshRunStatus(result: RefreshResult): 'success' | 'partial' | 'failed' {
  if (result.failedSources > 0 && result.checkedSources > 0) {
    return result.failedSources === result.checkedSources ? 'failed' : 'partial'
  }
  return 'success'
}

export async function closeRefreshRun(
  supabase: any,
  runId: string | null,
  result: RefreshResult,
): Promise<void> {
  if (!runId) return
  try {
    await supabase
      .from('official_ads_refresh_runs')
      .update({
        completed_at: new Date().toISOString(),
        status: refreshRunStatus(result),
        checked_sources: result.checkedSources,
        changed_sources: result.changedSources,
        failed_sources: result.failedSources,
        review_required_count: result.reviewRequiredCount,
        summary_json: { changed: result.changed, failed: result.failed, createdDrafts: result.createdDrafts },
      })
      .eq('id', runId)
  } catch {
    /* best-effort */
  }
}

export async function notifyRefresh(result: RefreshResult): Promise<boolean> {
  try {
    const n = await notifyOwnerOfficialAdsChanges(result)
    return n.sent
  } catch {
    return false
  }
}

/** İnline (dev) tam akış: run kaydı aç → tara → kapat → bildir.
   Üretimde bu iş Inngest'e taşınır (kaynak-başına step, timeout yok). */
export async function runAndRecordOfficialAdsRefresh(
  supabase: any,
): Promise<{ runId: string | null; result: RefreshResult; notified: boolean }> {
  const runId = await openRefreshRun(supabase)
  const result = await runOfficialAdsDocsRefresh(supabase)
  await closeRefreshRun(supabase, runId, result)
  const notified = await notifyRefresh(result)
  return { runId, result, notified }
}
