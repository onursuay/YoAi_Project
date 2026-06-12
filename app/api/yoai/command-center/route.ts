import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { getBestAvailableRun, buildAccountScope } from '@/lib/yoai/dailyRunStore'
import { isPerAccountScopeEnabled } from '@/lib/yoai/featureFlag'
import { resolveYoaiScope } from '@/lib/yoai/businessScope'

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
    const userId = readUserId(cookieStore)

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
    }

    const run = await getBestAvailableRun(userId)

    if (run && run.command_center_data) {
      // Per-account: çalışmanın seçim imzası aktif seçimle eşleşmiyorsa gösterme
      // (yeni hesaba geçince o hesap için yeniden analiz tetiklenir). Damgasız/eski
      // çalışmalar geriye-uyum için gösterilmeye devam eder.
      if (isPerAccountScopeEnabled()) {
        // Damgasız (null) çalışmalar da aktif seçimle eşleşmez sayılır → yeniden
        // üretilip damgalanır (flag öncesi üretilmiş eski çalışmalar bu sayede güncellenir).
        // Scope, seçili işletme (yoai_business_scope) varsa ondan, yoksa global seçimden.
        const sc = await resolveYoaiScope()
        const currentScope = buildAccountScope(sc.metaId, sc.googleCustomerId)
        if (run.account_scope !== currentScope) {
          return NextResponse.json(
            { ok: true, data: null, persisted: false, run_date: null, scope_mismatch: true },
            { headers: { 'Cache-Control': 'no-store' } },
          )
        }
      }
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
