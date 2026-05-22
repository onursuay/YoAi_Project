import { NextResponse } from 'next/server'
import { runDeepAnalysis } from '@/lib/yoai/deepAnalysis'
import { upsertDailyRun, getTurkeyDate, buildAccountScope } from '@/lib/yoai/dailyRunStore'
import { isPerAccountScopeEnabled } from '@/lib/yoai/featureFlag'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/command-center/refresh
   Aktif (Meta + Google) seçim için command_center_data'yı yeniden üretir.
   Per-account scope (Faz 3.3b): kullanıcı başka hesaba geçince command-center
   uyuşmazlık (scope_mismatch) döndürür; sayfa bu uç noktayı çağırıp o hesap
   için analizi üretir. account_scope upsertDailyRun içinde DB seçiminden
   otomatik damgalanır. Flag kapalıysa pasif (403).
   ──────────────────────────────────────────────────────────── */
export async function POST() {
  try {
    if (!isPerAccountScopeEnabled()) {
      return NextResponse.json({ ok: false, error: 'feature_disabled' }, { status: 403 })
    }

    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
    }

    // Aktif seçimin (cookie) verisini çek — runDeepAnalysis cookie'den çözer
    const commandCenterData = await runDeepAnalysis().catch(() => null)
    if (!commandCenterData) {
      return NextResponse.json({ ok: false, error: 'Analiz üretilemedi' }, { status: 500 })
    }

    // Damgayı cookie (anlık) seçiminden ver — command-center kapısı da cookie okur,
    // böylece DB fire-and-forget gecikmesinden kaynaklı uyuşmazlık olmaz.
    const metaCookie = cookieStore.get('meta_selected_ad_account_id')?.value || null
    const googleCookie = cookieStore.get('google_ads_customer_id')?.value || null
    const accountScope = buildAccountScope(metaCookie, googleCookie)

    await upsertDailyRun({
      user_id: userId,
      run_date: getTurkeyDate(),
      status: 'completed',
      command_center_data: commandCenterData,
      ad_proposals_data: null, // null → mevcut öneriler korunur (update-if-provided)
      account_scope: accountScope,
    })

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
