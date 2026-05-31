import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCodeForTokens } from '@/lib/integrations/googleOAuthHelpers'
import { getCurrentUser } from '@/lib/billing/user'
import { createOAuthAccount } from '@/lib/email/sendingAccountStore'

export const dynamic = 'force-dynamic'

/** GET /api/email/gmail/callback — Google'dan döner; token alır, Gmail hesabını bağlar. */
export async function GET(request: Request) {
  const u = new URL(request.url)
  const origin = u.origin
  const code = u.searchParams.get('code')
  const state = u.searchParams.get('state')
  const oauthErr = u.searchParams.get('error')
  const back = (q: string) => {
    const r = NextResponse.redirect(new URL(`/email-marketing?gmail=${q}`, origin), { status: 302 })
    r.cookies.set('gmail_oauth_state', '', { maxAge: 0, path: '/' })
    return r
  }

  if (oauthErr || !code || !state) return back('error')

  const cookieStore = await cookies()
  if (cookieStore.get('gmail_oauth_state')?.value !== state) return back('state')

  const user = await getCurrentUser()
  if (!user) return back('auth')

  const redirectUri = process.env.GMAIL_REDIRECT_URI || `${origin}/api/email/gmail/callback`
  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri)
    if (!tokens.refresh_token) return back('no_refresh')

    const ui = await (await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })).json()
    const email = ui?.email as string | undefined
    if (!email) return back('no_email')

    await createOAuthAccount(user.id, { type: 'gmail', fromEmail: email, fromName: user.name ?? null, refreshToken: tokens.refresh_token })
    return back('connected')
  } catch {
    return back('error')
  }
}
