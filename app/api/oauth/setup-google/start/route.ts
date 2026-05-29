import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { GOOGLE_AUTH_URL } from '@/lib/integrations/constants'
import { SETUP_GOOGLE_SCOPES } from '@/lib/marketing-setup/constants'
import { checkMarketingSetupAccess } from '@/lib/marketing-setup/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const origin = new URL(request.url).origin

  // Yazma-scope'lu (tagmanager.edit/publish, analytics.edit, webmasters) consent —
  // yalnız yetkili (flag/owner) kullanıcı başlatabilir; aksi halde sızdırmadan geri yönlendir.
  const access = await checkMarketingSetupAccess()
  if (!access.ok) {
    const dest = access.status === 401 ? '/login' : '/marketing-kurulumu?setup=error'
    return NextResponse.redirect(new URL(dest, origin), { status: 302 })
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/marketing-kurulumu?setup=error', origin), { status: 302 })
  }

  const cookieStore = await cookies()
  const state = randomBytes(24).toString('hex')
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr'

  const redirectUri =
    process.env.GOOGLE_SETUP_REDIRECT_URI || `${origin}/api/oauth/setup-google/callback`

  const authorizeUrl = new URL(GOOGLE_AUTH_URL)
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('scope', SETUP_GOOGLE_SCOPES.join(' '))
  authorizeUrl.searchParams.set('access_type', 'offline')
  authorizeUrl.searchParams.set('prompt', 'consent')
  authorizeUrl.searchParams.set('include_granted_scopes', 'true')
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('hl', locale)

  const response = NextResponse.redirect(authorizeUrl.toString(), { status: 302 })
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')

  response.cookies.set('setup_google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  })

  return response
}
