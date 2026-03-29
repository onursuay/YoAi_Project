import { NextResponse } from 'next/server'
import { fetchGoogleCompetitors } from '@/lib/yoai/competitorAnalyzer'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/competitors/google-auction
   Aggregates auction insights from top Google campaigns.
   ──────────────────────────────────────────────────────────── */
export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    const { competitors, errors } = await fetchGoogleCompetitors(cookieHeader, baseUrl)

    return NextResponse.json({
      ok: true,
      data: { competitors, errors },
    })
  } catch (error) {
    console.error('[Google Auction] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
