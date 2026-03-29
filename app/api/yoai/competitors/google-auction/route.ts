import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/competitors/google-auction
   Deprecated — use /api/yoai/competitors/analyze instead.
   Kept for backward compatibility, redirects to analyze.
   ──────────────────────────────────────────────────────────── */
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: { competitors: [], errors: ['Bu endpoint kaldırıldı. /api/yoai/competitors/analyze kullanın.'] },
  })
}
