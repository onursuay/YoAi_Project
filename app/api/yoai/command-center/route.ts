import { NextResponse } from 'next/server'
import { getBestAvailableRun } from '@/lib/yoai/dailyRunStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/command-center
   Sadece persisted daily run verisini döner.
   Live analiz burada TETİKLENMEZ — sayfa yenilendiğinde
   kullanıcıya yeniden tarama göstermemek için kritiktir.
   Live analiz sadece kullanıcı "İlk Analizi Başlat" dediğinde
   veya cron ile tetiklenir.
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
      return NextResponse.json(
        {
          ok: true,
          data: run.command_center_data,
          persisted: true,
          run_date: run.run_date,
          run_status: run.status,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // Persisted yok — boş state döndür, UI "İlk Analizi Başlat" butonu gösterir.
    return NextResponse.json(
      { ok: true, data: null, persisted: false, run_date: null },
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
