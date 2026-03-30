import { NextResponse } from 'next/server'
import { getBestAvailableRun } from '@/lib/yoai/dailyRunStore'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/command-center
   READ ONLY — reads persisted daily run results.
   NEVER runs live analysis. If no run exists, returns empty.
   ──────────────────────────────────────────────────────────── */
export async function GET() {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_id')?.value

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
    }

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

    // No persisted run — return empty state (no live analysis)
    return NextResponse.json({
      ok: true,
      data: null,
      persisted: false,
      run_date: null,
      run_status: 'no_run',
      message: 'Henüz günlük analiz oluşturulmadı. Analiz her gün 10:00\'da otomatik çalışır.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[Command Center] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
