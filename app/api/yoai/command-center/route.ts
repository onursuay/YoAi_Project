import { NextResponse } from 'next/server'
import { runDeepAnalysis } from '@/lib/yoai/deepAnalysis'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/command-center
   Runs deep hierarchical analysis across Meta + Google Ads.
   Returns DeepAnalysisResult with campaigns, KPIs, AI summaries.
   ──────────────────────────────────────────────────────────── */
export async function GET() {
  try {
    const result = await runDeepAnalysis()

    return NextResponse.json(
      { ok: true, data: result },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[Command Center] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
      { status: 500 },
    )
  }
}
