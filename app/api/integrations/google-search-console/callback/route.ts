import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { exchangeCodeForTokens } from '@/lib/integrations/googleOAuthHelpers'
import { upsertGSCConnection } from '@/lib/google-search-console/connectionStore'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const origin = url.origin

  if (error) {
    return NextResponse.redirect(
      new URL(`/entegrasyon?gsc=error&reason=${encodeURIComponent(error)}`, origin),
      { status: 302 }
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/entegrasyon?gsc=error&reason=missing_code_or_state', origin),
      { status: 302 }
    )
  }

  const cookieStore = await cookies()
  const expectedState = cookieStore.get('gsc_oauth_state')?.value
  const stateValue = state.startsWith('gsc_') ? state.slice(4) : state

  if (!expectedState || expectedState !== stateValue) {
    return NextResponse.redirect(
      new URL('/entegrasyon?gsc=error&reason=invalid_state', origin),
      { status: 302 }
    )
  }

  const redirectUri = process.env.GOOGLE_GSC_REDIRECT_URI || `${origin}/api/integrations/google-search-console/callback`

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri)

    const response = NextResponse.redirect(
      new URL('/entegrasyon?gsc=connected', origin),
      { status: 302 }
    )

    response.cookies.set('gsc_oauth_state', '', { maxAge: 0, path: '/' })

    let userId = cookieStore.get('session_id')?.value
    if (!userId) {
      userId = randomUUID()
      response.cookies.set('session_id', userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      })
    }

    if (userId && tokens.refresh_token) {
      await upsertGSCConnection(userId, {
        refreshToken: tokens.refresh_token,
        tokenScope: tokens.scope,
        status: 'active',
      })
    }

    return response
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'token_exchange_failed'
    return NextResponse.redirect(
      new URL(`/entegrasyon?gsc=error&reason=${encodeURIComponent(reason)}`, origin),
      { status: 302 }
    )
  }
}
