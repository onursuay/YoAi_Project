import type { SubscriptionState, PlanId } from './types'
import { SUBSCRIPTION_PLANS } from './plans'

export function getPlanById(planId: PlanId) {
  return SUBSCRIPTION_PLANS.find(p => p.id === planId)
}

export function isPaidSubscription(sub: SubscriptionState): boolean {
  return sub.status === 'active' && sub.planId !== 'free'
}

export function isTrialActive(sub: SubscriptionState): boolean {
  if (sub.status !== 'trial' || !sub.trialEndDate) return false
  return new Date(sub.trialEndDate) > new Date()
}

export function getTrialDaysRemaining(sub: SubscriptionState): number {
  if (!sub.trialEndDate) return 0
  const diff = new Date(sub.trialEndDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function canUseOptimization(sub: SubscriptionState): boolean {
  if (sub.status !== 'active') return false
  const plan = getPlanById(sub.planId)
  return !!plan?.includesOptimization
}

export function getAiScanDailyLimit(sub: SubscriptionState): number {
  const plan = getPlanById(sub.planId)
  return plan?.aiScanDailyLimit ?? 0
}

export function hasActiveSubscription(sub: SubscriptionState): boolean {
  return sub.status === 'active' || isTrialActive(sub)
}

export function getStrategyMonthlyLimit(sub: SubscriptionState): number {
  const plan = getPlanById(sub.planId)
  return plan?.strategyMonthlyLimit ?? 0
}
