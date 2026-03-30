import { NextResponse } from 'next/server'
import { generateFullAutoProposals } from '@/lib/yoai/adCreator'
import { runFullCompetitorAnalysis } from '@/lib/yoai/competitorAnalyzer'
import { runStructuralAnalysis } from '@/lib/yoai/platformKnowledge'
import { fetchMetaDeep } from '@/lib/yoai/metaDeepFetcher'
import { fetchGoogleDeep } from '@/lib/yoai/googleDeepFetcher'
import { getBestAvailableRun, upsertDailyRun, getTurkeyDate } from '@/lib/yoai/dailyRunStore'
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

    // Resolve userId once
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_id')?.value

    // 1. Try persisted data (unless user explicitly forces regeneration)
    if (!forceGenerate && userId) {
      const run = await getBestAvailableRun(userId)

      if (run?.ad_proposals_data?.proposals) {
        const allProposals = run.ad_proposals_data.proposals
        const filtered = allProposals.filter((p: any) => targetPlatforms.includes(p.platform))

        // Only return persisted data if ALL target platforms are represented
        const representedPlatforms = new Set(filtered.map((p: any) => p.platform as Platform))
        const allPlatformsCovered = targetPlatforms.every(tp => representedPlatforms.has(tp))

        if (allPlatformsCovered && filtered.length > 0) {
          // Recompute platform counts from actual persisted proposals
          const metaCount = filtered.filter((p: any) => p.platform === 'Meta').length
          const googleCount = filtered.filter((p: any) => p.platform === 'Google').length
          const persistedSummary = run.ad_proposals_data.summary || {}

          return NextResponse.json({
            ok: true,
            data: {
              proposals: filtered,
              fitAnalyses: (run.ad_proposals_data.fitAnalyses || []).filter((fa: any) => targetPlatforms.includes(fa.platform)),
              summary: { ...persistedSummary, metaCount, googleCount, proposalsGenerated: filtered.length },
            },
            persisted: true,
            run_date: run.run_date,
          })
        }
        // Some target platforms missing from persisted data → fall through to live generation
        console.log(`[GenerateAd] Persisted data missing platforms: ${targetPlatforms.filter(tp => !representedPlatforms.has(tp)).join(', ')}. Generating live.`)
      }
    }

    // 2. Live generation
    const cookieHeader = request.headers.get('cookie') || ''
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    const [metaResult, googleResult] = await Promise.all([
      fetchMetaDeep().catch(e => { console.error('[GenerateAd] Meta fetch failed:', e); return { campaigns: [], errors: ['Meta fetch hatası'] } }),
      fetchGoogleDeep().catch(e => { console.error('[GenerateAd] Google fetch failed:', e); return { campaigns: [], errors: ['Google fetch hatası'] } }),
    ])
    console.log(`[GenerateAd] Meta: ${metaResult.campaigns.length} campaigns, Google: ${googleResult.campaigns.length} campaigns`)
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

    // Generate for ALL target platforms in PARALLEL
    const allProposals: any[] = []
    const allFitAnalyses: any[] = []
    const totalSummary = { totalCampaignsAnalyzed: 0, criticalIssues: 0, opportunities: 0, proposalsGenerated: 0, metaCount: 0, googleCount: 0 }

    const platformResults = await Promise.all(
      targetPlatforms.map(async (p) => {
        try {
          console.log(`[GenerateAd] Generating for ${p}...`)
          const result = await generateFullAutoProposals(p, competitorAnalysis.userProfile, competitorAnalysis.comparison, competitorAnalysis.competitorAds, allCampaigns, structuralAnalysis.issues)
          console.log(`[GenerateAd] ${p}: ${result.proposals.length} proposals, aiGenerated: ${result.aiGenerated}`)
          return result
        } catch (e) {
          console.error(`[GenerateAd] ${p} failed:`, e)
          return null
        }
      })
    )

    for (const result of platformResults) {
      if (!result) continue
      allProposals.push(...result.proposals)
      allFitAnalyses.push(...result.fitAnalyses)
      totalSummary.totalCampaignsAnalyzed += result.summary.totalCampaignsAnalyzed
      totalSummary.criticalIssues += result.summary.criticalIssues
      totalSummary.opportunities += result.summary.opportunities
      totalSummary.proposalsGenerated += result.summary.proposalsGenerated
      totalSummary.metaCount += result.summary.metaCount
      totalSummary.googleCount += result.summary.googleCount
    }

    console.log(`[GenerateAd] Total: ${allProposals.length} proposals (Meta: ${totalSummary.metaCount}, Google: ${totalSummary.googleCount})`)

    // 3. Persist live-generated results so they survive page refresh
    if (userId && allProposals.length > 0) {
      try {
        await upsertDailyRun({
          user_id: userId,
          run_date: getTurkeyDate(),
          status: 'completed',
          command_center_data: null,
          ad_proposals_data: { proposals: allProposals, fitAnalyses: allFitAnalyses, summary: totalSummary },
        })
        console.log(`[GenerateAd] Persisted ${allProposals.length} proposals to daily run store`)
      } catch (e) {
        console.error('[GenerateAd] Persist error:', e)
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
