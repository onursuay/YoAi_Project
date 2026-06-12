/**
 * Sunucu-taraflı özellik erişim + kredi guard'ı.
 *
 * AI üretim endpoint'leri (tasarım görsel/video, YoAlgoritma sohbet, SEO)
 * istemci JS'ine güvenmeden BU guard'dan geçer: kimlik doğrulama + (gerekirse)
 * aktif abonelik + atomik kredi düşümü tek noktada yapılır. UI'daki
 * `useCredits`/`AccessRequiredModal` yalnız kullanıcı deneyimi içindir; gerçek
 * koruma burada — doğrudan `fetch`/`curl` ile çağıran da aynı duvara çarpar.
 *
 * Owner / süper admin (SUPER_ADMIN_EMAILS) tüm guard'ları geçer, kredi düşülmez.
 *
 * Kullanım:
 *   const access = await chargeFeature({ featureKey: 'design_generation', creditCost: COST_PER_GENERATION })
 *   if (!access.ok) return NextResponse.json(access.body, { status: access.status })
 *   try { ...pahalı üretim... }
 *   catch (e) { await access.refund(); throw e }  // başarısızlıkta krediyi geri ver
 */
import 'server-only'
import { getCurrentUser, type AuthenticatedUser } from '@/lib/billing/user'
import {
  getSubscription,
  spendCreditsServer,
  refundCreditsServer,
} from '@/lib/billing/db'
import { hasActiveSubscription } from '@/lib/subscription/helpers'
import { isSuperAdminEmail } from '@/lib/admin/superAdmin'
import type { SubscriptionState, PlanId } from '@/lib/subscription/types'

export interface FeatureGrant {
  ok: true
  user: AuthenticatedUser
  isOwner: boolean
  /** Bu çağrıda gerçekten düşülen kredi (owner / 0-maliyet için 0). */
  spent: number
  /** Üretim başarısız olursa düşülen krediyi geri ver. Owner/0 için no-op. */
  refund: () => Promise<void>
}

export interface FeatureDenial {
  ok: false
  status: number
  body: { ok: false; error: string; message: string }
}

export type FeatureAccessResult = FeatureGrant | FeatureDenial

const NOOP = async () => {}

function deny(status: number, error: string, message: string): FeatureDenial {
  return { ok: false, status, body: { ok: false, error, message } }
}

export interface ChargeFeatureOptions {
  /** Telemetri / kredi reason etiketi (featureAccessMap anahtarı önerilir). */
  featureKey: string
  /** Düşülecek kredi (0 / verilmezse kredi düşülmez, yalnız erişim kontrolü). */
  creditCost?: number
  /** true ise aktif (veya geçerli deneme) abonelik şarttır. */
  requireSubscription?: boolean
}

export async function chargeFeature(opts: ChargeFeatureOptions): Promise<FeatureAccessResult> {
  const { featureKey, creditCost = 0, requireSubscription = false } = opts

  const user = await getCurrentUser()
  if (!user) return deny(401, 'unauthenticated', 'Bu işlem için giriş yapmanız gerekir.')

  // Owner / süper admin — tüm bariyerleri geçer, kredi düşülmez.
  if (isSuperAdminEmail(user.email)) {
    return { ok: true, user, isOwner: true, spent: 0, refund: NOOP }
  }

  if (requireSubscription) {
    const sub = await getSubscription(user.id)
    const state: SubscriptionState | null = sub
      ? {
          planId: sub.plan_id as PlanId,
          status: sub.status,
          billingCycle: sub.billing_cycle,
          startDate: sub.started_at,
          trialEndDate: sub.trial_end_date,
          currentPeriodEnd: sub.current_period_end,
        }
      : null
    if (!state || !hasActiveSubscription(state)) {
      return deny(403, 'subscription_required', 'Bu özellik için aktif bir abonelik gerekir.')
    }
  }

  if (creditCost > 0) {
    // Atomik düşüm: bakiye yetersizse RPC 0 satır döner (yarış koşulu yok).
    const row = await spendCreditsServer(user.id, creditCost, featureKey)
    if (!row) return deny(402, 'insufficient_credits', 'Bu işlem için yeterli krediniz yok.')
    return {
      ok: true,
      user,
      isOwner: false,
      spent: creditCost,
      refund: async () => {
        await refundCreditsServer(user.id, creditCost, `${featureKey}_refund`)
      },
    }
  }

  return { ok: true, user, isOwner: false, spent: 0, refund: NOOP }
}
