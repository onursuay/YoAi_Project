// ── Credit System ──────────────────────────────────────────────
export interface CreditState {
  balance: number
  totalEarned: number
  totalSpent: number
  lastUpdated: string
}

export const CREDIT_DEFAULTS: CreditState = {
  balance: 100,
  totalEarned: 100,
  totalSpent: 0,
  lastUpdated: new Date().toISOString(),
}

export const COST_PER_GENERATION = 20
export const COST_PER_STRATEGY = 10
export const FREE_CREDITS = 100

// ── Credit Packages ────────────────────────────────────────────
export interface CreditPackage {
  id: string
  credits: number
  price: number
  label: string
  popular?: boolean
}

// ── Subscription System ────────────────────────────────────────
export type PlanId = 'free' | 'basic' | 'starter' | 'premium' | 'enterprise'
export type BillingCycle = 'monthly' | 'yearly'
export type SubscriptionStatus = 'trial' | 'active' | 'cancelled' | 'expired'

export interface SubscriptionPlan {
  id: PlanId
  name: string
  monthlyPrice: number
  yearlyPrice: number
  features: string[]
  adAccountLimit: number
  includesOptimization: boolean
  aiScanDailyLimit: number   // -1 = unlimited
  strategyMonthlyLimit: number // -1 = unlimited, 0 = no access
  trialDays: number
}

export interface SubscriptionState {
  planId: PlanId
  status: SubscriptionStatus
  billingCycle: BillingCycle
  startDate: string
  trialEndDate: string | null
  currentPeriodEnd: string
}

export const SUBSCRIPTION_DEFAULTS: SubscriptionState = {
  planId: 'free',
  status: 'trial',
  billingCycle: 'monthly',
  startDate: new Date().toISOString(),
  trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
}

// ── AI Scan Usage Tracking ─────────────────────────────────────
export interface AiScanUsage {
  date: string    // YYYY-MM-DD
  count: number
}

// ── Strategy Usage Tracking ──────────────────────────────────
export interface StrategyUsage {
  month: string   // YYYY-MM
  count: number
}

// ── User Profile ───────────────────────────────────────────────
export interface UserProfile {
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
  helpAccessEnabled: boolean
  referralCode: string
}

export const USER_DEFAULTS: UserProfile = {
  firstName: 'Onur',
  lastName: 'Şuay',
  email: '',
  avatarUrl: null,
  helpAccessEnabled: true,
  referralCode: 'YOAI-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
}

// ── Invoice System ─────────────────────────────────────────────
export type InvoiceType = 'individual' | 'corporate'

export interface InvoiceInfo {
  type: InvoiceType
  fullName: string
  phone: string
  country: string
  city: string
  district: string
  postalCode: string
  address: string
  companyName?: string
  taxOffice?: string
  taxNumber?: string
}

export interface InvoiceRecord {
  id: string
  date: string
  amount: number
  description: string
  status: 'paid' | 'pending'
}
