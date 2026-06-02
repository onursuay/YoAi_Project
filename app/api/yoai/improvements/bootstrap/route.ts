import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { inngest } from '@/inngest/client'
import { getImprovementHierarchy } from '@/lib/yoai/ai/hierarchicalStore'
import { isPerAccountScopeEnabled } from '@/lib/yoai/featureFlag'
import { resolveYoaiScope } from '@/lib/yoai/businessScope'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

/**
 * POST /api/yoai/improvements/bootstrap
 *
 * Geliştirme kartları HİÇ yoksa, haftalık cron'u (Pazar gece) beklemeden
 * ilk (tek seferlik) hiyerarşik analizi tetikler. Böylece yeni kullanıcı /
 * işletme / owner ilk girişte boş ekran yerine "hazırlanıyor" görür ve kısa
 * süre sonra gerçek kartlar gelir. Sonraki tazelemeler yine haftalık cron'dan.
 *
 * Idempotent / maliyet guard'ları:
 *   1. Zaten kart veya hesap uyarısı varsa → no-op (triggered:false).
 *   2. Inngest fonksiyonu aktif kampanya yoksa zaten erken çıkar.
 *   3. UI tarafında localStorage cooldown ile kısa sürede tekrar çağrılmaz.
 *
 * SAHTE VERİ YOK: yalnız gerçek tarama akışını (gerçek kampanya → Batch API →
 * gerçek kart) tetikler; hiçbir placeholder kart yazılmaz.
 */
export async function POST() {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value
    if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

    // 1) Zaten veri varsa tetikleme (gereksiz Batch maliyeti önlenir)
    const existing = await getImprovementHierarchy(userId)
    if (existing.campaigns.length > 0 || existing.accountAlerts.length > 0) {
      return NextResponse.json({ ok: true, triggered: false, reason: 'exists' })
    }

    // 2) Çoklu işletme scope'u (flag açıksa) — seçili işletmenin hesabına göre
    const scope = isPerAccountScopeEnabled() ? await resolveYoaiScope() : undefined

    // 3) Hiyerarşik geliştirme kartları analizini tetikle (account_alerts dahil)
    await inngest.send({
      name: 'yoalgoritma/campaign-improvements.user',
      data: { userId, scope },
    })

    return NextResponse.json({ ok: true, triggered: true })
  } catch (e) {
    console.error('[improvements bootstrap POST] error:', e)
    return NextResponse.json({ ok: false, error: 'Sunucu hatası' }, { status: 500 })
  }
}
