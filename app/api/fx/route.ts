import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/fx?base=AED&quote=TRY
 * Returns exchange rate from base to quote currency.
 * Uses exchangerate.host + open.er-api.com with 15-minute in-memory cache.
 * Env fallback (FX_AED_TRY) only in non-production.
 */

const IS_PROD = process.env.NODE_ENV === 'production'

interface CacheEntry {
  rate: number
  asOf: string
  ts: number
}

const CACHE_TTL = 15 * 60 * 1000 // 15 minutes
const cache = new Map<string, CacheEntry>()

/** Validate that a rate value is a finite positive number */
function isValidRate(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}

async function fetchRate(base: string, quote: string): Promise<{ rate: number; asOf: string } | null> {
  // If same currency, rate is 1
  if (base === quote) return { rate: 1, asOf: new Date().toISOString() }

  const cacheKey = `${base}_${quote}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { rate: cached.rate, asOf: cached.asOf }
  }

  // Try exchangerate.host first
  try {
    const url = `https://api.exchangerate.host/convert?from=${base}&to=${quote}&amount=1`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const data = await res.json()
      if (data.success !== false && isValidRate(data.result)) {
        const entry: CacheEntry = { rate: data.result, asOf: new Date().toISOString(), ts: Date.now() }
        cache.set(cacheKey, entry)
        return { rate: entry.rate, asOf: entry.asOf }
      }
    }
  } catch (err) {
    console.error(`[FX] exchangerate.host failed ${base}/${quote}: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  // Fallback: open.er-api.com (free, no key)
  try {
    const url = `https://open.er-api.com/v6/latest/${base}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const data = await res.json()
      if (data.result === 'success' && data.rates && isValidRate(data.rates[quote])) {
        const rate = data.rates[quote]
        const entry: CacheEntry = { rate, asOf: data.time_last_update_utc || new Date().toISOString(), ts: Date.now() }
        cache.set(cacheKey, entry)
        return { rate: entry.rate, asOf: entry.asOf }
      }
    }
  } catch (err) {
    console.error(`[FX] open.er-api.com failed ${base}/${quote}: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  // Env fallback: FX_{BASE}_{QUOTE} e.g. FX_AED_TRY=9.5 — ONLY in non-production
  if (!IS_PROD) {
    const envKey = `FX_${base}_${quote}`
    const envVal = process.env[envKey]
    if (envVal) {
      const n = Number(envVal)
      if (isValidRate(n)) {
        console.error(`[FX] Using env fallback ${envKey}=${n} (non-prod only)`)
        const entry: CacheEntry = { rate: n, asOf: 'env-fallback', ts: Date.now() }
        cache.set(cacheKey, entry)
        return { rate: n, asOf: 'env-fallback' }
      }
    }
  }

  // Return stale cache if available
  if (cached) return { rate: cached.rate, asOf: cached.asOf }

  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const base = (searchParams.get('base') || '').toUpperCase().trim()
  const quote = (searchParams.get('quote') || 'TRY').toUpperCase().trim()

  if (!base) {
    return NextResponse.json({ ok: false, error: 'base parameter required' }, { status: 400 })
  }

  const result = await fetchRate(base, quote)
  if (!result) {
    return NextResponse.json({ ok: false, error: 'rate_unavailable' })
  }

  // Final guard: never return an invalid rate
  if (!isValidRate(result.rate)) {
    return NextResponse.json({ ok: false, error: 'rate_invalid' })
  }

  return NextResponse.json({
    ok: true,
    base,
    quote,
    rate: result.rate,
    asOf: result.asOf,
  })
}
