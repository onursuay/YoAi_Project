import { NextResponse } from 'next/server'
import { isInngestReady, inngest } from '@/inngest/client'
import { runAndRecordOfficialAdsRefresh } from '@/lib/yoai/officialAdsRefreshRunner'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/* ────────────────────────────────────────────────────────────
   GET /api/cron/official-ads-refresh
   Vercel Cron (schedule: "0 6 1 * *" = her ayın 1'i 06:00 UTC) veya manuel.
   Manuel test: ?secret=<CRON_SECRET> veya Authorization: Bearer <CRON_SECRET>

   Ağır iş (Firecrawl + AI parser × N kaynak) Inngest'e taşınır — her kaynak
   ayrı step (ayrı invocation), serverless 60/120s timeout'a takılmaz.
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
    const authorized = authHeader === `Bearer ${cronSecret}` || urlSecret === cronSecret
    if (!authorized) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    // Üretim yolu: Inngest hazırsa arka plana gönder ve hemen dön (timeout yok).
    if (isInngestReady()) {
      await inngest.send({ name: 'official-ads/refresh', data: {} })
      return NextResponse.json({
        ok: true,
        mode: 'inngest',
        message:
          'Resmi doküman taraması arka planda başlatıldı. Sonuçlar: Gözetim Merkezi → Resmi Döküman Güncellemeleri.',
      })
    }

    // Dev/inline fallback (Inngest yoksa) — küçük hacimde senkron çalışır.
    const { supabase } = await import('@/lib/supabase/client')
    if (!supabase) {
      return NextResponse.json({ ok: false, error: 'Database not configured' }, { status: 500 })
    }
    const outcome = await runAndRecordOfficialAdsRefresh(supabase)
    return NextResponse.json({
      ok: true,
      mode: 'inline',
      runId: outcome.runId,
      checkedSources: outcome.result.checkedSources,
      changedSources: outcome.result.changedSources,
      failedSources: outcome.result.failedSources,
      reviewRequiredCount: outcome.result.reviewRequiredCount,
      createdDrafts: outcome.result.createdDrafts,
      notified: outcome.notified,
      changed: outcome.result.changed,
      failed: outcome.result.failed,
    })
  } catch (error) {
    console.error('[OfficialAdsRefresh] Hata:', error)
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
