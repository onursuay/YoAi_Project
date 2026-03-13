/**
 * Instagram User ID resolver for Meta adcreative (object_story_spec.instagram_user_id).
 *
 * Uses Page Access Token for both edges to avoid #190 errors.
 * Throws structured errors so callers can map them to user-facing messages.
 *
 * Edge order (both use Page Access Token):
 *   1) /{pageId}/page_backed_instagram_accounts
 *   2) /{pageId}/instagram_accounts
 */

import { MetaGraphClient } from './client'
import { getPageAccessToken, type PageTokenError } from './pageToken'

const META_DEBUG = process.env.META_DEBUG === 'true'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// ── Error kinds ─────────────────────────────────────────────────────────────
export type IgErrorKind =
  | 'page_token_not_found'
  | 'ig_not_linked_to_page'
  | 'ig_permission_error'
  | 'meta_rate_limited'

export interface IgError {
  kind: IgErrorKind
  meta_error?: { code?: number; subcode?: number; fbtrace_id?: string; message?: string }
  /** Present on page_token_not_found when META_DEBUG=true */
  debug?: {
    pageId?: string
    me_accounts_count?: number
    me_accounts_page_ids_sample?: string[]
    reason?: 'missing_pages_show_list' | 'page_not_in_accounts'
  }
}

// ── Result ──────────────────────────────────────────────────────────────────
export interface IgResolveResult {
  instagramUserId: string
  username?: string
  sourceEdge: 'page_backed_instagram_accounts' | 'page_instagram_accounts'
  /** How the Page Access Token was obtained — for debug tracing */
  pageTokenSource: 'direct_page' | 'me_accounts'
}

// ── Cache ───────────────────────────────────────────────────────────────────
interface CacheEntry {
  result: IgResolveResult
  expiresAt: number
}
const igCache = new Map<string, CacheEntry>()

type IgRow = { id: string; username?: string }

function logEdge(
  step: 1 | 2,
  edge: string,
  opts: {
    pageId: string
    userTokenLast4: string
    pageTokenLast4: string
    ok: boolean
    count: number
    usernames: string[]
    fbtrace_id?: string
    message?: string
  }
) {
  if (!META_DEBUG) return
  console.log(`[IG RESOLVE] step=${step} edge=${edge}`, JSON.stringify({
    pageId: opts.pageId,
    userTokenLast4: opts.userTokenLast4,
    pageTokenLast4: opts.pageTokenLast4,
    ok: opts.ok,
    count: opts.count,
    usernames: opts.usernames,
    ...(opts.fbtrace_id ? { fbtrace_id: opts.fbtrace_id } : {}),
    ...(opts.message ? { message: opts.message } : {}),
    result: opts.count > 0 ? 'HIT' : 'EMPTY_EDGE',
  }))
}

