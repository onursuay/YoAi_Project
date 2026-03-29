import { NextResponse } from 'next/server'
import { generateFullAutoProposals } from '@/lib/yoai/adCreator'
import { runFullCompetitorAnalysis } from '@/lib/yoai/competitorAnalyzer'
import { runStructuralAnalysis } from '@/lib/yoai/platformKnowledge'
import { fetchMetaDeep } from '@/lib/yoai/metaDeepFetcher'
import { fetchGoogleDeep } from '@/lib/yoai/googleDeepFetcher'
import type { Platform } from '@/lib/yoai/analysisTypes'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/generate-ad
   Full pipeline:
   1. Fetch user campaigns
   2. Analyze user ads
   3. Search competitors via Meta Ad Library
   4. Compare user vs competitors
   5. Generate full campaign+adset+ad proposals
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { platform } = body as { platform: Platform }

    if (!platform || !['Meta', 'Google'].includes(platform)) {
      return NextResponse.json({ ok: false, error: 'Platform gerekli (Meta veya Google)' }, { status: 400 })
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // 1. Fetch campaigns
    const [metaResult, googleResult] = await Promise.all([
      fetchMetaDeep().catch(() => ({ campaigns: [], errors: [] })),
      fetchGoogleDeep().catch(() => ({ campaigns: [], errors: [] })),
    ])
    const allCampaigns = [...metaResult.campaigns, ...googleResult.campaigns]

    if (allCampaigns.length === 0) {
      return NextResponse.json({ ok: false, error: 'Analiz edilecek kampanya bulunamadı' }, { status: 404 })
    }

    // 2-3-4. Full competitor analysis + structural analysis
    const [competitorAnalysis, structuralAnalysis] = await Promise.all([
      runFullCompetitorAnalysis(allCampaigns, cookieHeader, baseUrl),
      Promise.resolve(runStructuralAnalysis(allCampaigns)),
    ])

    // 5. Generate proposals (with competitor + structural data)
    const result = await generateFullAutoProposals(
      platform,
      competitorAnalysis.userProfile,
      competitorAnalysis.comparison,
      competitorAnalysis.competitorAds,
      allCampaigns,
      structuralAnalysis.issues,
    )

    return NextResponse.json({
      ok: true,
      data: {
        ...result,
        competitorAnalysis: {
          userProfile: competitorAnalysis.userProfile,
          competitorCount: competitorAnalysis.competitorAds.length,
          gaps: competitorAnalysis.comparison.gaps,
          summary: competitorAnalysis.comparison.competitorSummary,
        },
      },
    })
  } catch (error) {
    console.error('[Generate Ad] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
