import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { TIKTOK_TOKEN_URL } from '@/lib/tiktok-ads/constants'
import { upsertConnection } from '@/lib/tiktokAdsConnectionStore'

/**
 * TikTok Ads OAuth callback. Validates state, exchanges auth_code for access token,
 * stores in httpOnly cookie and persists to DB.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const authCode = url.searchParams.get('auth_code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const origin = url.origin

  if (error) {
    return NextResponse.redirect(
      new URL(`/entegrasyon?tiktok=error&reason=${encodeURIComponent(error)}`, origin),
      { status: 302 }
    )
  }

  if (!authCode || !state) {
    return NextResponse.redirect(
      new URL('/entegrasyon?tiktok=error&reason=missing_code_or_state', origin),
      { status: 302 }
    )
  }

  const cookieStore = await cookies()
  const expectedState = cookieStore.get('tiktok_ads_oauth_state')?.value

  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(
      new URL('/entegrasyon?tiktok=error&reason=invalid_state', origin),
      { status: 302 }
    )
  }

  const appId = process.env.TIKTOK_APP_ID
  const appSecret = process.env.TIKTOK_APP_SECRET

  if (!appId || !appSecret) {
    return NextResponse.redirect(
      new URL('/entegrasyon?tiktok=error&reason=missing_app_config', origin),
      { status: 302 }
    )
  }

  // Exchange auth_code for access token
  let tokenData: { access_token?: string; advertiser_ids?: string[] }
  try {
    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appId,
        secret: appSecret,
        auth_code: authCode,
      }),
      signal: AbortSignal.timeout(15000),
    })
    const tokenJson = await tokenRes.json()

    if (tokenJson.code !== 0 || !tokenJson.data?.access_token) {
      const reason = tokenJson.message || 'token_exchange_failed'
      console.error('[TikTok Callback] Token exchange failed:', reason)
      return NextResponse.redirect(
        new URL(`/entegrasyon?tiktok=error&reason=${encodeURIComponent(reason)}`, origin),
        { status: 302 }
      )
    }
    tokenData = tokenJson.data
  } catch (err) {
    console.error('[TikTok Callback] Token exchange network error:', err)
    return NextResponse.redirect(
      new URL('/entegrasyon?tiktok=error&reason=network_error', origin),
      { status: 302 }
    )
  }

  console.log('TIKTOK_ADS_CALLBACK_HIT')

  const accessToken = tokenData.access_token!
  const advertiserIds = tokenData.advertiser_ids || []

  // TikTok access tokens are long-lived (typically valid for ~24 hours, auto-refreshed)
  const cookieMaxAge = 60 * 60 * 24 * 365 // 1 year

  const response = NextResponse.redirect(
    new URL('/entegrasyon?tiktok=connected', origin),
    { status: 302 }
  )

  // Clear state cookie
  response.cookies.set('tiktok_ads_oauth_state', '', { maxAge: 0, path: '/' })

  // Store access token as httpOnly cookie
  response.cookies.set('tiktok_access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: cookieMaxAge,
  })

  // Store advertiser IDs for account selection
  if (advertiserIds.length > 0) {
    response.cookies.set('tiktok_advertiser_ids', JSON.stringify(advertiserIds), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: cookieMaxAge,
    })
  }

  // Persist to DB
  const sessionId = cookieStore.get('session_id')?.value
  if (sessionId) {
    try {
      await upsertConnection(sessionId, {
        accessToken,
        status: 'active',
      })
    } catch (err) {
      console.warn('[TikTok Callback] DB_PERSIST_FAIL:', err instanceof Error ? err.message : 'unknown')
    }
  }

  console.log(`TIKTOK_ADS_CALLBACK_SUCCESS: advertiser_count=${advertiserIds.length}`)

  return response
}
