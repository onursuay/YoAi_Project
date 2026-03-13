/**
 * Meta /minimum_budgets — tek kaynak.
 *
 * Minimum günlük bütçeyi Meta API'den çeker, 2 % tampon uygular,
 * 1 USD floor ile karşılaştırır ve TRY cinsinden döner.
 *
 * Cache key: adAccountId : currency : objective : optimizationGoal : bidMode
 * TTL: 15 dakika
 *
 * Hardcode fallback yoktur. Meta'dan geçerli değer alınamazsa ok:false döner.
 */
import type { MetaGraphClient } from './client'
import { getCurrencyMinorUnitFactor } from './currency'

// ── Optimization goal → Meta minimum_budgets field ──
const GOAL_TO_FIELD: Record<string, string> = {
  LINK_CLICKS: 'min_daily_budget_high_freq',
  LANDING_PAGE_VIEWS: 'min_daily_budget_high_freq',
  IMPRESSIONS: 'min_daily_budget_imp',
  REACH: 'min_daily_budget_imp',
  POST_ENGAGEMENT: 'min_daily_budget_high_freq',
  THRUPLAY: 'min_daily_budget_video_views',
  LEAD_GENERATION: 'min_daily_budget_low_freq',
  CONVERSATIONS: 'min_daily_budget_low_freq',
  REPLIES: 'min_daily_budget_low_freq',
  OFFSITE_CONVERSIONS: 'min_daily_budget_low_freq',
  VALUE: 'min_daily_budget_low_freq',
  APP_INSTALLS: 'min_daily_budget_low_freq',
  AD_RECALL_LIFT: 'min_daily_budget_imp',
  QUALITY_LEAD: 'min_daily_budget_low_freq',
}

const FIELDS =
  'currency,min_daily_budget_high_freq,min_daily_budget_imp,min_daily_budget_low_freq,min_daily_budget_video_views'

interface MetaMinBudgetData {
  currency?: string
  min_daily_budget_high_freq?: number | string
  min_daily_budget_imp?: number | string
  min_daily_budget_low_freq?: number | string
  min_daily_budget_video_views?: number | string
}

// ── In-memory cache (15 min TTL) ──
interface CacheEntry {
  minDailyBudgetTry: number
  ts: number
}
const CACHE_TTL = 15 * 60 * 1000
const cache = new Map<string, CacheEntry>()

export interface GetMinDailyBudgetTryParams {
  client: MetaGraphClient
  adAccountId: string
  /** Meta ad account currency (e.g. "TRY", "USD", "AED"). Used in cache key. */
  currency: string
  /** Campaign objective (e.g. "OUTCOME_TRAFFIC"). Used in cache key. */
  objective: string
  optimizationGoal?: string
  /** "auto" | "cap" — included in cache key for safety. */
  bidMode?: string
  /** 1 adCurrency = fxRate TRY  (1 for TRY accounts) */
  fxRate: number
  /** 1 USD = usdTryRate TRY — used for 1 USD floor rule */
  usdTryRate: number
}

/**
 * Returns minimum daily budget in TRY. **No hardcoded fallback.**
 *
 * Steps:
 * 1. Fetch Meta /{adAccountId}/minimum_budgets → metaMinRaw (minor unit)
 * 2. metaMinMain = metaMinRaw / minorUnitFactor
 * 3. metaMinTry  = metaMinMain × fxRate
 * 4. metaMinTryBuffered = ceil(metaMinTry × 1.02 × 100) / 100
 * 5. usdFloorTryBuffered = ceil(usdTryRate × 1.02 × 100) / 100
 * 6. finalMinTry = max(metaMinTryBuffered, usdFloorTryBuffered)
 */
export async function getMinDailyBudgetTry({
  client,
  adAccountId,
  currency,
  objective,
  optimizationGoal = 'LINK_CLICKS',
  bidMode = 'auto',
  fxRate,
  usdTryRate,
}: GetMinDailyBudgetTryParams): Promise<
  { ok: true; minDailyBudgetTry: number } | { ok: false; error: string }
