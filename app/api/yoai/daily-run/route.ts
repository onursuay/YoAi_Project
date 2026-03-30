import { NextResponse } from 'next/server'
import { runDeepAnalysis } from '@/lib/yoai/deepAnalysis'
import { generateFullAutoProposals } from '@/lib/yoai/adCreator'
import { runFullCompetitorAnalysis } from '@/lib/yoai/competitorAnalyzer'
import { runStructuralAnalysis } from '@/lib/yoai/platformKnowledge'
import { fetchMetaDeep } from '@/lib/yoai/metaDeepFetcher'
import { fetchGoogleDeep } from '@/lib/yoai/googleDeepFetcher'
import {
  upsertDailyRun,
  isTodayCompleted,
  isRunning,
  getTurkeyDate,
  type DailyRun,
} from '@/lib/yoai/dailyRunStore'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/daily-run
   Scheduled daily analysis run.
   Called by cron at 10:00 Europe/Istanbul or manually.
   Produces command center data + ad proposals, persists to DB.
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    // Auth: get user ID from session
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_id')?.value

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
    }

    const today = getTurkeyDate()

    // Guard: already completed today
    if (await isTodayCompleted(userId)) {
      return NextResponse.json({ ok: true, message: 'Bugünün analizi zaten tamamlanmış', skipped: true })
    }

    // Guard: already running
    if (await isRunning(userId)) {
      return NextResponse.json({ ok: true, message: 'Analiz zaten çalışıyor', skipped: true })
    }

    // Mark as running
    await upsertDailyRun({
      user_id: userId,
      run_date: today,
      status: 'running',
      command_center_data: null,
      ad_proposals_data: null,
    })

    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ')
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // ── 1. Run command center analysis ──
    let commandCenterData = null
    try {
      commandCenterData = await runDeepAnalysis()
    } catch (e) {
      console.error('[DailyRun] Command center error:', e)
    }

    // ── 2. Run ad proposals for both platforms ──
    let adProposalsData: any = { metaProposals: [], googleProposals: [], summary: {} }
    try {
      const [metaResult, googleResult] = await Promise.all([
        fetchMetaDeep().catch(() => ({ campaigns: [], errors: [] })),
        fetchGoogleDeep().catch(() => ({ campaigns: [], errors: [] })),
      ])
      const allCampaigns = [...metaResult.campaigns, ...googleResult.campaigns]

      if (allCampaigns.length > 0) {
        const [competitorAnalysis, structuralAnalysis] = await Promise.all([
          runFullCompetitorAnalysis(allCampaigns, cookieHeader, baseUrl).catch(() => ({ userProfile: { keywords: [], themes: [], ctaTypes: [], formats: [], platforms: [], topPerformingAds: [], weakAds: [], avgCtr: 0, avgCpc: 0, totalSpend: 0, objectives: [], destinations: [], optimizationGoals: [], biddingStrategies: [], channelTypes: [] }, competitorAds: [], comparison: { competitorThemes: [], competitorCTAs: [], competitorFormats: [], gaps: [], competitorSummary: '' }, errors: [] })),
          Promise.resolve(runStructuralAnalysis(allCampaigns)),
        ])

        const platforms = [...new Set(allCampaigns.map(c => c.platform))] as ('Meta' | 'Google')[]
        const allProposals: any[] = []
        const allFitAnalyses: any[] = []
        let totalSummary = { totalCampaignsAnalyzed: 0, criticalIssues: 0, opportunities: 0, proposalsGenerated: 0, metaCount: 0, googleCount: 0 }

        for (const platform of platforms) {
          try {
            const result = await generateFullAutoProposals(
              platform,
              competitorAnalysis.userProfile,
              competitorAnalysis.comparison,
              competitorAnalysis.competitorAds,
              allCampaigns,
              structuralAnalysis.issues,
            )
            allProposals.push(...result.proposals)
            allFitAnalyses.push(...result.fitAnalyses)
            totalSummary.totalCampaignsAnalyzed += result.summary.totalCampaignsAnalyzed
            totalSummary.criticalIssues += result.summary.criticalIssues
            totalSummary.opportunities += result.summary.opportunities
            totalSummary.proposalsGenerated += result.summary.proposalsGenerated
            totalSummary.metaCount += result.summary.metaCount
            totalSummary.googleCount += result.summary.googleCount
          } catch (e) {
            console.error(`[DailyRun] ${platform} proposals error:`, e)
          }
        }

        adProposalsData = { proposals: allProposals, fitAnalyses: allFitAnalyses, summary: totalSummary }
      }
    } catch (e) {
      console.error('[DailyRun] Ad proposals error:', e)
    }

    // ── 3. Persist completed run ──
    const savedRun = await upsertDailyRun({
      user_id: userId,
      run_date: today,
      status: 'completed',
      command_center_data: commandCenterData,
      ad_proposals_data: adProposalsData,
    })

    return NextResponse.json({
      ok: true,
      message: 'Günlük analiz tamamlandı',
      run_date: today,
      proposals_count: adProposalsData.proposals?.length || 0,
    })
  } catch (error) {
    console.error('[DailyRun] Fatal error:', error)

    // Try to mark as failed
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const userId = cookieStore.get('session_id')?.value
      if (userId) {
        await upsertDailyRun({
          user_id: userId,
          run_date: getTurkeyDate(),
          status: 'failed',
          command_center_data: null,
          ad_proposals_data: null,
          error_message: error instanceof Error ? error.message : 'Bilinmeyen hata',
        })
      }
    } catch {}

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
