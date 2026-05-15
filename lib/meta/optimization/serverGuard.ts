import 'server-only'
import { NextResponse } from 'next/server'
import { getCurrentUser, type AuthenticatedUser } from '@/lib/billing/user'
import { getSubscription } from '@/lib/billing/db'
import { getPlanById, isTrialActive } from '@/lib/subscription/helpers'
import type { SubscriptionState, PlanId } from '@/lib/subscription/types'

export interface OptimizationAccessGrant {
  ok: true
  user: AuthenticatedUser
  subscription: SubscriptionState
  isPremium: boolean
}

export interface OptimizationAccessDenial {
  ok: false
  response: NextResponse
}

export type OptimizationAccessResult = OptimizationAccessGrant | OptimizationAccessDenial

function deny(status: number, error: string, message: string): OptimizationAccessDenial {
  return {
    ok: false,
    response: NextResponse.json({ ok: false, error, message }, { status }),
  }
}

/**
 * Server-side gate for optimization endpoints.
 *
 * Mirrors the client-side `canUseOptimizationAI` guard so a user who
 * bypasses the UI (direct fetch, curl) still hits the same wall.
 *
 * Allows access for:
 *   - active paid plans where `includesOptimization === true`
 *   - users still inside their trial window on such a plan
 */
export async function requireOptimizationAccess(): Promise<OptimizationAccessResult> {
  const user = await getCurrentUser()
  if (!user) {
    return deny(401, 'unauthenticated', 'Oturum bulunamadı.')
  }

  const sub = await getSubscription(user.id)
  if (!sub) {
    return deny(403, 'no_subscription', 'Optimizasyon için aktif bir abonelik gerekli.')
  }

  const subscription: SubscriptionState = {
    planId: sub.plan_id as PlanId,
    status: sub.status,
    billingCycle: sub.billing_cycle,
    startDate: sub.started_at,
    trialEndDate: sub.trial_end_date,
    currentPeriodEnd: sub.current_period_end,
  }

  const plan = getPlanById(subscription.planId)
  if (!plan?.includesOptimization) {
    return deny(403, 'plan_required', 'Mevcut planınız optimizasyon özelliğini kapsamıyor.')
  }

  const active = subscription.status === 'active'
  const trial = subscription.status === 'trial' && isTrialActive(subscription)
  if (!active && !trial) {
    return deny(403, 'subscription_inactive', 'Aboneliğiniz aktif değil.')
  }

  const isPremium =
    subscription.planId === 'premium' || subscription.planId === 'enterprise'

  return { ok: true, user, subscription, isPremium }
}
