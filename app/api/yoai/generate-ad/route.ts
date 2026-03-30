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

    // ── Helpers ──
    const cookieHeader = request.headers.get('cookie') || ''
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    const fetchBothPlatforms = () => Promise.all([
      fetchMetaDeep(userId || undefined).catch(e => { console.error('[GenerateAd] Meta fetch failed:', e); return { campaigns: [] as any[], errors: ['Meta fetch hatası'], connected: false } }),
      fetchGoogleDeep(userId || undefined).catch(e => { console.error('[GenerateAd] Google fetch failed:', e); return { campaigns: [] as any[], errors: ['Google fetch hatası'], connected: false } }),
    ])

    const generateForPlatforms = async (platforms: Platform[], allCampaigns: any[]) => {
      const [competitorAnalysis, structuralAnalysis] = await Promise.all([
        runFullCompetitorAnalysis(allCampaigns, cookieHeader, baseUrl).catch(() => ({
          userProfile: { keywords: [], themes: [], ctaTypes: [], formats: [], platforms: [], topPerformingAds: [], weakAds: [], avgCtr: 0, avgCpc: 0, totalSpend: 0, objectives: [], destinations: [], optimizationGoals: [], biddingStrategies: [], channelTypes: [] },
          competitorAds: [], comparison: { competitorThemes: [], competitorCTAs: [], competitorFormats: [], gaps: [], competitorSummary: '' }, errors: [],
        })),
        Promise.resolve(runStructuralAnalysis(allCampaigns)),
      ])

      // Run SEQUENTIALLY to avoid API rate limits (parallel calls caused one to fail)
      const results: (Awaited<ReturnType<typeof generateFullAutoProposals>> | null)[] = []
      for (const p of platforms) {
        try {
          console.log(`[GenerateAd] Generating for ${p}...`)
          const result = await generateFullAutoProposals(p, competitorAnalysis.userProfile, competitorAnalysis.comparison, competitorAnalysis.competitorAds, allCampaigns, structuralAnalysis.issues)
          console.log(`[GenerateAd] ${p}: ${result.proposals.length} proposals, aiGenerated: ${result.aiGenerated}`)
          results.push(result)
        } catch (e) {
          console.error(`[GenerateAd] ${p} failed:`, e)
          results.push(null)
        }
      }

      const proposals: any[] = []
      const fitAnalyses: any[] = []
      for (const r of results) {
        if (!r) continue
        proposals.push(...r.proposals)
        fitAnalyses.push(...r.fitAnalyses)
      }
      return { proposals, fitAnalyses }
    }

    // 1. Try persisted data ONLY if complete (both platforms have proposals)
    if (!forceGenerate && userId) {
      const run = await getBestAvailableRun(userId)

      if (run?.ad_proposals_data?.proposals) {
        const persistedProposals = run.ad_proposals_data.proposals as any[]

        if (persistedProposals.length > 0) {
          const persistedPlatforms = new Set(persistedProposals.map((p: any) => p.platform as Platform))

          // ONLY return persisted data if BOTH platforms are represented.
          // If incomplete → fall through to full live generation.
          // Auto-complete was unreliable — just regenerate everything.
          if (persistedPlatforms.has('Meta') && persistedPlatforms.has('Google')) {
            const persistedFitAnalyses = (run.ad_proposals_data.fitAnalyses || []) as any[]
            const metaCount = persistedProposals.filter((p: any) => p.platform === 'Meta').length
            const googleCount = persistedProposals.filter((p: any) => p.platform === 'Google').length
            console.log(`[GenerateAd] Persisted data complete (Meta: ${metaCount}, Google: ${googleCount}). Returning.`)
            return NextResponse.json({
              ok: true,
              data: {
                proposals: persistedProposals,
                fitAnalyses: persistedFitAnalyses,
                summary: { ...(run.ad_proposals_data.summary || {}), metaCount, googleCount, proposalsGenerated: persistedProposals.length },
              },
              persisted: true,
              run_date: run.run_date,
            })
          }
          // Incomplete persisted data → fall through to live generation
          console.log(`[GenerateAd] Persisted data incomplete (platforms: ${[...persistedPlatforms].join(', ')}). Generating live.`)
        }
      }
    }

    // 2. Full live generation (no persisted data at all, or forceGenerate)
    const [metaResult, googleResult] = await fetchBothPlatforms()
    console.log(`[GenerateAd] Live: Meta: ${metaResult.campaigns.length} campaigns, Google: ${googleResult.campaigns.length} campaigns`)
    const allCampaigns = [...metaResult.campaigns, ...googleResult.campaigns]

    if (allCampaigns.length === 0) {
      return NextResponse.json({ ok: false, error: 'Analiz edilecek kampanya bulunamadı' }, { status: 404 })
    }

    // Use connected flag — generateFullAutoProposals handles 0 campaigns gracefully
    const effectivePlatforms: Platform[] = []
    if (metaResult.connected) effectivePlatforms.push('Meta')
    if (googleResult.connected) effectivePlatforms.push('Google')
    console.log(`[GenerateAd] Effective platforms: ${effectivePlatforms.join(', ')} (Meta: ${metaResult.campaigns.length} campaigns, Google: ${googleResult.campaigns.length} campaigns)`)

    const { proposals: allProposals, fitAnalyses: allFitAnalyses } = await generateForPlatforms(effectivePlatforms, allCampaigns)

    const metaCount = allProposals.filter((p: any) => p.platform === 'Meta').length
    const googleCount = allProposals.filter((p: any) => p.platform === 'Google').length
    // totalCampaignsAnalyzed = only ACTIVE campaigns that were actually analyzed (from fitAnalyses)
    const totalSummary = {
      totalCampaignsAnalyzed: allFitAnalyses.length,
      criticalIssues: allFitAnalyses.filter((fa: any) => fa.fitScore < 40).length,
      opportunities: allFitAnalyses.filter((fa: any) => fa.weaknesses?.length > 0).length,
      proposalsGenerated: allProposals.length,
      metaCount,
      googleCount,
    }

    console.log(`[GenerateAd] Total: ${allProposals.length} proposals (Meta: ${metaCount}, Google: ${googleCount})`)

    // Persist live-generated results so they survive page refresh
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
