import 'server-only'
import { getCurrentUser, type AuthenticatedUser } from '@/lib/billing/user'
import { getSubscription } from '@/lib/billing/db'
import { isTrialActive } from '@/lib/subscription/helpers'
import { isSuperAdminEmail } from '@/lib/admin/superAdmin'
import type { SubscriptionState, PlanId } from '@/lib/subscription/types'

/**
 * Email Marketing route'ları için erişim guard'ı — CRM guard ile aynı desen
 * (auth + herhangi aktif/trial abonelik + owner allowlist bypass).
 */
export type EmailAccess =
  | { ok: true; user: AuthenticatedUser; isOwner: boolean }
  | { ok: false; status: 401 | 403; error: string }

export async function checkEmailAccess(): Promise<EmailAccess> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, status: 401, error: 'unauthorized' }

  if (isSuperAdminEmail(user.email)) return { ok: true, user, isOwner: true }

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
