import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { GOOGLE_AUTH_URL, GOOGLE_ANALYTICS_SCOPES } from '@/lib/integrations/constants'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const origin = new URL(request.url).origin
  const redirectUri = process.env.GOOGLE_ANALYTICS_REDIRECT_URI || `${origin}/api/integrations/google-analytics/callback`

  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/entegrasyon?ga=config_missing', origin), { status: 302 })
  }

  const cookieStore = await cookies()
  const state = randomBytes(24).toString('hex')
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr'

  const authorizeUrl = new URL(GOOGLE_AUTH_URL)
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('scope', GOOGLE_ANALYTICS_SCOPES.join(' '))
  authorizeUrl.searchParams.set('access_type', 'offline')
  authorizeUrl.searchParams.set('prompt', 'consent')
  authorizeUrl.searchParams.set('state', `ga_${state}`)
  authorizeUrl.searchParams.set('hl', locale)

  const response = NextResponse.redirect(authorizeUrl.toString(), { status: 302 })
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')

  response.cookies.set('ga_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  })

  return response
}
