import type { SubscriptionPlan, CreditPackage } from './types'

/**
 * Monthly prices indexed by ad account count.
 * Prices are in USD.
 */
const ACCOUNT_PRICES: Record<string, Record<number, number>> = {
  basic:   { 2: 49, 3: 69, 4: 89, 5: 109 },
  starter: { 2: 99, 3: 139, 4: 189, 5: 229 },
  premium: { 2: 199, 3: 289, 4: 379, 5: 469 },
}

/** Per-extra-account cost for accounts beyond the lookup table */
const EXTRA_ACCOUNT_COST: Record<string, number> = {
  basic: 20,
  starter: 40,
  premium: 90,
}

/** Yearly discount multiplier (30% off) */
export const YEARLY_DISCOUNT = 0.70

/**
 * Get monthly price for a plan based on ad account count.
 */
export function getMonthlyPrice(planId: string, adAccounts: number): number {
  const prices = ACCOUNT_PRICES[planId]
  if (!prices) return 0

  if (prices[adAccounts] !== undefined) {
    return prices[adAccounts]
  }

  // Extrapolate for counts beyond the table
  const maxDefined = Math.max(...Object.keys(prices).map(Number))
  const basePrice = prices[maxDefined]
  const extra = adAccounts - maxDefined
  return basePrice + extra * (EXTRA_ACCOUNT_COST[planId] || 20)
}

/**
 * Get yearly price for a plan (30% discount).
 */
export function getYearlyPrice(planId: string, adAccounts: number): number {
  const monthly = getMonthlyPrice(planId, adAccounts)
  return Math.round(monthly * 12 * YEARLY_DISCOUNT * 100) / 100
}

/**
 * Get per-month price when billing yearly.
 */
export function getYearlyMonthlyPrice(planId: string, adAccounts: number): number {
  const yearly = getYearlyPrice(planId, adAccounts)
  return Math.round(yearly / 12 * 100) / 100
}

/** Feature lists matching each plan's capabilities */
const BASIC_FEATURES = [
  'Google Raporları',
  'Meta Raporları',
  'Google Reklamları',
  'Meta Hedef Kitle (AI)',
  'Meta Reklamları',
  '20 Tasarım Kredisi',
]

const STARTER_FEATURES = [
  'Optimizasyon',
  'Google Raporları',
  'Meta Raporları',
  'Google Reklamları',
  'Meta Hedef Kitle (AI)',
  'Meta Reklamları',
  '60 Tasarım Kredisi',
]

const PREMIUM_FEATURES = [
  'AI Strateji (AI)',
  'Optimizasyon',
  'Google Raporları',
  'Meta Raporları',
  'Google Reklamları',
  'Meta Reklamları',
  '100 Tasarım Kredisi',
]

const ENTERPRISE_FEATURES = [
  'AI Strateji (Sınırsız)',
  'Optimizasyon',
  'Meta Reklamları',
  'Google Reklamları',
  'Meta Raporları',
  'Google Raporları',
  'Tasarım',
]

/** Feature section titles per plan */
export const PLAN_SECTION_TITLES: Record<string, string> = {
  basic: 'Tek Panelden Yönetin',
  starter: 'Profesyonel Reklam Yönetimi',
  premium: 'Tek Tıkla Reklamcılık',
  enterprise: 'Sınırsız Reklam Gücü',
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    monthlyPrice: 49,
    yearlyPrice: 411.60,
    features: BASIC_FEATURES,
    adAccountLimit: 2,
    includesOptimization: false,
    aiScanDailyLimit: 3,
    strategyMonthlyLimit: 1,
    trialDays: 0,
  },
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 99,
    yearlyPrice: 831.60,
    features: STARTER_FEATURES,
    adAccountLimit: 2,
    includesOptimization: true,
    aiScanDailyLimit: 3,
    strategyMonthlyLimit: 3,
    trialDays: 0,
  },
  {
    id: 'premium',
    name: 'Premium',
    monthlyPrice: 199,
    yearlyPrice: 1671.60,
    features: PREMIUM_FEATURES,
    adAccountLimit: 2,
    includesOptimization: true,
    aiScanDailyLimit: 10,
    strategyMonthlyLimit: 10,
    trialDays: 14,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: ENTERPRISE_FEATURES,
    adAccountLimit: 6,
    includesOptimization: true,
    aiScanDailyLimit: -1,
    strategyMonthlyLimit: -1,
    trialDays: 14,
  },
]

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'pkg-100', credits: 100, price: 49, label: '100 Kredi' },
  { id: 'pkg-500', credits: 500, price: 199, label: '500 Kredi', popular: true },
  { id: 'pkg-1000', credits: 1000, price: 349, label: '1.000 Kredi' },
]
