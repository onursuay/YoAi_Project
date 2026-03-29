import { NextResponse } from 'next/server'
import { runFullCompetitorAnalysis } from '@/lib/yoai/competitorAnalyzer'
import { fetchMetaDeep } from '@/lib/yoai/metaDeepFetcher'
import { fetchGoogleDeep } from '@/lib/yoai/googleDeepFetcher'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/competitors/analyze
   Full competitor analysis pipeline:
   1. Fetch user campaigns
   2. Analyze user ad content
   3. Search Meta Ad Library for competitors
   4. Compare and identify gaps
   ──────────────────────────────────────────────────────────── */
export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // Fetch campaigns
    const [metaResult, googleResult] = await Promise.all([
      fetchMetaDeep().catch(() => ({ campaigns: [], errors: [] })),
      fetchGoogleDeep().catch(() => ({ campaigns: [], errors: [] })),
    ])
    const allCampaigns = [...metaResult.campaigns, ...googleResult.campaigns]

    if (allCampaigns.length === 0) {
      return NextResponse.json({ ok: true, data: { userProfile: null, competitorAds: [], comparison: null, errors: ['Kampanya bulunamadı'] } })
    }

    const result = await runFullCompetitorAnalysis(allCampaigns, cookieHeader, baseUrl)

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    console.error('[Competitor Analyze] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
