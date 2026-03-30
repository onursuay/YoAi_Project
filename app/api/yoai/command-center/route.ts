import { NextResponse } from 'next/server'
import { getBestAvailableRun, getTurkeyDate } from '@/lib/yoai/dailyRunStore'
import { runDeepAnalysis } from '@/lib/yoai/deepAnalysis'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/command-center
   Reads persisted daily run results.
   Does NOT re-run analysis on every request.
   Falls back to live analysis only if no persisted run exists.
   ──────────────────────────────────────────────────────────── */
export async function GET() {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_id')?.value

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
    }

    // 1. Try to read persisted run
    const run = await getBestAvailableRun(userId)

    if (run && run.command_center_data) {
      return NextResponse.json({
        ok: true,
        data: run.command_center_data,
        persisted: true,
        run_date: run.run_date,
        run_status: run.status,
      }, { headers: { 'Cache-Control': 'no-store' } })
    }

    // 2. Fallback: no persisted run exists yet — run live analysis once
    // This happens only on first-ever use before any daily run has completed
    console.log('[CommandCenter] No persisted run found — running live analysis as fallback')
    const result = await runDeepAnalysis()

    return NextResponse.json(
      { ok: true, data: result, persisted: false, run_date: getTurkeyDate() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[Command Center] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
