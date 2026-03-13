/**
 * Page Access Token resolver — optimised for minimum Graph API calls.
 *
 * Priority (cheapest first):
 *   A) GET /{pageId}?fields=access_token   — 1 call, works for pages the user owns
 *   B) GET /me/accounts with paging        — max 3 pages (300 entries), early exit on match
 *
 * Throws PageTokenError on failure (never returns null).
 * Token is NEVER logged or returned to the client — only last-4 fingerprint.
 */

import { META_BASE_URL } from '@/lib/metaConfig'

const META_DEBUG = process.env.META_DEBUG === 'true'

// ── In-process cache ─────────────────────────────────────────────────────────
const pageTokenCache = new Map<string, { token: string; source: PageTokenSource; expiresAt: number }>()
const PAGE_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

// ── Types ─────────────────────────────────────────────────────────────────────

export type PageTokenSource = 'direct_page' | 'me_accounts'

export type PageTokenErrorKind = 'meta_rate_limited' | 'oauth_invalid' | 'page_token_not_found'

export interface PageTokenError {
  kind: PageTokenErrorKind
  code?: number
  fbtrace_id?: string
  message?: string
}

export interface PageTokenResult {
  pageToken: string
  last4: string
  /** Which path produced the token — propagated to IG verify debug */
  source: PageTokenSource
}

// ── Response shapes ───────────────────────────────────────────────────────────

interface DirectPageResponse {
  id?: string
  access_token?: string
  error?: { code?: number; message?: string; fbtrace_id?: string; type?: string }
}

interface AccountEntry { id: string; access_token?: string }

interface AccountsPageResponse {
  data?: AccountEntry[]
  error?: { code?: number; message?: string; fbtrace_id?: string }
  paging?: { cursors?: { after?: string }; next?: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRateLimit(code?: number): boolean {
  return code === 4 || code === 32
}

function isOAuthError(code?: number, type?: string): boolean {
  return code === 190 || code === 200 || type === 'OAuthException'
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Returns a Page Access Token for `pageId`.
 * Throws `PageTokenError` on any unrecoverable error.
 * Never returns null.
 */
export async function getPageAccessToken(
  userAccessToken: string,
  pageId: string
): Promise<PageTokenResult> {
  const userLast4 = userAccessToken.slice(-4)
  const cacheKey = `${userLast4}:${pageId}`

  // ── In-process cache hit ──────────────────────────────────────────────────
  const cached = pageTokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    if (META_DEBUG) {
      console.log('[PageToken] CACHE HIT', { pageId, user_last4: userLast4, page_last4: cached.token.slice(-4), source: cached.source })
    }
    return { pageToken: cached.token, last4: cached.token.slice(-4), source: cached.source }
  }

  // ── A) Direct page endpoint (cheapest — 1 call) ───────────────────────────
  try {
    const res = await fetch(`${META_BASE_URL}/${pageId}?fields=access_token&access_token=${userAccessToken}`)
    const body = (await res.json()) as DirectPageResponse

    if (body.error) {
      const { code, message, fbtrace_id, type } = body.error
      if (isRateLimit(code)) {
        if (META_DEBUG || true) console.warn('[PageToken] direct /{pageId} rate_limit', { code, fbtrace_id })
        throw { kind: 'meta_rate_limited', code, fbtrace_id, message } as PageTokenError
      }
      if (isOAuthError(code, type)) {
        if (META_DEBUG) console.warn('[PageToken] direct /{pageId} oauth_invalid', { code, fbtrace_id })
        throw { kind: 'oauth_invalid', code, fbtrace_id, message } as PageTokenError
      }
      // Permission denied / page not found / other → fall through to /me/accounts
      if (META_DEBUG) console.log('[PageToken] direct /{pageId} non-fatal error, trying /me/accounts', { code, message })
    } else if (body.access_token) {
      const pageToken = body.access_token
      const result: PageTokenResult = { pageToken, last4: pageToken.slice(-4), source: 'direct_page' }
      pageTokenCache.set(cacheKey, { token: pageToken, source: 'direct_page', expiresAt: Date.now() + PAGE_TOKEN_TTL_MS })
      if (META_DEBUG) console.log('[PageToken] resolved via direct /{pageId}', { pageId, user_last4: userLast4, page_last4: result.last4 })
      return result
    }
    // No access_token field → fall through to /me/accounts
    if (META_DEBUG) console.log('[PageToken] direct /{pageId} no access_token in response, trying /me/accounts', { pageId })
  } catch (err) {
    // Re-throw PageTokenError (rate-limit / oauth); swallow network errors
    if (err && typeof err === 'object' && 'kind' in err) throw err
    if (META_DEBUG) console.warn('[PageToken] direct /{pageId} fetch error, trying /me/accounts', err)
  }

  // ── B) /me/accounts with paging (max 3 pages = 300 entries, early exit) ───
  const MAX_PAGES = 3
  let nextUrl: string | null =
    `${META_BASE_URL}/me/accounts?fields=id,access_token&limit=500&access_token=${userAccessToken}`
  let pagesChecked = 0

  while (nextUrl && pagesChecked < MAX_PAGES) {
    pagesChecked++
    let body: AccountsPageResponse
    try {
      const res = await fetch(nextUrl)
      body = (await res.json()) as AccountsPageResponse
    } catch (e) {
      if (META_DEBUG) console.warn('[PageToken] /me/accounts fetch error', { page: pagesChecked, error: e })
      break
    }

    if (body.error) {
      const { code, message, fbtrace_id } = body.error
      if (isRateLimit(code)) {
        console.warn('[PageToken] /me/accounts rate_limit', { code, fbtrace_id })
        throw { kind: 'meta_rate_limited', code, fbtrace_id, message } as PageTokenError
      }
      if (isOAuthError(code)) {
        if (META_DEBUG) console.warn('[PageToken] /me/accounts oauth_invalid', { code, fbtrace_id })
        throw { kind: 'oauth_invalid', code, fbtrace_id, message } as PageTokenError
      }
      if (META_DEBUG) console.warn('[PageToken] /me/accounts API error', { code, message, fbtrace_id })
      break
    }

    // Early exit on match
    const match = (body.data ?? []).find((e) => e.id === pageId)
    if (match?.access_token) {
      const pageToken = match.access_token
      const result: PageTokenResult = { pageToken, last4: pageToken.slice(-4), source: 'me_accounts' }
      pageTokenCache.set(cacheKey, { token: pageToken, source: 'me_accounts', expiresAt: Date.now() + PAGE_TOKEN_TTL_MS })
      if (META_DEBUG) console.log('[PageToken] resolved via /me/accounts', { pageId, user_last4: userLast4, page_last4: result.last4, pagesChecked })
      return result
    }

    // Advance to next page
    nextUrl = body.paging?.next ?? null
    if (META_DEBUG && nextUrl) console.log('[PageToken] /me/accounts page', pagesChecked, 'no match, advancing')
  }

  // ── C) Both paths exhausted ───────────────────────────────────────────────
  if (META_DEBUG) {
    console.warn('[PageToken] page_token_not_found', { pageId, pagesChecked })
  }
  throw { kind: 'page_token_not_found' } as PageTokenError
}
