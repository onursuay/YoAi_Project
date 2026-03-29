import { NextResponse } from 'next/server'
import { analyzeCompetitorsWithAI, type GoogleCompetitor, type MetaAdLibraryAd } from '@/lib/yoai/competitorAnalyzer'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/competitors/analyze
   AI-powered competitor comparison.
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { googleCompetitors, metaAds } = body as {
      googleCompetitors: GoogleCompetitor[]
      metaAds: MetaAdLibraryAd[]
    }

    const insights = await analyzeCompetitorsWithAI(
      googleCompetitors || [],
      metaAds || [],
      [], // user campaigns passed separately if needed
    )

    return NextResponse.json({ ok: true, data: { insights } })
  } catch (error) {
    console.error('[Competitor Analyze] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
