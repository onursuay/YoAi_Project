/**
 * TikTok Ads auth helpers. Provider: tiktok_ads.
 * TikTok Marketing API uses Access-Token header (not Bearer).
 * Access tokens are long-lived — no refresh token flow needed.
 */

import {
  TIKTOK_ADS_API_BASE,
  COOKIE,
  RETRY,
  LOG_EVENTS,
} from '@/lib/tiktok-ads/constants'

export interface TikTokRequestContext {
  accessToken: string
  advertiserId: string
  locale?: string
}

/**
 * Build headers for TikTok Marketing API requests.
 * Critical: TikTok uses Access-Token header, NOT Authorization: Bearer.
 */
export function buildTikTokHeaders(ctx: TikTokRequestContext): Record<string, string> {
  return {
    'Access-Token': ctx.accessToken,
    'Content-Type': 'application/json',
  }
}

/** Machine-readable error codes for TikTok context resolution */
export const TIKTOK_ERROR_CODES = {
  NOT_CONNECTED: 'tiktok_ads_not_connected',
  TOKEN_MISSING: 'tiktok_ads_token_missing',
  ACCOUNT_MISSING: 'tiktok_ads_account_missing',
} as const

function throwWithCode(msg: string, code: string, status = 401): never {
  throw Object.assign(new Error(msg), { status, code })
}

import { cookies } from 'next/headers'
import { getConnection, upsertConnection } from '@/lib/tiktokAdsConnectionStore'

/**
 * Resolve TikTok Ads context for current authenticated user.
 * Lookup order: 1) DB, 2) cookie (with one-time backfill), 3) throw.
 */
export async function getTikTokContext(): Promise<TikTokRequestContext> {
  const cookieStore = await cookies()
  const userId = cookieStore.get('session_id')?.value
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr'

  // 1) DB preferred
  if (userId) {
    const dbCtx = await getConnection(userId)
    if (dbCtx?.accessToken && dbCtx?.advertiserId) {
      return {
        accessToken: dbCtx.accessToken,
        advertiserId: dbCtx.advertiserId,
        locale,
      }
    }

    // 2) Cookie backfill: DB missing but cookie exists — persist once
    const cookieToken = cookieStore.get(COOKIE.ACCESS_TOKEN)?.value
    const cookieAdvertiserId = cookieStore.get(COOKIE.ADVERTISER_ID)?.value
    if (cookieToken && cookieAdvertiserId) {
      const backfilled = await upsertConnection(userId, {
        accessToken: cookieToken,
        advertiserId: cookieAdvertiserId,
      })
      if (backfilled) {
        console.log(LOG_EVENTS.DB_BACKFILL_OK, { userId: userId.slice(0, 8) + '…' })
        return {
          accessToken: cookieToken,
          advertiserId: cookieAdvertiserId,
          locale,
        }
      }
    }
  }

  // 3) Cookie fallback (no session / pre-migration)
  const accessToken = cookieStore.get(COOKIE.ACCESS_TOKEN)?.value
  const advertiserId = cookieStore.get(COOKIE.ADVERTISER_ID)?.value

  if (!accessToken) throwWithCode('TikTok Ads bağlı değil', TIKTOK_ERROR_CODES.NOT_CONNECTED)
  if (!advertiserId) throwWithCode('TikTok Ads hesabı seçilmedi', TIKTOK_ERROR_CODES.ACCOUNT_MISSING)

  return { accessToken, advertiserId, locale }
}

export async function fetchWithRetry(url: string, init: RequestInit, maxRetries = RETRY.MAX_RETRIES): Promise<Response> {
  let lastError: Error = new Error('fetchWithRetry failed')
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, init)
    if (res.ok) return res
    if (res.status === 429 || res.status >= 500) {
      lastError = new Error(`HTTP ${res.status}`)
      const delay = Math.pow(2, i) * RETRY.BASE_DELAY_MS + Math.random() * RETRY.JITTER_MS
      await new Promise(r => setTimeout(r, delay))
      continue
    }
    return res
  }
  throw lastError
}

/**
 * Generic TikTok API request helper.
 * All TikTok responses wrap in { code: 0, message: "OK", data: {...} }.
 * code !== 0 means error.
 */
export async function tiktokApiRequest<T>(
  endpoint: string,
  ctx: TikTokRequestContext,
  options: { method?: string; body?: unknown; params?: Record<string, string> } = {}
): Promise<T> {
  let url = `${TIKTOK_ADS_API_BASE}${endpoint}`
  if (options.params) {
    const qs = new URLSearchParams(options.params).toString()
    url += `?${qs}`
  }

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: buildTikTokHeaders(ctx),
  }
  if (options.body) {
    init.method = options.method ?? 'POST'
    init.body = JSON.stringify(options.body)
  }

  const res = await fetchWithRetry(url, init)
  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(json?.message || `TikTok API HTTP ${res.status}`)
  }

  if (json.code !== 0) {
    throw new Error(json.message || `TikTok API error code ${json.code}`)
  }

  return json.data as T
}
