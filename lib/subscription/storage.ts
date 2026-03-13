import {
  type CreditState,
  type SubscriptionState,
  type UserProfile,
  type InvoiceInfo,
  type InvoiceRecord,
  type AiScanUsage,
  type StrategyUsage,
  CREDIT_DEFAULTS,
  SUBSCRIPTION_DEFAULTS,
  USER_DEFAULTS,
} from './types'

const KEYS = {
  credits: 'yoai-credits',
  subscription: 'yoai-subscription',
  profile: 'yoai-profile',
  invoiceInfo: 'yoai-invoice-info',
  invoiceHistory: 'yoai-invoice-history',
  aiScanUsage: 'yoai-ai-scan-usage',
  strategyUsage: 'yoai-strategy-usage',
} as const

function get<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function set<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* quota exceeded */ }
}

// ── Credits ────────────────────────────────────────────────────
export function getStoredCredits(): CreditState {
  return get(KEYS.credits, CREDIT_DEFAULTS)
}

export function setStoredCredits(state: CreditState): void {
  set(KEYS.credits, state)
}

// ── Subscription ───────────────────────────────────────────────
export function getStoredSubscription(): SubscriptionState {
  return get(KEYS.subscription, SUBSCRIPTION_DEFAULTS)
}

export function setStoredSubscription(state: SubscriptionState): void {
  set(KEYS.subscription, state)
}

// ── Profile ────────────────────────────────────────────────────
export function getStoredProfile(): UserProfile {
  return get(KEYS.profile, USER_DEFAULTS)
}

export function setStoredProfile(profile: UserProfile): void {
  set(KEYS.profile, profile)
}

// ── Invoice Info ───────────────────────────────────────────────
export function getStoredInvoiceInfo(): InvoiceInfo | null {
  return get<InvoiceInfo | null>(KEYS.invoiceInfo, null)
}

export function setStoredInvoiceInfo(info: InvoiceInfo): void {
  set(KEYS.invoiceInfo, info)
}

// ── Invoice History ────────────────────────────────────────────
export function getStoredInvoiceHistory(): InvoiceRecord[] {
  return get<InvoiceRecord[]>(KEYS.invoiceHistory, [])
}

export function addInvoiceRecord(record: InvoiceRecord): void {
  const history = getStoredInvoiceHistory()
  set(KEYS.invoiceHistory, [record, ...history])
}

// ── AI Scan Usage ──────────────────────────────────────────────
export function getAiScanUsage(): AiScanUsage {
  const today = new Date().toISOString().split('T')[0]
  const stored = get<AiScanUsage>(KEYS.aiScanUsage, { date: today, count: 0 })
  // Reset count if it's a new day
  if (stored.date !== today) {
    return { date: today, count: 0 }
  }
  return stored
}

export function incrementAiScanUsage(): AiScanUsage {
  const usage = getAiScanUsage()
  const updated = { ...usage, count: usage.count + 1 }
  set(KEYS.aiScanUsage, updated)
  return updated
}

// ── Strategy Usage ──────────────────────────────────────────
export function getStrategyUsage(): StrategyUsage {
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  const stored = get<StrategyUsage>(KEYS.strategyUsage, { month: currentMonth, count: 0 })
  // Reset count if it's a new month
  if (stored.month !== currentMonth) {
    return { month: currentMonth, count: 0 }
  }
  return stored
}

export function incrementStrategyUsage(): StrategyUsage {
  const usage = getStrategyUsage()
  const updated = { ...usage, count: usage.count + 1 }
  set(KEYS.strategyUsage, updated)
  return updated
}
