import { NextResponse } from 'next/server'
import { isAiEngineEnabled } from '@/lib/yoai/featureFlag'
import { isAnthropicReady } from '@/lib/anthropic/client'
import { isInngestReady, inngest } from '@/inngest/client'
import { scanUserWithAiEngine } from '@/lib/yoai/ai/scanUser'
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
import { diagnoseCampaigns } from '@/lib/yoai/meta/diagnosis'
import { decideForDiagnoses } from '@/lib/yoai/meta/decision'
import {
  runDailyActiveCampaignIntelligence,
  applyStaleCleanup,
  loadActionableApprovals,
  type DailyIntelligenceScanSummary,
} from '@/lib/yoai/dailyActiveCampaignIntelligence'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // allow up to 5 minutes for full analysis (multi-platform, batched AI calls)

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/daily-run
   Called by Vercel Cron (schedule: "0 5 * * *" = 08:00 Istanbul).
   Runs daily analysis for all active users with connections.
   ──────────────────────────────────────────────────────────── */
export async function GET(request: Request) {
  // Verify cron secret (Vercel sends Authorization: Bearer <CRON_SECRET>)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!cronSecret && isProduction) {
    console.error('[DailyRun Cron] CRON_SECRET not configured — refusing request in production')
    return NextResponse.json({ ok: false, error: 'Cron not configured' }, { status: 503 })
  }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Faz 2: AI engine açıksa eski rule-engine cron'u no-op'a düşer.
  // Aynı işi /api/cron/yoalgoritma-scan yapıyor — çakışmayı önle.
  if (isAiEngineEnabled() && isAnthropicReady()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'USE_AI_ENGINE=true — AI engine handles via /api/cron/yoalgoritma-scan',
    })
  }

  try {
    const { supabase } = await import('@/lib/supabase/client')
    if (!supabase) {
      return NextResponse.json({ ok: false, error: 'Database not configured' }, { status: 500 })
    }

    // Find all users with Meta or Google connections
    const userIds = new Set<string>()

    const { data: metaConns } = await supabase
      .from('meta_connections')
      .select('user_id')
      .eq('status', 'active')

    const { data: googleConns } = await supabase
      .from('google_ads_connections')
      .select('user_id')
      .eq('status', 'active')

    metaConns?.forEach((c: any) => { if (c.user_id) userIds.add(c.user_id) })
    googleConns?.forEach((c: any) => { if (c.user_id) userIds.add(c.user_id) })

    if (userIds.size === 0) {
      return NextResponse.json({ ok: true, message: 'Aktif kullanıcı yok', users: 0 })
    }

    // Run for each user
    const today = getTurkeyDate()
    let completed = 0
    let skipped = 0
    let failed = 0

    // Cron-level aggregate diagnostics
    const runSummary = {
      scannedUsers: 0,
      activeCampaignsScanned: { Meta: 0, Google: 0 },
      proposalsCreated: 0,
      proposalsMarkedStale: 0,
      proposalsReviewRequired: 0,
      intentRefreshCount: 0,
      competitorRefreshCount: 0,
      errors: [] as string[],
    }

    for (const userId of userIds) {
      try {
        if (await isTodayCompleted(userId)) { skipped++; continue }
        if (await isRunning(userId)) { skipped++; continue }

        runSummary.scannedUsers++

        // Mark running
        await upsertDailyRun({ user_id: userId, run_date: today, status: 'running', command_center_data: null, ad_proposals_data: null })

        // Run analysis — pass userId so fetchers can resolve credentials from DB (no cookies in cron)
        const commandCenterData = await runDeepAnalysis(userId).catch(() => null)

        // Run proposals
        let adProposalsData: any = { proposals: [], fitAnalyses: [], summary: {} }
        let intelligenceSummary: DailyIntelligenceScanSummary | null = null
        try {
          const [metaResult, googleResult] = await Promise.all([
            fetchMetaDeep(userId).catch(() => ({ campaigns: [] as any[], errors: [], connected: false })),
            fetchGoogleDeep(userId).catch(() => ({ campaigns: [] as any[], errors: [], connected: false })),
          ])
          const allCampaigns = [...metaResult.campaigns, ...googleResult.campaigns]

          // Track scanned campaign counts
          runSummary.activeCampaignsScanned.Meta += metaResult.campaigns.length
          runSummary.activeCampaignsScanned.Google += googleResult.campaigns.length

          if (allCampaigns.length > 0) {
            // ── Active Campaign Intelligence Scan ──
            let staleCount = 0
            try {
              const existingApprovals = await loadActionableApprovals(userId)
              if (existingApprovals.length > 0) {
                const scanResult = runDailyActiveCampaignIntelligence(allCampaigns as any, existingApprovals)
                intelligenceSummary = scanResult.summary
                if (scanResult.proposalsToMarkStale.length > 0) {
                  staleCount = await applyStaleCleanup(userId, scanResult.proposalsToMarkStale)
                  runSummary.proposalsMarkedStale += staleCount
                }
                runSummary.proposalsReviewRequired += scanResult.proposalsToMarkNeedsReview.length
                console.log(
                  `[DailyRun][Intelligence] User ${userId}: ${existingApprovals.length} scanned, ` +
                  `${staleCount} stale, ${scanResult.proposalsToKeep.length} kept, ` +
                  `${scanResult.campaignsNeedingUpdate.length} campaigns need update`,
                )
              }
            } catch (e) {
              console.error(`[DailyRun][Intelligence] User ${userId} scan error (non-fatal):`, e)
            }

            const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
            const competitorAnalysis = await runFullCompetitorAnalysis(allCampaigns, '', baseUrl).catch(() => ({
              userProfile: { keywords: [], themes: [], ctaTypes: [], formats: [], platforms: [], topPerformingAds: [], weakAds: [], avgCtr: 0, avgCpc: 0, totalSpend: 0, objectives: [], destinations: [], optimizationGoals: [], biddingStrategies: [], channelTypes: [] },
              competitorAds: [], comparison: { competitorThemes: [], competitorCTAs: [], competitorFormats: [], gaps: [], competitorSummary: '' }, errors: [],
            }))
            runSummary.competitorRefreshCount++

            const structuralAnalysis = runStructuralAnalysis(allCampaigns)
            const platforms = [...new Set(allCampaigns.map(c => c.platform))] as ('Meta' | 'Google')[]
            const allProposals: any[] = []
            const allFitAnalyses: any[] = []
            const totalSummary = { totalCampaignsAnalyzed: 0, criticalIssues: 0, opportunities: 0, proposalsGenerated: 0, metaCount: 0, googleCount: 0 }
            for (const platform of platforms) {
              try {
                const r = await generateFullAutoProposals(platform, competitorAnalysis.userProfile, competitorAnalysis.comparison, competitorAnalysis.competitorAds, allCampaigns, structuralAnalysis.issues)
                allProposals.push(...r.proposals); allFitAnalyses.push(...r.fitAnalyses)
                totalSummary.totalCampaignsAnalyzed += r.summary.totalCampaignsAnalyzed; totalSummary.criticalIssues += r.summary.criticalIssues
                totalSummary.opportunities += r.summary.opportunities; totalSummary.proposalsGenerated += r.summary.proposalsGenerated
                totalSummary.metaCount += r.summary.metaCount; totalSummary.googleCount += r.summary.googleCount
                runSummary.proposalsCreated += r.proposals.length
              } catch {}
            }
            runSummary.intentRefreshCount++

            // Diagnosis + decision attach (sadece Meta, mevcut akışı bozmaz)
            let diagnoses: any[] = []
            let decisions: any[] = []
            try {
              diagnoses = diagnoseCampaigns(allCampaigns)
              decisions = decideForDiagnoses(diagnoses)
            } catch {}
            adProposalsData = {
              proposals: allProposals,
              fitAnalyses: allFitAnalyses,
              summary: totalSummary,
              diagnoses,
              decisions,
              intelligenceScan: intelligenceSummary,
            }
          }
        } catch {}

        await upsertDailyRun({ user_id: userId, run_date: today, status: 'completed', command_center_data: commandCenterData, ad_proposals_data: adProposalsData })
        completed++
      } catch (e) {
        console.error(`[DailyRun] User ${userId} failed:`, e)
        runSummary.errors.push(`User ${userId}: ${String(e)}`)
        await upsertDailyRun({ user_id: userId, run_date: today, status: 'failed', command_center_data: null, ad_proposals_data: null, error_message: String(e) }).catch(() => {})
        failed++
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Günlük analiz tamamlandı',
      date: today,
      users: userIds.size,
      completed,
      skipped,
      failed,
      runSummary,
    })
  } catch (error) {
    console.error('[DailyRun Cron] Error:', error)
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/daily-run
   Manual trigger for a single user (from UI or testing).
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    // Auth: get user ID from session
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
    }

    // Faz 2: AI engine açıksa manuel bootstrap çağrısını AI engine'e yönlendir.
    if (isAiEngineEnabled() && isAnthropicReady()) {
      if (isInngestReady()) {
        await inngest.send({ name: 'yoalgoritma/scan.user', data: { userId } })
        return NextResponse.json({ ok: true, mode: 'ai_engine_inngest', userId })
      }
      try {
        const result = await scanUserWithAiEngine(userId)
        return NextResponse.json({ ok: true, mode: 'ai_engine_inline', result })
      } catch (e) {
        return NextResponse.json(
          { ok: false, error: e instanceof Error ? e.message : String(e) },
          { status: 500 },
        )
      }
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
    let intelligenceSummary: DailyIntelligenceScanSummary | null = null
    try {
      const [metaResult, googleResult] = await Promise.all([
        fetchMetaDeep().catch(() => ({ campaigns: [] as any[], errors: [], connected: false })),
        fetchGoogleDeep().catch(() => ({ campaigns: [] as any[], errors: [], connected: false })),
      ])
      const allCampaigns = [...metaResult.campaigns, ...googleResult.campaigns]

      if (allCampaigns.length > 0) {
        // ── Active Campaign Intelligence Scan ──
        try {
          const existingApprovals = await loadActionableApprovals(userId)
          if (existingApprovals.length > 0) {
            const scanResult = runDailyActiveCampaignIntelligence(allCampaigns as any, existingApprovals)
            intelligenceSummary = scanResult.summary
            if (scanResult.proposalsToMarkStale.length > 0) {
              const staleCount = await applyStaleCleanup(userId, scanResult.proposalsToMarkStale)
              console.log(`[DailyRun][POST] Intelligence: ${staleCount} öneri stale yapıldı.`)
            }
          }
        } catch (e) {
          console.error('[DailyRun][POST] Intelligence scan error (non-fatal):', e)
        }

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

        // Diagnosis + decision attach (sadece Meta, mevcut akışı bozmaz)
        let diagnoses: any[] = []
        let decisions: any[] = []
        try {
          diagnoses = diagnoseCampaigns(allCampaigns)
          decisions = decideForDiagnoses(diagnoses)
        } catch {}
        adProposalsData = {
          proposals: allProposals,
          fitAnalyses: allFitAnalyses,
          summary: totalSummary,
          diagnoses,
          decisions,
          intelligenceScan: intelligenceSummary,
        }
      }
    } catch (e) {
      console.error('[DailyRun] Ad proposals error:', e)
    }

    // ── 3. Persist completed run ──
    await upsertDailyRun({
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
      intelligenceScan: intelligenceSummary,
    })
  } catch (error) {
    console.error('[DailyRun] Fatal error:', error)

    // Try to mark as failed
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const userId = cookieStore.get('user_id')?.value
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
