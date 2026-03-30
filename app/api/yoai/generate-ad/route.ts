import { NextResponse } from 'next/server'
import { generateFullAutoProposals } from '@/lib/yoai/adCreator'
import { runFullCompetitorAnalysis } from '@/lib/yoai/competitorAnalyzer'
import { runStructuralAnalysis } from '@/lib/yoai/platformKnowledge'
import { fetchMetaDeep } from '@/lib/yoai/metaDeepFetcher'
import { fetchGoogleDeep } from '@/lib/yoai/googleDeepFetcher'
import { getBestAvailableRun } from '@/lib/yoai/dailyRunStore'
import type { Platform } from '@/lib/yoai/analysisTypes'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/generate-ad
   Reads persisted ad proposals from daily run.
   Falls back to live generation only if no persisted data.
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { platform, forceGenerate } = body as { platform: Platform; forceGenerate?: boolean }

    if (!platform || !['Meta', 'Google'].includes(platform)) {
      return NextResponse.json({ ok: false, error: 'Platform gerekli (Meta veya Google)' }, { status: 400 })
    }

    // 1. Try persisted data (unless force generate)
    if (!forceGenerate) {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const userId = cookieStore.get('session_id')?.value

      if (userId) {
        const run = await getBestAvailableRun(userId)

        if (run?.ad_proposals_data?.proposals) {
          const allProposals = run.ad_proposals_data.proposals
          const platformProposals = allProposals.filter((p: any) => p.platform === platform)

          if (platformProposals.length > 0) {
            return NextResponse.json({
              ok: true,
              data: {
                proposals: platformProposals,
                fitAnalyses: (run.ad_proposals_data.fitAnalyses || []).filter((fa: any) => fa.platform === platform),
                summary: run.ad_proposals_data.summary || {},
              },
              persisted: true,
              run_date: run.run_date,
            })
          }
        }
      }
    }

    // 2. Fallback: live generation
    console.log(`[GenerateAd] No persisted ${platform} proposals — running live generation`)

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
      runFullCompetitorAnalysis(allCampaigns, cookieHeader, baseUrl),
      Promise.resolve(runStructuralAnalysis(allCampaigns)),
    ])

    const result = await generateFullAutoProposals(
      platform,
      competitorAnalysis.userProfile,
      competitorAnalysis.comparison,
      competitorAnalysis.competitorAds,
      allCampaigns,
      structuralAnalysis.issues,
    )

    return NextResponse.json({ ok: true, data: result, persisted: false })
  } catch (error) {
    console.error('[Generate Ad] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
