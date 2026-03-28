import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { TIKTOK_AUTH_URL } from '@/lib/tiktok-ads/constants'

/**
 * TikTok Ads OAuth start. Redirects user to TikTok authorization page.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin

  const appId = process.env.TIKTOK_APP_ID
  if (!appId) {
    return NextResponse.redirect(
      new URL('/entegrasyon?tiktok=error&reason=missing_app_config', origin),
      { status: 302 }
    )
  }

  const redirectUri = process.env.TIKTOK_REDIRECT_URI || `${origin}/api/integrations/tiktok-ads/callback`
  const state = crypto.randomUUID()

  const cookieStore = await cookies()

  // Ensure session_id exists
  if (!cookieStore.get('session_id')?.value) {
    const sessionId = crypto.randomUUID()
    const response = NextResponse.redirect(
      `${TIKTOK_AUTH_URL}?app_id=${appId}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`,
      { status: 302 }
    )
    response.cookies.set('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    response.cookies.set('tiktok_ads_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    })
    return response
  }

  const response = NextResponse.redirect(
    `${TIKTOK_AUTH_URL}?app_id=${appId}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    { status: 302 }
  )
  response.cookies.set('tiktok_ads_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return response
}
