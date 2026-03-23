import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { META_BASE_URL } from "@/lib/metaConfig"
import { upsertMetaConnection } from "@/lib/metaConnectionStore"

const DEBUG = process.env.NODE_ENV === 'development'

export async function GET(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8)
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const grantedScopesParam = url.searchParams.get("granted_scopes")
  const deniedScopesParam = url.searchParams.get("denied_scopes")
  const error = url.searchParams.get("error")
  const errorDescription = url.searchParams.get("error_description")

  if (error) {
    console.error(`[Meta Callback][${requestId}] OAuth error: ${error} - ${errorDescription}`)
    return NextResponse.redirect(
      new URL(`/entegrasyon?meta=error&reason=${encodeURIComponent(errorDescription || error)}`, url.origin)
    )
  }

  if (!code || !state) {
    console.error(`[Meta Callback][${requestId}] Missing code or state`)
    return NextResponse.redirect(
      new URL('/entegrasyon?meta=error&reason=missing_code_or_state', url.origin)
    )
  }

  const cookieStore = await cookies()
  const expectedState = cookieStore.get("meta_oauth_state")?.value

  if (!expectedState || expectedState !== state) {
    console.error(`[Meta Callback][${requestId}] Invalid state - expected:${expectedState?.slice(0,8)} got:${state?.slice(0,8)}`)
    return NextResponse.redirect(
      new URL('/entegrasyon?meta=error&reason=invalid_state', url.origin)
    )
  }

  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET

  if (!appId || !appSecret) {
    console.error(`[Meta Callback][${requestId}] Missing app config`)
    return NextResponse.redirect(
      new URL('/entegrasyon?meta=error&reason=missing_app_config', url.origin)
    )
  }

  // Use META_REDIRECT_URI from env if set (required for prod)
  // Fallback to origin-based for local dev
  const redirectUri = process.env.META_REDIRECT_URI || `${url.origin}/api/meta/callback`

  // ============================================
  // Step 1: Exchange code → short-lived token
  // ============================================
  const tokenUrl = new URL(`${META_BASE_URL}/oauth/access_token`)
  tokenUrl.searchParams.set("client_id", appId)
  tokenUrl.searchParams.set("client_secret", appSecret)
  tokenUrl.searchParams.set("redirect_uri", redirectUri)
  tokenUrl.searchParams.set("code", code)

  let tokenJson: any
  try {
    const tokenRes = await fetch(tokenUrl.toString(), { 
      method: "GET",
      signal: AbortSignal.timeout(15000) // 15 saniye timeout
    })
    tokenJson = await tokenRes.json()

    if (!tokenRes.ok || !tokenJson?.access_token) {
      const reason = tokenJson?.error?.message || "token_exchange_failed"
      console.error(`[Meta Callback][${requestId}] Token exchange failed: ${reason}`)
      return NextResponse.redirect(
        new URL(`/entegrasyon?meta=error&reason=${encodeURIComponent(reason)}`, url.origin)
      )
    }
  } catch (err) {
    console.error(`[Meta Callback][${requestId}] Token exchange network error:`, err)
    return NextResponse.redirect(
      new URL('/entegrasyon?meta=error&reason=network_error', url.origin)
    )
  }

  console.log(`[Meta Callback][${requestId}] META_CONNECT_CALLBACK_START: code_length=${code.length}`)

  if (DEBUG) console.log(`[Meta Callback][${requestId}] Short-lived token received`)

  // ============================================
  // Step 2: Exchange short-lived → long-lived token (~60 gün)
  // ============================================
  const longLivedUrl = new URL(`${META_BASE_URL}/oauth/access_token`)
  longLivedUrl.searchParams.set("grant_type", "fb_exchange_token")
  longLivedUrl.searchParams.set("client_id", appId)
  longLivedUrl.searchParams.set("client_secret", appSecret)
  longLivedUrl.searchParams.set("fb_exchange_token", tokenJson.access_token)

  let finalAccessToken = tokenJson.access_token
  let tokenExpiresIn = 3600 // Default 1 saat (short-lived fallback)
  let isLongLived = false

  try {
    const longLivedRes = await fetch(longLivedUrl.toString(), { 
      method: "GET",
      signal: AbortSignal.timeout(15000)
    })
    const longLivedJson: any = await longLivedRes.json()

    if (longLivedRes.ok && longLivedJson?.access_token) {
      finalAccessToken = longLivedJson.access_token
      // Meta genelde expires_in döner (saniye cinsinden)
      tokenExpiresIn = longLivedJson.expires_in || 5184000 // ~60 gün default
      isLongLived = true
      
      if (DEBUG) console.log(`[Meta Callback][${requestId}] Long-lived token received, expires_in: ${tokenExpiresIn}s (~${Math.round(tokenExpiresIn/86400)} days)`)
    } else {
      // Long-lived exchange başarısız - short-lived ile devam et (fallback)
      // Bu kritik değil, kullanıcı akışı kırılmasın
      console.warn(`[Meta Callback][${requestId}] Long-lived exchange failed, using short-lived token. Error: ${longLivedJson?.error?.message || 'unknown'}`)
    }
  } catch (err) {
    // Network hatası - short-lived token ile devam et
    console.warn(`[Meta Callback][${requestId}] Long-lived exchange network error, using short-lived:`, err instanceof Error ? err.message : 'unknown')
  }

  console.log(`[Meta Callback][${requestId}] TOKEN_SAVED type:${isLongLived ? 'long_lived' : 'short_lived'}`)

  // ============================================
  // Step 3: Cookie'leri ayarla
  // ============================================
  // Finalize page handles ad account fetch + auto-selection to avoid extra
  // Meta API calls during callback (rate limit risk).
  const response = NextResponse.redirect(
    new URL('/connect/finalize', url.origin)
  )

  // Clear one-time state cookie
  response.cookies.set("meta_oauth_state", "", { maxAge: 0, path: "/" })

  // Cookie maxAge = token'ın gerçek ömrü (1 gün güvenlik payı çıkar)
  const cookieMaxAge = Math.max(tokenExpiresIn - 86400, 3600) // En az 1 saat

  // Store access token as httpOnly cookie
  response.cookies.set("meta_access_token", finalAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: cookieMaxAge,
  })

  // Store expiry timestamp (gerçek expire zamanı)
  const expiresAt = Date.now() + (tokenExpiresIn * 1000)
  response.cookies.set("meta_access_expires_at", expiresAt.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: cookieMaxAge,
  })

  // Token türünü kaydet (debugging/monitoring için)
  response.cookies.set("meta_token_type", isLongLived ? "long_lived" : "short_lived", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: cookieMaxAge,
  })

  // OAuth callback diagnostics (granted/denied scopes snapshot)
  response.cookies.set("meta_granted_scopes", grantedScopesParam || "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: cookieMaxAge,
  })
  response.cookies.set("meta_denied_scopes", deniedScopesParam || "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: cookieMaxAge,
  })

  // ============================================
  // Step 4: Persist to DB (best-effort await, error-tolerant)
  // Awaited to prevent dropped writes in serverless runtime.
  // Cookie persistence above is the primary store; DB is supplementary.
  // ============================================
  const sessionId = cookieStore.get('session_id')?.value
  if (sessionId) {
    try {
      await upsertMetaConnection(sessionId, {
        accessToken: finalAccessToken,
        expiresAt: expiresAt,
        tokenType: isLongLived ? 'long_lived' : 'short_lived',
        scopes: grantedScopesParam || undefined,
        status: 'active',
      })
    } catch (err) {
      // DB failure is non-fatal — cookies already set, redirect proceeds
      console.warn(`[Meta Callback][${requestId}] DB_PERSIST_FAIL:`, err instanceof Error ? err.message : 'unknown')
    }
  } else {
    if (DEBUG) console.log(`[Meta Callback][${requestId}] No session_id cookie, skipping DB persist`)
  }

  console.log(`[Meta Callback][${requestId}] META_CONNECT_CALLBACK_SUCCESS: token_type=${isLongLived ? 'long_lived' : 'short_lived'} expires_in=${Math.round(tokenExpiresIn/86400)}d redirect=/connect/finalize`)

  return response
}
