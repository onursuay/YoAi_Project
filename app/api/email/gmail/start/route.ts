import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { GOOGLE_AUTH_URL } from '@/lib/integrations/constants'

export const dynamic = 'force-dynamic'

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
]

/** GET /api/email/gmail/start — Gmail gönderim için OAuth consent'e yönlendirir. */
export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const origin = new URL(request.url).origin
  const redirectUri = process.env.GMAIL_REDIRECT_URI || `${origin}/api/email/gmail/callback`

  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/email-marketing?gmail=config_missing', origin), { status: 302 })
  }

  const state = randomBytes(24).toString('hex')
  const url = new URL(GOOGLE_AUTH_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GMAIL_SCOPES.join(' '))
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)

  const res = NextResponse.redirect(url.toString(), { status: 302 })
  res.headers.set('Cache-Control', 'no-store')
  res.cookies.set('gmail_oauth_state', state, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/',
  })
  return res
}