export async function resolveInstagramUserId(params: {
  pageId: string
  adAccountId?: string
  userAccessToken: string
}): Promise<IgResolveResult> {
  const { pageId, userAccessToken } = params
  const userLast4 = userAccessToken.slice(-4)
  const cacheKey = `${pageId}:${userLast4}`

  const cached = igCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    if (META_DEBUG) {
      console.log('[IG RESOLVE] CACHE HIT', { pageId, userTokenLast4: userLast4, instagramUserId: cached.result.instagramUserId })
    }
    return cached.result
  }

  // ── Derive Page Access Token (throws PageTokenError on failure) ─────────
  let pageTok: import('./pageToken').PageTokenResult
  try {
    pageTok = await getPageAccessToken(userAccessToken, pageId)
  } catch (ptErr) {
    const e = ptErr as PageTokenError
    if (e.kind === 'meta_rate_limited') {
      throw { kind: 'meta_rate_limited', meta_error: { code: e.code, fbtrace_id: e.fbtrace_id, message: e.message } } as IgError
    }
    // oauth_invalid or page_token_not_found → surface as page_token_not_found
    throw { kind: 'page_token_not_found' } as IgError
  }

  const pageClient = new MetaGraphClient({ accessToken: pageTok.pageToken })

  /** Fetch username for an IG account id when not returned by the edge. */
  async function fetchUsernameById(igId: string): Promise<string | undefined> {
    try {
      const res = await pageClient.get<{ id?: string; username?: string }>(`/${igId}`, { fields: 'username' })
      return res.data?.username ?? undefined
    } catch {
      return undefined
    }
  }

  const tryEdge = async (
    step: 1 | 2,
    edge: string,
    path: string
  ): Promise<IgRow[] | null> => {
    const res = await pageClient.get<{ data?: IgRow[] }>(path, { fields: 'id,username' })

    // Permission / OAuth error
    if (!res.ok) {
      const err = res.error ?? {}
      logEdge(step, edge, {
        pageId,
        userTokenLast4: userLast4,
        pageTokenLast4: pageTok.last4,
        ok: false,
        count: 0,
        usernames: [],
        fbtrace_id: err.fbtrace_id,
        message: err.message,
      })
      // Rate limit: code 4 (app-level) or 32 (page-level) or HTTP 429
      const isRateLimit = err.code === 4 || err.code === 32
      if (isRateLimit) {
        throw {
          kind: 'meta_rate_limited',
          meta_error: { code: err.code, subcode: err.error_subcode ?? err.subcode, fbtrace_id: err.fbtrace_id, message: err.message },
        } as IgError
      }
      const isPermission = err.code === 190 || err.code === 200 || err.type === 'OAuthException'
      if (isPermission) {
        throw {
          kind: 'ig_permission_error',
          meta_error: { code: err.code, subcode: err.error_subcode ?? err.subcode, fbtrace_id: err.fbtrace_id, message: err.message },
        } as IgError
      }
      return null // non-permission error → try next edge
    }

    const rows = res.data?.data ?? []
    logEdge(step, edge, {
      pageId,
      userTokenLast4: userLast4,
      pageTokenLast4: pageTok.last4,
      ok: true,
      count: rows.length,
      usernames: rows.map((r) => r.username ?? r.id),
    })
    return rows.length > 0 ? rows : null
  }

  // ── Edge 1: page_backed_instagram_accounts ───────────────────────────────
  const rows1 = await tryEdge(1, 'page_backed_instagram_accounts', `/${pageId}/page_backed_instagram_accounts`)
  if (rows1) {
    const igId = rows1[0].id
    const username = rows1[0].username ?? await fetchUsernameById(igId)
    if (META_DEBUG && !rows1[0].username && username) {
      console.log('[IG RESOLVE] username fetched via fallback GET', { igId, username })
    }
    const result: IgResolveResult = { instagramUserId: igId, username, sourceEdge: 'page_backed_instagram_accounts', pageTokenSource: pageTok.source }
    igCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS })
    return result
  }

  // ── Edge 2: instagram_accounts (page-scoped) ─────────────────────────────
  const rows2 = await tryEdge(2, 'page_instagram_accounts', `/${pageId}/instagram_accounts`)
  if (rows2) {
    const igId = rows2[0].id
    const username = rows2[0].username ?? await fetchUsernameById(igId)
    if (META_DEBUG && !rows2[0].username && username) {
      console.log('[IG RESOLVE] username fetched via fallback GET', { igId, username })
    }
    const result: IgResolveResult = { instagramUserId: igId, username, sourceEdge: 'page_instagram_accounts', pageTokenSource: pageTok.source }
    igCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS })
    return result
  }

  // ── Both edges empty ─────────────────────────────────────────────────────
  if (META_DEBUG) {
    console.warn('[IG RESOLVE] ALL_EDGES_EMPTY', { pageId, userTokenLast4: userLast4, tried: ['page_backed_instagram_accounts', 'page_instagram_accounts'] })
  }
  throw { kind: 'ig_not_linked_to_page' } as IgError
}
