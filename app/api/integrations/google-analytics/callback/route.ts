import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCodeForTokens } from '@/lib/integrations/googleOAuthHelpers'
import { upsertGAConnection } from '@/lib/google-analytics/connectionStore'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const origin = url.origin

  const cookieStore = await cookies()
  const isEn = cookieStore.get('NEXT_LOCALE')?.value === 'en'
  const integrationUrl = (q: string) => isEn ? `/en/integration?${q}` : `/entegrasyon?${q}`

  if (error) {
    return NextResponse.redirect(
      new URL(integrationUrl(`ga=error&reason=${encodeURIComponent(error)}`), origin),
      { status: 302 }
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(integrationUrl('ga=error&reason=missing_code_or_state'), origin),
      { status: 302 }
    )
  }

  const expectedState = cookieStore.get('ga_oauth_state')?.value
  const stateValue = state.startsWith('ga_') ? state.slice(3) : state

  if (!expectedState || expectedState !== stateValue) {
    return NextResponse.redirect(
      new URL(integrationUrl('ga=error&reason=invalid_state'), origin),
      { status: 302 }
    )
  }

  const redirectUri = process.env.GOOGLE_ANALYTICS_REDIRECT_URI || `${origin}/api/integrations/google-analytics/callback`

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri)
    const userId = cookieStore.get('user_id')?.value

    console.log('[GA_CALLBACK]', {
      hasUserId: !!userId,
      hasRefreshToken: !!tokens.refresh_token,
      scope: tokens.scope,
    })

    if (!userId) {
      const response = NextResponse.redirect(
        new URL(integrationUrl('ga=error&reason=no_user_session'), origin),
        { status: 302 }
      )
      response.cookies.set('ga_oauth_state', '', { maxAge: 0, path: '/' })
      return response
    }

    if (!tokens.refresh_token) {
      const response = NextResponse.redirect(
        new URL(integrationUrl('ga=error&reason=no_refresh_token'), origin),
        { status: 302 }
      )
      response.cookies.set('ga_oauth_state', '', { maxAge: 0, path: '/' })
      return response
    }

    const saved = await upsertGAConnection(userId, {
      refreshToken: tokens.refresh_token,
      tokenScope: tokens.scope,
      status: 'active',
    })

    const response = NextResponse.redirect(
      new URL(integrationUrl(saved ? 'ga=connected' : 'ga=error&reason=db_save_failed'), origin),
      { status: 302 }
    )
    response.cookies.set('ga_oauth_state', '', { maxAge: 0, path: '/' })
    return response
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'token_exchange_failed'
    return NextResponse.redirect(
      new URL(integrationUrl(`ga=error&reason=${encodeURIComponent(reason)}`), origin),
      { status: 302 }
    )
  }
}
