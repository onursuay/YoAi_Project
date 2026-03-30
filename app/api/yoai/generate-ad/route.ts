import { NextResponse } from 'next/server'
import { generateFullAutoProposals } from '@/lib/yoai/adCreator'
import { runFullCompetitorAnalysis } from '@/lib/yoai/competitorAnalyzer'
import { runStructuralAnalysis } from '@/lib/yoai/platformKnowledge'
import { fetchMetaDeep } from '@/lib/yoai/metaDeepFetcher'
import { fetchGoogleDeep } from '@/lib/yoai/googleDeepFetcher'
import { getBestAvailableRun } from '@/lib/yoai/dailyRunStore'
import type { Platform } from '@/lib/yoai/analysisTypes'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/generate-ad
   Accepts { platform } or { platforms: ["Meta","Google"] }.
   Reads persisted → falls back to live generation.
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { platform, platforms, forceGenerate } = body as {
      platform?: Platform
      platforms?: Platform[]
      forceGenerate?: boolean
    }

    // Support both single platform and multi-platform
    const targetPlatforms: Platform[] = platforms || (platform ? [platform] : [])
    if (targetPlatforms.length === 0) {
      return NextResponse.json({ ok: false, error: 'Platform gerekli' }, { status: 400 })
    }

    // 1. Try persisted data
    if (!forceGenerate) {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const userId = cookieStore.get('session_id')?.value

      if (userId) {
        const run = await getBestAvailableRun(userId)

        if (run?.ad_proposals_data?.proposals) {
          const allProposals = run.ad_proposals_data.proposals
          const filtered = allProposals.filter((p: any) => targetPlatforms.includes(p.platform))

          if (filtered.length > 0) {
            return NextResponse.json({
              ok: true,
              data: {
                proposals: filtered,
                fitAnalyses: (run.ad_proposals_data.fitAnalyses || []).filter((fa: any) => targetPlatforms.includes(fa.platform)),
                summary: run.ad_proposals_data.summary || {},
              },
              persisted: true,
              run_date: run.run_date,
            })
          }
        }
      }
    }

    // 2. Live generation
    const cookieHeader = request.headers.get('cookie') || ''
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    const [metaResult, googleResult] = await Promise.all([
      fetchMetaDeep().catch(() => ({ campaigns: [], errors: [] })),
      fetchGoogleDeep().catch(() => ({ campaigns: [], errors: [] })),
    ])
    const allCampaigns = [...metaResult.campaigns, ...googleResult.campaigns]

    if (allCampaigns.length === 0) {
      return NextResponse.json({ ok: false, error: 'Analiz edilecek kampanya bulunamadı' }, { status: 404 })
    }

    const [competitorAnalysis, structuralAnalysis] = await Promise.all([
      runFullCompetitorAnalysis(allCampaigns, cookieHeader, baseUrl).catch(() => ({
        userProfile: { keywords: [], themes: [], ctaTypes: [], formats: [], platforms: [], topPerformingAds: [], weakAds: [], avgCtr: 0, avgCpc: 0, totalSpend: 0, objectives: [], destinations: [], optimizationGoals: [], biddingStrategies: [], channelTypes: [] },
        competitorAds: [], comparison: { competitorThemes: [], competitorCTAs: [], competitorFormats: [], gaps: [], competitorSummary: '' }, errors: [],
      })),
      Promise.resolve(runStructuralAnalysis(allCampaigns)),
    ])

    // Generate for ALL target platforms in one call
    const allProposals: any[] = []
    const allFitAnalyses: any[] = []
    const totalSummary = { totalCampaignsAnalyzed: 0, criticalIssues: 0, opportunities: 0, proposalsGenerated: 0, metaCount: 0, googleCount: 0 }

    for (const p of targetPlatforms) {
      try {
        const result = await generateFullAutoProposals(p, competitorAnalysis.userProfile, competitorAnalysis.comparison, competitorAnalysis.competitorAds, allCampaigns, structuralAnalysis.issues)
        allProposals.push(...result.proposals)
        allFitAnalyses.push(...result.fitAnalyses)
        totalSummary.totalCampaignsAnalyzed += result.summary.totalCampaignsAnalyzed
        totalSummary.criticalIssues += result.summary.criticalIssues
        totalSummary.opportunities += result.summary.opportunities
        totalSummary.proposalsGenerated += result.summary.proposalsGenerated
        totalSummary.metaCount += result.summary.metaCount
        totalSummary.googleCount += result.summary.googleCount
      } catch (e) {
        console.error(`[GenerateAd] ${p} failed:`, e)
      }
    }

    return NextResponse.json({
      ok: true,
      data: { proposals: allProposals, fitAnalyses: allFitAnalyses, summary: totalSummary },
      persisted: false,
    })
  } catch (error) {
    console.error('[Generate Ad] Error:', error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' }, { status: 500 })
  }
}
