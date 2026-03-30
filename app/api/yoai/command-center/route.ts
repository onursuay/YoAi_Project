import { NextResponse } from 'next/server'
import { getBestAvailableRun } from '@/lib/yoai/dailyRunStore'
import { runDeepAnalysis } from '@/lib/yoai/deepAnalysis'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/command-center
   Reads persisted daily run results.
   If no persisted run exists (DB not ready / first use),
   runs live analysis as one-time bootstrap.
   Once daily-run cron is active, this only reads.
   ──────────────────────────────────────────────────────────── */
export async function GET() {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_id')?.value

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
    }

    // 1. Try persisted run
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

    // 2. No persisted run — live analysis (bootstrap until cron creates first run)
    const result = await runDeepAnalysis()

    return NextResponse.json(
      { ok: true, data: result, persisted: false, run_date: null },
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
