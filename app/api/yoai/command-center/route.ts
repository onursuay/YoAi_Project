import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { getBestAvailableRun, buildAccountScope } from '@/lib/yoai/dailyRunStore'
import { isPerAccountScopeEnabled } from '@/lib/yoai/featureFlag'
import { resolveYoaiScope } from '@/lib/yoai/businessScope'
import { normalizeMetaAccountId, normalizeGoogleCustomerId } from '@/lib/yoai/businessKey'

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
      let countScope: { campaignIds: string[]; accountIds: (string | null)[] } | undefined
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
        // Sayaçları kart listesiyle TUTARLI tut: seçili işletmenin kampanyaları + hesabına sınırla.
        const campaigns = (run.command_center_data?.campaigns ?? []) as Array<{ id?: string | number }>
        countScope = {
          campaignIds: campaigns.map((c) => String(c?.id)).filter(Boolean),
          accountIds: [normalizeMetaAccountId(sc.metaId), normalizeGoogleCustomerId(sc.googleCustomerId)],
        }
      }
      // Sayaçları gerçek hiyerarşik tablolardan üret (eski deepAnalysis dalı yanıltıcıydı).
      let hierarchyCounts = null
      try {
        const { getHierarchyCounts } = await import('@/lib/yoai/ai/hierarchicalStore')
        hierarchyCounts = await getHierarchyCounts(userId, countScope)
      } catch (e) {
        console.warn('[Command Center] hierarchyCounts atlandı:', e instanceof Error ? e.message : e)
      }
      return NextResponse.json(
        {
          ok: true,
          data: hierarchyCounts ? { ...run.command_center_data, hierarchyCounts } : run.command_center_data,
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
