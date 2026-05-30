import 'server-only'
import { getCurrentUser, type AuthenticatedUser } from '@/lib/billing/user'
import { getSubscription } from '@/lib/billing/db'
import { isTrialActive } from '@/lib/subscription/helpers'
import { isSuperAdminEmail } from '@/lib/admin/superAdmin'
import type { SubscriptionState, PlanId } from '@/lib/subscription/types'

/**
 * CRM aksiyon/okuma route'ları için ortak erişim guard'ı.
 *
 * CRM `subscription_required` (featureAccessMap `crm`). Aktif veya trial içindeki
 * herhangi bir abonelik yeterlidir (modüle özel `includes*` şartı yok). Owner
 * allowlist (`SUPER_ADMIN_EMAILS`) bypass eder — optimizasyon guard'ı ile aynı
 * desen. Modal sadece UX; gerçek bariyer burada (CLAUDE.md).
 */
export type CrmAccess =
  | { ok: true; user: AuthenticatedUser; isOwner: boolean }
  | { ok: false; status: 401 | 403; error: string }

export async function checkCrmAccess(): Promise<CrmAccess> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, status: 401, error: 'unauthorized' }

  // Owner bypass — allowlist'teki hesaplar abonelik satırı olmadan tam erişir.
  if (isSuperAdminEmail(user.email)) {
    return { ok: true, user, isOwner: true }
  }

  const sub = await getSubscription(user.id)
  if (!sub) return { ok: false, status: 403, error: 'no_subscription' }

  const subscription: SubscriptionState = {
    planId: sub.plan_id as PlanId,
    status: sub.status,
    billingCycle: sub.billing_cycle,
    startDate: sub.started_at,
    trialEndDate: sub.trial_end_date,
    currentPeriodEnd: sub.current_period_end,
  }

  const active = subscription.status === 'active'
  const trial = subscription.status === 'trial' && isTrialActive(subscription)
  if (!active && !trial) return { ok: false, status: 403, error: 'subscription_inactive' }

  return { ok: true, user, isOwner: false }
}
