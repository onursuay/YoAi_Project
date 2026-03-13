/**
 * GET /api/meta/ig/verify?pageId=...
 *
 * Multi-layer, fail-closed flow:
 *   1)  Token resolve (cookie → Bearer header fallback)
 *   2)  L1 cooldown (in-process Map)       → meta_rate_limited  (0 Supabase/Meta calls)
 *   3)  L1 cache    (in-process Map, 30m)  → ok                 (0 Supabase/Meta calls)
 *   4)  Singleflight (in-process Map)      → dedup concurrent calls on same instance
 *   5)  Throttle    (in-process Map, 30s)  → client_throttled   (max 1 fresh attempt/30s)
 *   6)  App-ID check (optional, /debug_token, cached 30m) → app_id_mismatch
 *   7)  Supabase cooldown                  → meta_rate_limited  (0 Meta calls)
 *   8)  Supabase cache (30m)               → ok                 (0 Meta calls)
 *   9)  Supabase inflight lock             → verify_in_progress (0 Meta calls)
 *  10)  resolveInstagramUserId             → Meta calls (1-2 Graph requests)
 *  11)  On success   → L1 cache + Supabase cache + releaseLock + resolve singleflight
 *  12)  On rate limit → L1 cooldown(5m) + Supabase cooldown(5m) + negative cache + releaseLock
 *  13)  On other err → releaseLock + resolve singleflight with error
 *
 * Security: tokens NEVER logged — only last4 fingerprint in server logs.
 */

import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'
import { resolveInstagramUserId, type IgError } from '@/lib/meta/ig'
import * as store from '@/lib/meta/igVerifyStore'
import { META_BASE_URL } from '@/lib/metaConfig'

export const dynamic = 'force-dynamic'

const patchVersion            = 'ig-verify-debug-v5'
const L1_CACHE_TTL_MS         = 30 * 60 * 1000   // 30 minutes
const SUPABASE_CACHE_TTL_SEC  = 1800              // 30 minutes
const RATE_LIMIT_COOLDOWN_SEC = 300               // 5 minutes
const THROTTLE_WINDOW_MS      = 30 * 1000         // 30 seconds per key
const TOKEN_APPID_TTL_MS      = 30 * 60 * 1000   // cache /debug_token result 30 min
const SUCCESS_CACHE_HEADERS   = { 'Cache-Control': 'private, max-age=1800' }

// ── L1 in-process caches ──────────────────────────────────────────────────────

interface L1CacheEntry {
  instagram_user_id: string
  username: string | null
  source_edge: string
  expiresAt: number
}
interface L1CooldownEntry  { retryAfterSec: number; untilTs: number }
interface InflightResult   { ok: boolean; [key: string]: unknown }
interface AppIdCacheEntry  { appId: string; expiresAt: number }

const l1Cache       = new Map<string, L1CacheEntry>()
const l1Cooldown    = new Map<string, L1CooldownEntry>()
const l1Throttle    = new Map<string, number>()           // key → lastAttemptTs
const inflightMap   = new Map<string, Promise<InflightResult>>()
const tokenAppIdCache = new Map<string, AppIdCacheEntry>() // userId → { appId, expiresAt }

// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get('pageId')?.trim()

  if (!pageId) {
    return NextResponse.json(
      { ok: false, error: 'missing_page_id', message: 'pageId parametresi zorunludur.', patchVersion },
      { status: 400 }
    )
  }

  // ── 1) Token resolve ─────────────────────────────────────────────────────────
  const ctx = await resolveMetaContext()
  let userAccessToken: string | null = ctx?.userAccessToken ?? null
  let tokenSource: 'cookie' | 'bearer_header' = 'cookie'

  if (!userAccessToken) {
    const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization') ?? ''
    if (authHeader.startsWith('Bearer ')) {
      userAccessToken = authHeader.substring(7).trim() || null
      if (userAccessToken) tokenSource = 'bearer_header'
    }
  }

  if (!userAccessToken) {
    return NextResponse.json(
      { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı.', patchVersion },
      { status: 401 }
    )
  }

  const userId   = ctx?.accountId ?? `tkn_${userAccessToken.slice(-8)}`
  const DEBUG    = process.env.META_DEBUG === 'true'
  const reqId    = Math.random().toString(36).slice(2, 8)
  const cacheKey = `${userId}:${pageId}`

  if (DEBUG) {
    console.log(`[IG VERIFY][${reqId}] start`, {
      userId, pageId, tokenSource, userTokenLast4: userAccessToken.slice(-4),
    })
  }

  // ── 2) L1 cooldown (negative cache — rate limited by Meta) ──────────────────
  const l1cd = l1Cooldown.get(cacheKey)
  if (l1cd && Date.now() < l1cd.untilTs) {
    const remaining = Math.ceil((l1cd.untilTs - Date.now()) / 1000)
    if (DEBUG) console.log(`[IG VERIFY][${reqId}] L1_COOLDOWN_HIT`, { userId, remaining })
    return NextResponse.json({
      ok: false,
      error: 'meta_rate_limited',
      message: 'Meta API hız limiti aşıldı. Lütfen birkaç dakika sonra tekrar deneyin.',
      retryAfterSec: remaining,
      patchVersion,
    })
  }

  // ── 3) L1 cache (positive — 30 min) ─────────────────────────────────────────
  const l1hit = l1Cache.get(cacheKey)
  if (l1hit && Date.now() < l1hit.expiresAt) {
    if (DEBUG) console.log(`[IG VERIFY][${reqId}] L1_CACHE_HIT`, { userId, pageId })
    return NextResponse.json({
      ok: true,
      instagram_user_id: l1hit.instagram_user_id,
      username: l1hit.username,
      source_edge: l1hit.source_edge,
      patchVersion,
      ...(DEBUG ? { debug: { cacheHit: true, cacheLayer: 'l1', tokenSource, targetPageId: pageId } } : {}),
    }, { headers: SUCCESS_CACHE_HEADERS })
  }

  // ── 4) Singleflight — dedup concurrent requests on same instance ─────────────
  const inflightExisting = inflightMap.get(cacheKey)
  if (inflightExisting) {
    if (DEBUG) console.log(`[IG VERIFY][${reqId}] SINGLEFLIGHT_WAIT`, { userId, pageId })
    const shared = await inflightExisting
    return NextResponse.json({
      ...shared,
      patchVersion,
      ...(DEBUG ? { debug: { ...(typeof shared.debug === 'object' && shared.debug ? shared.debug : {}), deduplicated: true } } : {}),
    })
  }

  // ── 5) Per-key throttle — max 1 fresh Meta attempt per 30 s ─────────────────
  const lastAttemptTs = l1Throttle.get(cacheKey) ?? 0
  const sinceLastMs   = Date.now() - lastAttemptTs
  if (sinceLastMs < THROTTLE_WINDOW_MS) {
    const retryAfterSec = Math.ceil((THROTTLE_WINDOW_MS - sinceLastMs) / 1000)
    if (DEBUG) console.log(`[IG VERIFY][${reqId}] THROTTLED`, { userId, retryAfterSec })
    return NextResponse.json({
      ok: false,
      error: 'client_throttled',
      message: 'Çok sık deneme yapıldı. 30 sn sonra tekrar deneyin.',
      retryAfterSec,
      patchVersion,
    })
  }
  // Mark this attempt timestamp BEFORE registering singleflight
  l1Throttle.set(cacheKey, Date.now())

  // Register singleflight promise so concurrent callers wait
  let resolveInflight!: (r: InflightResult) => void
  const inflightPromise = new Promise<InflightResult>((resolve) => { resolveInflight = resolve })
  inflightMap.set(cacheKey, inflightPromise)

  // ── 6) App-ID consistency check (optional — only if META_APP_ID + SECRET set) ─
  const META_APP_ID     = process.env.META_APP_ID
  const META_APP_SECRET = process.env.META_APP_SECRET
  let tokenAppId: string | null = null

  if (META_APP_ID && META_APP_SECRET) {
    const cachedAppId = tokenAppIdCache.get(userId)
    if (cachedAppId && Date.now() < cachedAppId.expiresAt) {
      tokenAppId = cachedAppId.appId
    } else {
      try {
        const appToken  = `${META_APP_ID}|${META_APP_SECRET}`
        const dbRes     = await fetch(
          `${META_BASE_URL}/debug_token?input_token=${userAccessToken}&access_token=${appToken}`
        )
        const dbBody    = await dbRes.json() as { data?: { app_id?: string; user_id?: string } }
        tokenAppId      = dbBody?.data?.app_id?.toString() ?? null
        if (tokenAppId) {
          tokenAppIdCache.set(userId, { appId: tokenAppId, expiresAt: Date.now() + TOKEN_APPID_TTL_MS })
        }
        if (DEBUG) {
          console.log(`[IG VERIFY][${reqId}] debug_token`, {
            tokenAppId, tokenUserId: dbBody?.data?.user_id, ctxAccountId: ctx?.accountId,
          })
        }
      } catch (e) {
        // Fail-open: debug_token unavailable is not fatal
        if (DEBUG) console.warn(`[IG VERIFY][${reqId}] debug_token check failed (fail-open)`, e)
      }
    }

    if (tokenAppId && tokenAppId !== META_APP_ID) {
      console.warn(`[IG VERIFY][${reqId}] APP_ID_MISMATCH tokenAppId=${tokenAppId} expected=${META_APP_ID}`)
      const mismatchResp: InflightResult = {
        ok: false,
        error: 'app_id_mismatch',
        message: 'Token farklı Meta App üzerinden üretilmiş. Meta bağlantısını yeniden yetkilendirin.',
      }
      resolveInflight(mismatchResp)
      inflightMap.delete(cacheKey)
      return NextResponse.json({ ...mismatchResp, patchVersion })
    }
  }

  // ── 7) Supabase cooldown ─────────────────────────────────────────────────────
  const cooldown = await store.getCooldown(userId)
  if (cooldown.active) {
    if (DEBUG) {
      console.log(`[IG VERIFY][${reqId}] SUPABASE_COOLDOWN_ACTIVE`, { userId, retryAfterSec: cooldown.retryAfterSec })
    }
    // Populate L1 cooldown so next request is served from memory
    l1Cooldown.set(cacheKey, { retryAfterSec: cooldown.retryAfterSec, untilTs: Date.now() + cooldown.retryAfterSec * 1000 })
    const resp: InflightResult = {
      ok: false,
      error: 'meta_rate_limited',
      message: 'Meta API hız limiti aşıldı. Lütfen birkaç dakika sonra tekrar deneyin.',
      retryAfterSec: cooldown.retryAfterSec,
    }
    resolveInflight(resp)
    inflightMap.delete(cacheKey)
    return NextResponse.json({ ...resp, patchVersion })
  }

  // ── 8) Supabase cache (30 min) ───────────────────────────────────────────────
  const cached = await store.getCache(userId, pageId)
  if (cached.hit) {
    if (DEBUG) {
      console.log(`[IG VERIFY][${reqId}] SUPABASE_CACHE_HIT`, {
        userId, pageId, ig_user_id: cached.record.instagram_user_id,
      })
    }
    l1Cache.set(cacheKey, {
      instagram_user_id: cached.record.instagram_user_id ?? '',
      username: cached.record.username,
      source_edge: cached.record.source_edge ?? '',
      expiresAt: Date.now() + L1_CACHE_TTL_MS,
    })
    const resp: InflightResult = {
      ok: true,
      instagram_user_id: cached.record.instagram_user_id,
      username: cached.record.username,
      source_edge: cached.record.source_edge,
      ...(DEBUG ? { debug: { cacheHit: true, cacheLayer: 'supabase', tokenSource, targetPageId: pageId } } : {}),
    }
    resolveInflight(resp)
    inflightMap.delete(cacheKey)
    return NextResponse.json({ ...resp, patchVersion }, { headers: SUCCESS_CACHE_HEADERS })
  }

  // ── 9) Supabase inflight lock ────────────────────────────────────────────────
  const lock = await store.acquireLock(userId, pageId, 20)
  if (!lock.acquired) {
    const resp: InflightResult = {
      ok: false,
      error: 'verify_in_progress',
      message: 'Doğrulama devam ediyor. Lütfen bekleyin.',
      retryAfterSec: lock.retryAfterSec,
    }
    resolveInflight(resp)
    inflightMap.delete(cacheKey)
    return NextResponse.json({ ...resp, patchVersion })
  }

  // ── 10) Meta calls ───────────────────────────────────────────────────────────
  try {
    const result = await resolveInstagramUserId({
      pageId,
      adAccountId: ctx?.accountId,
      userAccessToken,
    })

    // ── 11) Success ──────────────────────────────────────────────────────────
    const successResp: InflightResult = {
      ok: true,
      instagram_user_id: result.instagramUserId,
      username: result.username ?? null,
      source_edge: result.sourceEdge,
      ...(DEBUG ? {
        debug: {
          tokenSource,
          pageTokenSource: result.pageTokenSource,
          targetPageId: pageId,
          ...(tokenAppId ? { tokenAppId } : {}),
        },
      } : {}),
    }

    l1Cache.set(cacheKey, {
      instagram_user_id: result.instagramUserId,
      username: result.username ?? null,
      source_edge: result.sourceEdge,
      expiresAt: Date.now() + L1_CACHE_TTL_MS,
    })

    resolveInflight(successResp)
    inflightMap.delete(cacheKey)

    await Promise.all([
      store.setCache(userId, pageId, {
        instagram_user_id: result.instagramUserId,
        username: result.username ?? null,
        source_edge: result.sourceEdge,
      }, SUPABASE_CACHE_TTL_SEC),
      store.releaseLock(userId, pageId),
    ])

    if (DEBUG) {
      console.log(`[IG VERIFY][${reqId}] SUCCESS`, {
        userId, pageId,
        ig_user_id: result.instagramUserId,
        source_edge: result.sourceEdge,
        pageTokenSource: result.pageTokenSource,
        metaCallsCount: 1,
        ...(tokenAppId ? { tokenAppId } : {}),
      })
    }

    return NextResponse.json({ ...successResp, patchVersion }, { headers: SUCCESS_CACHE_HEADERS })

  } catch (err) {
    const igErr = err as IgError

    // ── 12) Rate limit — cache negative for 5 min ────────────────────────────
    if (igErr.kind === 'meta_rate_limited') {
      const rlUntilTs = Date.now() + RATE_LIMIT_COOLDOWN_SEC * 1000
      l1Cooldown.set(cacheKey, { retryAfterSec: RATE_LIMIT_COOLDOWN_SEC, untilTs: rlUntilTs })

      const rlResp: InflightResult = {
        ok: false,
        error: 'meta_rate_limited',
        message: 'Meta API hız limiti aşıldı. Lütfen birkaç dakika sonra tekrar deneyin.',
        retryAfterSec: RATE_LIMIT_COOLDOWN_SEC,
        meta_error: igErr.meta_error ?? null,
      }
      resolveInflight(rlResp)
      inflightMap.delete(cacheKey)

      console.warn(
        `[IG VERIFY] RATE_LIMIT userId=${userId} code=${igErr.meta_error?.code}` +
        ` fbtrace=${igErr.meta_error?.fbtrace_id} retryAfterSec=${RATE_LIMIT_COOLDOWN_SEC}`
      )
      await Promise.all([
        store.setCooldown(userId, RATE_LIMIT_COOLDOWN_SEC, 'meta_code_4_or_429'),
        store.releaseLock(userId, pageId),
      ])
      return NextResponse.json({ ...rlResp, patchVersion })
    }

    // ── 13) Other errors ─────────────────────────────────────────────────────
    await store.releaseLock(userId, pageId)

    const debugField = DEBUG
      ? { debug: { tokenSource, targetPageId: pageId, hasTargetPageId: false } }
      : {}

    let errResp: InflightResult

    if (igErr.kind === 'page_token_not_found') {
      const reason = igErr.debug?.reason
      let message: string
      if (reason === 'missing_pages_show_list') {
        message = 'Token pages_show_list izni taşımıyor. Meta bağlantısını yenileyip re-consent verin.'
      } else if (reason === 'page_not_in_accounts') {
        message = 'Bu sayfayı /me/accounts içinde göremiyoruz. Sayfada admin/editor olduğunuzdan veya Business Manager erişimini kontrol edin.'
      } else {
        message = 'Bu sayfa için Page Access Token alınamadı. Kullanıcı sayfada yetkili değil veya pages_* izni yok.'
      }
      errResp = { ok: false, error: 'page_token_not_found', message, ...debugField }
    } else if (igErr.kind === 'ig_not_linked_to_page') {
      errResp = {
        ok: false, error: 'ig_not_linked_to_page',
        message: 'Bu sayfaya Instagram bağlı değil. Sayfanızı Meta Business Manager üzerinden Instagram ile bağlayın.',
        ...debugField,
      }
    } else if (igErr.kind === 'ig_permission_error') {
      errResp = { ok: false, error: 'ig_permission_error', message: 'Token/izin yetersiz.', meta_error: igErr.meta_error, ...debugField }
    } else {
      console.error(`[IG VERIFY][${reqId}] unexpected`, igErr)
      errResp = { ok: false, error: 'ig_resolve_failed', message: 'Instagram hesabı sorgulanırken beklenmeyen hata.', ...debugField }
    }

    resolveInflight(errResp)
    inflightMap.delete(cacheKey)

    const isUnexpected = !['page_token_not_found', 'ig_not_linked_to_page', 'ig_permission_error'].includes(igErr.kind ?? '')
    return NextResponse.json({ ...errResp, patchVersion }, isUnexpected ? { status: 500 } : undefined)
  }
}
