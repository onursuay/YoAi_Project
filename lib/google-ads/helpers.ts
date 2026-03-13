/**
 * Shared utility helpers for Google Ads API route handlers.
 */

/** Safe number coercion — returns 0 for null/undefined/NaN. */
export function num(v: unknown): number {
  if (v === null || v === undefined) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Read a metric value from a Google Ads API row's metrics object.
 * Handles both camelCase (API JSON default) and snake_case variants.
 */
export function getMetric(m: Record<string, unknown> | undefined | null, key: string): number {
  if (!m) return 0
  const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
  return num(m[camel] ?? m[key])
}

/** Convert micros (1 unit = 1,000,000 micros) to currency units. */
export function microsToUnits(micros: number): number {
  return micros / 1_000_000
}

/** Default date range: last 30 days ending today (YYYY-MM-DD). */
export function getDefaultDateRange(): { from: string; to: string } {
  const today = new Date()
  const to = today.toISOString().split('T')[0]
  const from = new Date(today)
  from.setDate(from.getDate() - 30)
  return { from: from.toISOString().split('T')[0], to }
}

/** Compute standard derived metrics from aggregated raw values. */
export function computeDerivedMetrics(agg: {
  costMicros: number
  clicks: number
  impressions: number
  conversionsValue: number
}): { amountSpent: number; cpc: number; ctr: number; roas: number | null } {
  const amountSpent = microsToUnits(agg.costMicros)
  const cpc = agg.clicks > 0 ? amountSpent / agg.clicks : 0
  const ctr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0
  const roas: number | null =
    amountSpent > 0 && agg.conversionsValue > 0 ? agg.conversionsValue / amountSpent : null
  return { amountSpent, cpc, ctr, roas }
}