> {
  // ── Cache lookup ──
  const cacheKey = `minBudget:${adAccountId}:${currency}:${objective}:${optimizationGoal}:${bidMode}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    console.info(
      `[MinBudget] Cache hit: ${cacheKey} → ${cached.minDailyBudgetTry} TRY (age ${Math.round((Date.now() - cached.ts) / 1000)}s)`,
    )
    return { ok: true, minDailyBudgetTry: cached.minDailyBudgetTry }
  }

  try {
    const path = `/${adAccountId}/minimum_budgets`
    const res = await client.get<{ data?: MetaMinBudgetData[] }>(path, { fields: FIELDS })

    if (!res.ok) {
      console.error(`[MinBudget] Meta API error for ${adAccountId}:`, res.error?.message)
      return { ok: false, error: res.error?.message ?? 'meta_api_error' }
    }

    const metaMinResponse = Array.isArray(res.data?.data)
      ? res.data.data[0]
      : (res.data as unknown as MetaMinBudgetData)
    if (!metaMinResponse || typeof metaMinResponse !== 'object') {
      console.error(`[MinBudget] Empty/invalid response for ${adAccountId}`)
      return { ok: false, error: 'empty_response' }
    }

    const currencyFromMeta =
      typeof metaMinResponse.currency === 'string' ? metaMinResponse.currency : currency

    // ── Log 1: inputs ──
    console.info('[MinBudget] inputs', {
      adAccountId,
      currency,
      objective,
      optimizationGoal,
      bidMode,
      currencyFromMeta,
      fxRate,
      usdTryRate,
      rawMetaMinResponseKeys: Object.keys(metaMinResponse),
      rawMetaMinResponseSample: {
        currency: metaMinResponse.currency,
        min_daily_budget_high_freq: metaMinResponse.min_daily_budget_high_freq,
        min_daily_budget_imp: metaMinResponse.min_daily_budget_imp,
        min_daily_budget_low_freq: metaMinResponse.min_daily_budget_low_freq,
        min_daily_budget_video_views: metaMinResponse.min_daily_budget_video_views,
      },
    })

    // ── Pick the right field ──
    const fieldKey = GOAL_TO_FIELD[optimizationGoal] ?? 'min_daily_budget_high_freq'
    const metaMinRaw = (metaMinResponse as Record<string, unknown>)[fieldKey]
    const metaMinRawNum =
      typeof metaMinRaw === 'number'
        ? metaMinRaw
        : typeof metaMinRaw === 'string'
          ? Number(metaMinRaw)
          : undefined

    if (metaMinRawNum == null || !Number.isFinite(metaMinRawNum) || metaMinRawNum <= 0) {
      console.error(
        `[MinBudget] Invalid min value: field=${fieldKey} value=${metaMinRaw} type=${typeof metaMinRaw}`,
      )
      return { ok: false, error: 'invalid_min_value' }
    }

    // ── Step 2: minor unit → main unit ──
    const factor = getCurrencyMinorUnitFactor(currencyFromMeta)
    const metaMinMain = metaMinRawNum / factor

    // ── Step 3: → TRY ──
    const metaMinTry = metaMinMain * fxRate

    // ── Step 4: +2 % buffer ──
    const metaMinTryBuffered = Math.ceil(metaMinTry * 1.02 * 100) / 100

    // ── Step 5: 1 USD floor +2 % buffer ──
    const usdFloorTryBuffered = Math.ceil(usdTryRate * 1.02 * 100) / 100

    // ── Step 6: final ──
    const finalMinTry = Math.max(metaMinTryBuffered, usdFloorTryBuffered)

    // ── Log 2: computed ──
    console.info('[MinBudget] computed', {
      cacheKey,
      fieldKey,
      metaMinRaw: metaMinRawNum,
      metaMinRawIsMinorUnit: true,
      minorUnitFactor: factor,
      metaMinMain,
      metaMinTry,
      metaMinTryBuffered,
      usdTryRateUsed: usdTryRate,
      usdFloorTryBuffered,
      finalMinTry,
    })

    // ── Cache ──
    cache.set(cacheKey, { minDailyBudgetTry: finalMinTry, ts: Date.now() })

    return { ok: true, minDailyBudgetTry: finalMinTry }
  } catch (err) {
    console.error('[MinBudget] Unexpected error:', err instanceof Error ? err.message : err)
    return { ok: false, error: 'unexpected_error' }
  }
}
