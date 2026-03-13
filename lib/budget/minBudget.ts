/**
 * Minimum daily budget helpers.
 * Rule: min daily budget = 1 USD in TRY, safe rate (ceil).
 */

/**
 * Returns the minimum daily budget in TRY for a given USD/TRY exchange rate.
 * Uses Math.ceil(usdTryRate * 1) for a single integer minimum (e.g. 44 TRY).
 */
export function getMinDailyBudgetTRY(opts: { usdTryRate: number }): number {
  return Math.ceil(opts.usdTryRate * 1)
}

/**
 * Reads NEXT_PUBLIC_USD_TRY_RATE from env with robust parsing.
 * Parsing: trim, replace comma with dot, keep only numeric chars.
 * Returns null (and console.warn) when missing or invalid — callers should suppress the warning.
 */
export function getUsdTryRate(): number | null {
  const raw = (process.env.NEXT_PUBLIC_USD_TRY_RATE ?? '').trim()
  if (!raw) {
    console.warn('[minBudget] NEXT_PUBLIC_USD_TRY_RATE is not set — min-budget warning suppressed')
    return null
  }
  const normalized = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const v = Number(normalized)
  if (Number.isNaN(v) || v <= 0) {
    console.warn(`[minBudget] NEXT_PUBLIC_USD_TRY_RATE is invalid ("${raw}") — min-budget warning suppressed`)
    return null
  }
  return v
}
