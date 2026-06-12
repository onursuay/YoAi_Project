import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCodeForTokens } from '@/lib/integrations/googleOAuthHelpers'
import { saveGoogleSetupToken } from '@/lib/marketing-setup/setupStore'
import { getCurrentUser } from '@/lib/billing/user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const origin = url.origin

  const cookieStore = await cookies()
  const clearState = (res: NextResponse) => {
    res.cookies.set('setup_google_oauth_state', '', { maxAge: 0, path: '/' })
    return res
  }
  const redirectTo = (q: string) =>
    NextResponse.redirect(new URL(`/donusum-sihirbazi?setup=${q}`, origin), { status: 302 })

  if (error || !code || !state) {
    return clearState(redirectTo('error'))
  }

  const expectedState = cookieStore.get('setup_google_oauth_state')?.value
  if (!expectedState || expectedState !== state) {
    return clearState(redirectTo('error'))
  }

  const user = await getCurrentUser()
  if (!user) {
    return clearState(NextResponse.redirect(new URL('/login', origin), { status: 302 }))
  }

  const redirectUri =
    process.env.GOOGLE_SETUP_REDIRECT_URI || `${origin}/api/oauth/setup-google/callback`

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri)

    if (!tokens.refresh_token) {
      // No refresh token returned (e.g. consent reused without prompt) — cannot
      // persist long-lived access. Surface as a real error, never fake success.
      return clearState(redirectTo('error'))
    }

    const saved = await saveGoogleSetupToken(user.id, tokens.refresh_token, tokens.scope)
    return clearState(redirectTo(saved ? 'connected' : 'error'))
  } catch (err) {
    console.error(
      'MARKETING_SETUP_GOOGLE_CALLBACK_FAIL',
      err instanceof Error ? err.message : String(err),
    )
    return clearState(redirectTo('error'))
  }
}
