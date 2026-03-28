/**
 * Shared Google OAuth helpers for Analytics and Search Console.
 * Reuses the same GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET as Google Ads.
 */

import { GOOGLE_TOKEN_URL, RETRY } from './constants'

export interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured')
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || 'Token exchange failed')
  }
  return data as GoogleTokenResponse
}

/**
 * Refresh access token using refresh_token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
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
    throw new Error(data?.error_description || data?.error || 'Failed to refresh access token')
  }
  return data.access_token
}

/**
 * Fetch with exponential backoff retry on 429 / 5xx.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = RETRY.MAX_RETRIES
): Promise<Response> {
  let lastError: Error = new Error('fetchWithRetry failed')
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, init)
    if (res.ok) return res
    if (res.status === 429 || res.status >= 500) {
      lastError = new Error(`HTTP ${res.status}`)
      const delay = Math.pow(2, i) * RETRY.BASE_DELAY_MS + Math.random() * RETRY.JITTER_MS
      await new Promise((r) => setTimeout(r, delay))
      continue
    }
    return res
  }
  throw lastError
}
