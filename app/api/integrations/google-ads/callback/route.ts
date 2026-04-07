import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { GOOGLE_TOKEN_URL, COOKIE } from '@/lib/google-ads/constants'
import { upsertConnection } from '@/lib/googleAdsConnectionStore'
import { getGoogleAdsUserId } from '@/lib/googleAdsUserId'

/**
 * Google Ads OAuth callback. Validates state, exchanges code for tokens,
 * stores refresh_token in httpOnly cookie and persists to DB for production-safe use.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')
  const origin = url.origin

  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr'

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/${locale}/entegrasyon?google=error&reason=${encodeURIComponent(errorDescription || error)}`,
        origin
      ),
      { status: 302 }
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`/${locale}/entegrasyon?google=error&reason=missing_code_or_state`, origin),
      { status: 302 }
    )
  }

  const expectedState = cookieStore.get('google_ads_oauth_state')?.value

  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(
      new URL(`/${locale}/entegrasyon?google=error&reason=invalid_state`, origin),
      { status: 302 }
    )
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUriEnv = process.env.GOOGLE_REDIRECT_URI
  const callbackPath = '/api/integrations/google-ads/callback'
  const redirectUri = redirectUriEnv || `${origin}${callbackPath}`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL(`/${locale}/entegrasyon?google=error&reason=missing_app_config`, origin),
      { status: 302 }
    )
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const tokenJson = await tokenRes.json().catch(() => ({}))

  if (!tokenRes.ok || !tokenJson?.refresh_token) {
    const reason = tokenJson?.error_description || tokenJson?.error || 'token_exchange_failed'
    return NextResponse.redirect(
      new URL(
        `/${locale}/entegrasyon?google=error&reason=${encodeURIComponent(String(reason))}`,
        origin
      ),
      { status: 302 }
    )
  }

  console.log('GOOGLE_ADS_CALLBACK_HIT')

  const response = NextResponse.redirect(
    new URL(`/${locale}/dashboard`, origin),
    { status: 302 }
  )

  response.cookies.set('google_ads_oauth_state', '', { maxAge: 0, path: '/' })

  // Store refresh_token in cookie (for UI compatibility)
  response.cookies.set(COOKIE.REFRESH_TOKEN, tokenJson.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })

  // Persist to DB for production-safe use (admin refresh, cron, server-to-server)
  const userId = getGoogleAdsUserId(cookieStore)
  console.log('GOOGLE_ADS_CALLBACK_USER_ID_PRESENT', !!userId)
  if (userId && tokenJson.refresh_token) {
    console.log('GOOGLE_ADS_CALLBACK_DB_UPSERT_ATTEMPT')
    const scope = typeof tokenJson.scope === 'string' ? tokenJson.scope : undefined
    const ok = await upsertConnection(userId, {
      refreshToken: tokenJson.refresh_token,
      tokenScope: scope,
      connectedEmail: undefined,
      status: 'active',
    })
    if (ok) {
      console.log('GOOGLE_ADS_CALLBACK_DB_UPSERT_OK')
    } else {
      console.log('GOOGLE_ADS_CALLBACK_DB_UPSERT_FAIL')
    }
  } else if (!userId) {
    console.log('GOOGLE_ADS_CALLBACK_DB_UPSERT_FAIL userId missing')
  }

  return response
}
