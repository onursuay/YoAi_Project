/**
 * Centralized USD/TRY rate — single source for all flows.
 * - Origin/referer independent
 * - Env fallback: USD_TRY_RATE_OVERRIDE, USD_TRY_RATE_FALLBACK
 * - Deterministic 15-min cache
 * - Explicit warning when fallback used (never silently use 1)
 */

const CACHE_TTL_MS = 15 * 60 * 1000

interface CacheEntry {
  rate: number
  source: 'live' | 'override' | 'fallback'
  fetchedAt: string
  ts: number
}

let cache: CacheEntry | null = null

function parseEnvNumber(key: string): number | null {
  const raw = (process.env[key] ?? '').trim().replace(/,/g, '.')
  const n = Number(raw.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

async function fetchLiveUsdTry(): Promise<number | null> {
  try {
    const res = await fetch('https://api.exchangerate.host/convert?from=USD&to=TRY&amount=1', {
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.success !== false && typeof data.result === 'number' && data.result > 0) {
        return data.result
      }
    }
  } catch (e) {
    console.warn('[FX USD/TRY] exchangerate.host failed:', e instanceof Error ? e.message : e)
  }
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.result === 'success' && data.rates?.TRY != null && data.rates.TRY > 0) {
        return Number(data.rates.TRY)
      }
    }
  } catch (e) {
    console.warn('[FX USD/TRY] open.er-api.com failed:', e instanceof Error ? e.message : e)
  }
  return null
}

export interface GetUsdTryRateResult {
  ok: true
  rate: number
  source: 'live' | 'override' | 'fallback'
  fetchedAt: string
}

export interface GetUsdTryRateError {
  ok: false
  error: string
  warning?: string
}

/**
 * Returns USD/TRY rate. Deterministic, cache-aware, env fallback.
 * Never returns 1 silently — logs warning when fallback used.
 */
export async function getUsdTryRate(): Promise<
  GetUsdTryRateResult | GetUsdTryRateError
> {
  const override = parseEnvNumber('USD_TRY_RATE_OVERRIDE')
  if (override != null) {
    const fetchedAt = new Date().toISOString()
    return { ok: true, rate: override, source: 'override', fetchedAt }
  }

  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return {
      ok: true,
      rate: cache.rate,
      source: cache.source,
      fetchedAt: cache.fetchedAt,
    }
  }

  const live = await fetchLiveUsdTry()
  if (live != null) {
    cache = { rate: live, source: 'live', fetchedAt: new Date().toISOString(), ts: Date.now() }
    return { ok: true, rate: live, source: 'live', fetchedAt: cache.fetchedAt }
  }

  const fallback = parseEnvNumber('USD_TRY_RATE_FALLBACK')
  if (fallback != null) {
    console.warn(
      `[FX USD/TRY] Live rate unavailable — using USD_TRY_RATE_FALLBACK=${fallback}. Set env for deterministic behavior.`
    )
    cache = { rate: fallback, source: 'fallback', fetchedAt: new Date().toISOString(), ts: Date.now() }
    return { ok: true, rate: fallback, source: 'fallback', fetchedAt: cache.fetchedAt }
  }

  if (cache) {
    console.warn(
      `[FX USD/TRY] Live rate unavailable, no fallback — using stale cache ${cache.rate} (${Math.round((Date.now() - cache.ts) / 1000)}s old)`
    )
    return {
      ok: true,
      rate: cache.rate,
      source: cache.source,
      fetchedAt: cache.fetchedAt,
    }
  }

  console.error(
    '[FX USD/TRY] No rate available. Set USD_TRY_RATE_OVERRIDE or USD_TRY_RATE_FALLBACK for fallback.'
  )
  return {
    ok: false,
    error: 'rate_unavailable',
    warning: 'Set USD_TRY_RATE_OVERRIDE or USD_TRY_RATE_FALLBACK env for deterministic fallback.',
  }
}

/** Fetch base -> TRY rate (server-side, no origin). Used for accountCurrency -> TRY. */
async function fetchBaseToTry(base: string): Promise<number | null> {
  if (base === 'TRY') return 1
  if (base === 'USD') {
    const r = await getUsdTryRate()
    return r.ok ? r.rate : null
  }
  try {
    const res = await fetch(
      `https://api.exchangerate.host/convert?from=${base}&to=TRY&amount=1`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (res.ok) {
      const data = await res.json()
      if (data.success !== false && typeof data.result === 'number' && data.result > 0) {
        return data.result
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      signal: AbortSignal.timeout(6000),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.result === 'success' && data.rates?.TRY != null && data.rates.TRY > 0) {
        return Number(data.rates.TRY)
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

export interface FxRatesForMinBudget {
  ok: true
  fxRate: number
  usdTryRate: number
}

export interface FxRatesForMinBudgetError {
  ok: false
  error: string
}

/**
 * Returns fxRate (accountCurrency -> TRY) and usdTryRate for getMinDailyBudgetTry.
 * Origin-independent. Uses getUsdTryRate for USD/TRY; fetches base->TRY for other currencies.
 */
export async function getFxRatesForMinBudget(
  accountCurrency: string
): Promise<FxRatesForMinBudget | FxRatesForMinBudgetError> {
  const base = (accountCurrency || 'TRY').toUpperCase().trim()
  if (base === 'TRY') {
    const usd = await getUsdTryRate()
    if (!usd.ok) return { ok: false, error: usd.error }
    return { ok: true, fxRate: 1, usdTryRate: usd.rate }
  }
  if (base === 'USD') {
    const usd = await getUsdTryRate()
    if (!usd.ok) return { ok: false, error: usd.error }
    return { ok: true, fxRate: usd.rate, usdTryRate: usd.rate }
  }
  const usdTry = await getUsdTryRate()
  if (!usdTry.ok) return { ok: false, error: usdTry.error }
  const fxRate = await fetchBaseToTry(base)
  if (fxRate == null) {
    console.warn(`[FX] Could not fetch ${base}->TRY; assuming 1:1 (unreliable)`)
    return { ok: true, fxRate: 1, usdTryRate: usdTry.rate }
  }
  return { ok: true, fxRate, usdTryRate: usdTry.rate }
}
