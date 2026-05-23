/* ──────────────────────────────────────────────────────────
   YoAlgoritma İşletme Scope Çözümleyici (server-only)

   Seçili işletmeyi (yoai_business_scope cookie) çözer. Flag-aware:
   YOAI_PER_ACCOUNT_SCOPE kapalıysa scope DEVRE DIŞI → mevcut birleşik
   davranış (global Meta+Google seçimi) korunur, sıfır regresyon.

   Tek kaynak: runDeepAnalysis (fetch override), command-center GET
   (imza karşılaştırma) ve refresh (imza damgalama) hep buradan okur →
   tutarlı imza, fire-and-forget DB gecikmesi sorunu yok.
   ────────────────────────────────────────────────────────── */

import { isPerAccountScopeEnabled } from './featureFlag'
import { BUSINESS_SCOPE_COOKIE, parseBusinessScope } from '@/lib/account/businessGroups'

export interface YoaiScope {
  /** İşletme cookie'si VAR ve flag açık → fetch'ler bu seçime sınırlanır. */
  scoped: boolean
  metaId: string | null
  googleCustomerId: string | null
  googleLoginCustomerId: string | null
  businessId: string | null
}

const EMPTY: YoaiScope = {
  scoped: false,
  metaId: null,
  googleCustomerId: null,
  googleLoginCustomerId: null,
  businessId: null,
}

/**
 * Cookie'lerden aktif YoAlgoritma scope'unu çözer.
 * - Flag KAPALI veya cookie yoksa: scoped=false + global seçim (mevcut imza).
 * - Flag AÇIK + işletme cookie: scoped=true + işletmenin Meta/Google'ı.
 * Headless (inngest/cron) bağlamda cookie yok → catch → EMPTY (default davranış).
 */
export async function resolveYoaiScope(): Promise<YoaiScope> {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()

    const globalMeta = cookieStore.get('meta_selected_ad_account_id')?.value || null
    const globalGoogle = cookieStore.get('google_ads_customer_id')?.value || null
    const globalLogin = cookieStore.get('google_ads_login_customer_id')?.value || null
    const fallback: YoaiScope = {
      scoped: false,
      metaId: globalMeta,
      googleCustomerId: globalGoogle,
      googleLoginCustomerId: globalLogin,
      businessId: null,
    }

    if (!isPerAccountScopeEnabled()) return fallback

    const raw = cookieStore.get(BUSINESS_SCOPE_COOKIE)?.value
    const parsed = raw ? parseBusinessScope(raw) : null
    if (!parsed) return fallback

    return {
      scoped: true,
      metaId: parsed.metaAccountId,
      googleCustomerId: parsed.googleCustomerId,
      googleLoginCustomerId: parsed.googleLoginCustomerId,
      businessId: parsed.businessId,
    }
  } catch {
    return EMPTY
  }
}
