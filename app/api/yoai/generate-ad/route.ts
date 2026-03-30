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
      fetchMetaDeep().catch(e => { console.error('[GenerateAd] Meta fetch failed:', e); return { campaigns: [] as any[], errors: ['Meta fetch hatası'], connected: false } }),
      fetchGoogleDeep().catch(e => { console.error('[GenerateAd] Google fetch failed:', e); return { campaigns: [] as any[], errors: ['Google fetch hatası'], connected: false } }),
    ])

    const generateForPlatforms = async (platforms: Platform[], allCampaigns: any[]) => {
      const [competitorAnalysis, structuralAnalysis] = await Promise.all([
        runFullCompetitorAnalysis(allCampaigns, cookieHeader, baseUrl).catch(() => ({
          userProfile: { keywords: [], themes: [], ctaTypes: [], formats: [], platforms: [], topPerformingAds: [], weakAds: [], avgCtr: 0, avgCpc: 0, totalSpend: 0, objectives: [], destinations: [], optimizationGoals: [], biddingStrategies: [], channelTypes: [] },
          competitorAds: [], comparison: { competitorThemes: [], competitorCTAs: [], competitorFormats: [], gaps: [], competitorSummary: '' }, errors: [],
        })),
        Promise.resolve(runStructuralAnalysis(allCampaigns)),
      ])

      const results = await Promise.all(
        platforms.map(async (p) => {
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

      const proposals: any[] = []
      const fitAnalyses: any[] = []
      for (const r of results) {
        if (!r) continue
        proposals.push(...r.proposals)
        fitAnalyses.push(...r.fitAnalyses)
      }
      return { proposals, fitAnalyses }
    }

    // 1. Try persisted data (unless user explicitly forces regeneration)
    if (!forceGenerate && userId) {
      const run = await getBestAvailableRun(userId)

      if (run?.ad_proposals_data?.proposals) {
        const persistedProposals = run.ad_proposals_data.proposals as any[]
        const persistedFitAnalyses = (run.ad_proposals_data.fitAnalyses || []) as any[]

        if (persistedProposals.length > 0) {
          // Which platforms already have proposals in persisted data?
          const persistedPlatforms = new Set(persistedProposals.map((p: any) => p.platform as Platform))

          // Fast path: if both platforms already covered, return immediately (no fetch)
          if (persistedPlatforms.has('Meta') && persistedPlatforms.has('Google')) {
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

          // Partial data: check if other platform is connected and has campaigns
          const [metaResult, googleResult] = await fetchBothPlatforms()
          console.log(`[GenerateAd] Checking missing platforms. Meta: ${metaResult.campaigns.length} campaigns, Google: ${googleResult.campaigns.length} campaigns`)

          const platformsWithCampaigns: Platform[] = []
          if (metaResult.campaigns.length > 0) platformsWithCampaigns.push('Meta')
          if (googleResult.campaigns.length > 0) platformsWithCampaigns.push('Google')

          const missingPlatforms = platformsWithCampaigns.filter(p => !persistedPlatforms.has(p))

          if (missingPlatforms.length === 0) {
            // No connected platform is missing — return persisted as-is
            const metaCount = persistedProposals.filter((p: any) => p.platform === 'Meta').length
            const googleCount = persistedProposals.filter((p: any) => p.platform === 'Google').length
            console.log(`[GenerateAd] No missing platforms. Returning persisted.`)
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

          // Auto-complete: generate ONLY for missing platforms, keep existing proposals
          console.log(`[GenerateAd] Auto-completing missing platforms: ${missingPlatforms.join(', ')}`)
          const allCampaigns = [...metaResult.campaigns, ...googleResult.campaigns]
          const { proposals: newProposals, fitAnalyses: newFitAnalyses } = await generateForPlatforms(missingPlatforms, allCampaigns)

          // Merge: existing persisted + newly generated
          const mergedProposals = [...persistedProposals, ...newProposals]
          const mergedFitAnalyses = [...persistedFitAnalyses, ...newFitAnalyses]
          const metaCount = mergedProposals.filter((p: any) => p.platform === 'Meta').length
          const googleCount = mergedProposals.filter((p: any) => p.platform === 'Google').length
          const mergedSummary = {
            totalCampaignsAnalyzed: (run.ad_proposals_data.summary?.totalCampaignsAnalyzed || 0) + allCampaigns.filter((c: any) => missingPlatforms.includes(c.platform)).length,
            criticalIssues: (run.ad_proposals_data.summary?.criticalIssues || 0),
            opportunities: (run.ad_proposals_data.summary?.opportunities || 0),
            proposalsGenerated: mergedProposals.length,
            metaCount,
            googleCount,
          }

          console.log(`[GenerateAd] Merged: ${mergedProposals.length} proposals (Meta: ${metaCount}, Google: ${googleCount})`)

          // Persist merged data so next page load is instant
          try {
            await upsertDailyRun({
              user_id: userId,
              run_date: run.run_date,
              status: 'completed',
              command_center_data: null,
              ad_proposals_data: { proposals: mergedProposals, fitAnalyses: mergedFitAnalyses, summary: mergedSummary },
            })
            console.log(`[GenerateAd] Persisted merged data (${mergedProposals.length} proposals)`)
          } catch (e) {
            console.error('[GenerateAd] Persist merge error:', e)
          }

          return NextResponse.json({
            ok: true,
            data: { proposals: mergedProposals, fitAnalyses: mergedFitAnalyses, summary: mergedSummary },
            persisted: false,
          })
        }
        // Persisted data is empty → fall through to live generation
        console.log(`[GenerateAd] Persisted data has 0 proposals. Generating live.`)
      }
    }

    // 2. Full live generation (no persisted data at all, or forceGenerate)
    const [metaResult, googleResult] = await fetchBothPlatforms()
    console.log(`[GenerateAd] Live: Meta: ${metaResult.campaigns.length} campaigns, Google: ${googleResult.campaigns.length} campaigns`)
    const allCampaigns = [...metaResult.campaigns, ...googleResult.campaigns]

    if (allCampaigns.length === 0) {
      return NextResponse.json({ ok: false, error: 'Analiz edilecek kampanya bulunamadı' }, { status: 404 })
    }

    const effectivePlatforms: Platform[] = []
    if (metaResult.campaigns.length > 0) effectivePlatforms.push('Meta')
    if (googleResult.campaigns.length > 0) effectivePlatforms.push('Google')
    console.log(`[GenerateAd] Effective platforms: ${effectivePlatforms.join(', ')}`)

    const { proposals: allProposals, fitAnalyses: allFitAnalyses } = await generateForPlatforms(effectivePlatforms, allCampaigns)

    const metaCount = allProposals.filter((p: any) => p.platform === 'Meta').length
    const googleCount = allProposals.filter((p: any) => p.platform === 'Google').length
    const totalSummary = {
      totalCampaignsAnalyzed: allCampaigns.length,
      criticalIssues: 0,
      opportunities: 0,
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
