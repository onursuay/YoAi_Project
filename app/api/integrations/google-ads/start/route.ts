import { NextResponse } from 'next/server'
import { randomBytes, randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/adwords'

/**
 * Google Ads OAuth start. Redirects to Google authorize URL with state (CSRF).
 * Ensures session_id exists so callback can persist to DB.
 */
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  console.log('GOOGLE_ADS_START_HIT')
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUriEnv = process.env.GOOGLE_REDIRECT_URI
  const origin = new URL(request.url).origin
  const callbackPath = '/api/integrations/google-ads/callback'
  const redirectUri = redirectUriEnv || `${origin}${callbackPath}`

  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL('/entegrasyon?google=config_missing', origin),
      { status: 302 }
    )
  }

  const state = randomBytes(24).toString('hex')
  const authorizeUrl = new URL(GOOGLE_AUTH_URL)
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('scope', GOOGLE_SCOPE)
  authorizeUrl.searchParams.set('access_type', 'offline')
  authorizeUrl.searchParams.set('prompt', 'consent')
  authorizeUrl.searchParams.set('state', state)

  const cookieStore = await cookies()
  const sessionExists = !!cookieStore.get('session_id')?.value
  console.log('GOOGLE_ADS_START_SESSION_EXISTS', sessionExists)
  const response = NextResponse.redirect(authorizeUrl.toString(), { status: 302 })
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')

  response.cookies.set('google_ads_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  })

  if (!sessionExists) {
    const newSessionId = randomUUID()
    response.cookies.set('session_id', newSessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    console.log('GOOGLE_ADS_START_SESSION_CREATED')
  }
  console.log('GOOGLE_ADS_START_SET_COOKIE_OK')

  return response
}
