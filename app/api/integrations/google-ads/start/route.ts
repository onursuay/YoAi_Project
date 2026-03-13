import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/adwords'

/**
 * Google Ads OAuth start. Redirects to Google authorize URL with state (CSRF).
 * Provider: google_ads. Completely separate from Meta.
 */
export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUriEnv = process.env.GOOGLE_REDIRECT_URI
  const origin = new URL(request.url).origin
  const callbackPath = '/api/integrations/google-ads/callback'
  const redirectUri = redirectUriEnv || `${origin}${callbackPath}`

  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL('/dashboard/entegrasyon?google=config_missing', origin),
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
  const response = NextResponse.redirect(authorizeUrl.toString(), { status: 302 })
  response.cookies.set('google_ads_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  })

  return response
}
