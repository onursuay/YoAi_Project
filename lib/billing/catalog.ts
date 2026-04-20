/**
 * Server-only billing catalog — single source of truth for all monetary values.
 *
 * WARNING: Nothing here may be computed from client input. The start endpoint
 * receives only `planId` / `packageId` / `billingCycle` / `adAccounts` and
 * re-derives price, credits, and duration from these tables.
 */

import 'server-only'
import { getMonthlyPrice, getYearlyPrice } from '@/lib/subscription/plans'
import type { BillingCycle, PlanId } from '@/lib/subscription/types'

export interface PricedSubscription {
  planId: PlanId
  billingCycle: BillingCycle
  adAccounts: number
  amount: number
  currency: 'TRY'
  periodDays: number
  trialDays: number
  bundledCredits: number
}

export interface PricedCreditPack {
  packageId: string
  credits: number
  amount: number
  currency: 'TRY'
}

const SUBSCRIPTION_PLAN_IDS: PlanId[] = ['basic', 'starter', 'premium']

const BUNDLED_CREDITS: Record<string, number> = {
  basic: 20,
  starter: 60,
  premium: 100,
}

const TRIAL_DAYS: Record<string, number> = {
  basic: 0,
  starter: 0,
  premium: 14,
}

const CREDIT_PACKAGES: Record<string, { credits: number; amount: number }> = {
  'pkg-100':  { credits: 100,  amount: 49 },
  'pkg-500':  { credits: 500,  amount: 199 },
  'pkg-1000': { credits: 1000, amount: 349 },
}

/**
 * Price a subscription purchase. Returns null for unsupported plans
 * (free is not purchasable; enterprise is contact-sales only).
 */
export function priceSubscription(
  planId: string,
  billingCycle: string,
  adAccountsRaw: number | undefined,
): PricedSubscription | null {
  if (!SUBSCRIPTION_PLAN_IDS.includes(planId as PlanId)) return null
  if (billingCycle !== 'monthly' && billingCycle !== 'yearly') return null

  const adAccounts = Math.max(2, Math.min(50, Math.floor(adAccountsRaw ?? 2)))
  const amount = billingCycle === 'monthly'
    ? getMonthlyPrice(planId, adAccounts)
    : getYearlyPrice(planId, adAccounts)

  if (!amount || amount <= 0) return null

  return {
    planId: planId as PlanId,
    billingCycle: billingCycle as BillingCycle,
    adAccounts,
    amount,
    currency: 'TRY',
    periodDays: billingCycle === 'monthly' ? 30 : 365,
    trialDays: TRIAL_DAYS[planId] ?? 0,
    bundledCredits: BUNDLED_CREDITS[planId] ?? 0,
  }
}

export function priceCreditPack(packageId: string): PricedCreditPack | null {
  const pkg = CREDIT_PACKAGES[packageId]
  if (!pkg) return null
  return {
    packageId,
    credits: pkg.credits,
    amount: pkg.amount,
    currency: 'TRY',
  }
}
