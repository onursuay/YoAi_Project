/**
 * Google Ads OAuth helpers. Provider: google_ads. Separate from Meta.
 * All Google Ads API requests must use:
 * - Authorization: Bearer <access_token>
 * - developer-token
 * - login-customer-id (when access is via manager; from google_ads_login_customer_id)
 * Path: /customers/{google_ads_customer_id}/googleAds:search (or searchStream)
 */

import {
  GOOGLE_ADS_BASE as CONSTANTS_BASE,
  GOOGLE_TOKEN_URL,
  COOKIE,
  MAX_SEARCH_ROWS,
  RETRY,
} from '@/lib/google-ads/constants'
import { extractGoogleAdsError } from '@/lib/google-ads/errors'

export interface GoogleAdsTokens {
  accessToken: string
  refreshToken?: string
}

export interface GoogleAdsRequestContext {
  accessToken: string
  customerId: string
  loginCustomerId: string
  /** UI locale — used for Accept-Language header (e.g. 'tr', 'en') */
  locale?: string
}

/**
 * Exchange refresh_token for access_token. Uses GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
 */
export async function getGoogleAdsAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured')
  }

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  })

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || 'Failed to get access token')
  }
  return data.access_token
}

/**
 * Build headers for Google Ads API requests (search, searchStream, etc.).
 * Use with customerId in path: /customers/{customerId}/googleAds:search
 */
export function buildGoogleAdsHeaders(ctx: GoogleAdsRequestContext): Record<string, string> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!developerToken) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not configured')
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${ctx.accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  }
  if (ctx.loginCustomerId && ctx.loginCustomerId !== ctx.customerId) {
    headers['login-customer-id'] = ctx.loginCustomerId
  }
  // Send locale so Google returns localized resource names (user_interest, etc.)
  if (ctx.locale) {
    headers['Accept-Language'] = ctx.locale
  }
  return headers
}

import { cookies } from 'next/headers'

export const GOOGLE_ADS_BASE = CONSTANTS_BASE

export async function getGoogleAdsContext(): Promise<GoogleAdsRequestContext> {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get(COOKIE.REFRESH_TOKEN)?.value
  const customerId = cookieStore.get(COOKIE.CUSTOMER_ID)?.value
  const loginCustomerId = cookieStore.get(COOKIE.LOGIN_CUSTOMER_ID)?.value ?? customerId
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr'
  if (!refreshToken) throw Object.assign(new Error('Google Ads bağlı değil'), { status: 401 })
  if (!customerId) throw Object.assign(new Error('Google Ads hesabı seçilmedi'), { status: 401 })
  const accessToken = await getGoogleAdsAccessToken(refreshToken)
  return { accessToken, customerId: customerId.replace(/-/g, ''), loginCustomerId: (loginCustomerId ?? customerId).replace(/-/g, ''), locale }
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

export async function googleAdsRequest<T>(
  endpoint: string,
  ctx: GoogleAdsRequestContext,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetchWithRetry(`${GOOGLE_ADS_BASE}${endpoint}`, {
    method: options.method ?? 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) {
    const detail = (data?.error?.details as Array<Record<string, unknown>> | undefined)
      ?.find((d) => (d?.errors as Array<Record<string, unknown>> | undefined)?.[0]?.errorCode &&
        ((d.errors as Array<Record<string, unknown>>)[0].errorCode as Record<string, unknown>)?.budgetError === 'BUDGET_BELOW_DAILY_MINIMUM_ERROR_DETAILS')
    if (detail) throw Object.assign(new Error('Günlük bütçe minimumun altında'), { status: 400, detail })
    throw new Error(extractGoogleAdsError(data as Record<string, unknown>))
  }
  return data as T
}

export async function searchGAds<T>(ctx: GoogleAdsRequestContext, query: string, options?: { maxRows?: number; pageSize?: number }): Promise<T[]> {
  const maxRows = options?.maxRows ?? MAX_SEARCH_ROWS
  const results: T[] = []
  let pageToken: string | undefined
  do {
    const body: Record<string, unknown> = { query }
    if (options?.pageSize) body.pageSize = options.pageSize
    if (pageToken) body.pageToken = pageToken
    const res = await fetchWithRetry(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/googleAds:search`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('GAQL Error Detail:', JSON.stringify(data?.error?.details ?? data, null, 2))
      const message = extractGoogleAdsError(data as Record<string, unknown>)
      const err = new Error(message) as Error & { googleError?: unknown; status?: number }
      err.googleError = data
      err.status = res.status
      throw err
    }
    if (data.results) results.push(...data.results)
    pageToken = data.nextPageToken
  } while (pageToken && results.length < maxRows)
  return results
}
