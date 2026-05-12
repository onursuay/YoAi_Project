import { NextResponse } from 'next/server'
import { runOfficialAdsDocsRefresh } from '@/lib/yoai/officialAdsDocsRefresh'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/* ────────────────────────────────────────────────────────────
   GET /api/cron/official-ads-refresh
   Called by Vercel Cron (schedule: "0 6 1 * *" = her ayın 1'i 06:00 UTC / ~09:00 Türkiye).
   Manuel test: GET ile Authorization: Bearer <CRON_SECRET> veya ?secret=...
   ──────────────────────────────────────────────────────────── */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const urlSecret = new URL(request.url).searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!cronSecret && isProduction) {
    console.error('[OfficialAdsRefresh] CRON_SECRET yapılandırılmamış — production isteği reddedildi')
    return NextResponse.json({ ok: false, error: 'Cron not configured' }, { status: 503 })
  }
  if (cronSecret) {
    const authorized =
      authHeader === `Bearer ${cronSecret}` || urlSecret === cronSecret
    if (!authorized) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const { supabase } = await import('@/lib/supabase/client')
    if (!supabase) {
      return NextResponse.json({ ok: false, error: 'Database not configured' }, { status: 500 })
    }

    const startedAt = new Date().toISOString()

    // Open refresh run record
    const { data: runData } = await supabase
      .from('official_ads_refresh_runs')
      .insert({ started_at: startedAt, status: 'running', created_at: startedAt })
      .select('id')
      .single()

    const runId: string | null = runData?.id ?? null

    try {
      const result = await runOfficialAdsDocsRefresh(supabase)
      const completedAt = new Date().toISOString()

      let runStatus: 'success' | 'partial' | 'failed' = 'success'
      if (result.failedSources > 0 && result.checkedSources > 0) {
        runStatus =
          result.failedSources === result.checkedSources ? 'failed' : 'partial'
      }

      if (runId) {
        await supabase
          .from('official_ads_refresh_runs')
          .update({
            completed_at: completedAt,
            status: runStatus,
            checked_sources: result.checkedSources,
            changed_sources: result.changedSources,
            failed_sources: result.failedSources,
            review_required_count: result.reviewRequiredCount,
            summary_json: { changed: result.changed, failed: result.failed },
          })
          .eq('id', runId)
      }

      return NextResponse.json({
        ok: true,
        runId,
        checkedSources: result.checkedSources,
        changedSources: result.changedSources,
        failedSources: result.failedSources,
        reviewRequiredCount: result.reviewRequiredCount,
        changed: result.changed,
        failed: result.failed,
      })
    } catch (innerErr) {
      const completedAt = new Date().toISOString()
      if (runId) {
        try {
          await supabase
            .from('official_ads_refresh_runs')
            .update({
              completed_at: completedAt,
              status: 'failed',
              summary_json: { error: String(innerErr) },
            })
            .eq('id', runId)
        } catch {}
      }
      throw innerErr
    }
  } catch (error) {
    console.error('[OfficialAdsRefresh] Hata:', error)
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
