import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsAccessToken, searchGAds } from '@/lib/googleAdsAuth'
import { COOKIE } from '@/lib/google-ads/constants'
import { getConnection } from '@/lib/googleAdsConnectionStore'
import { getGoogleAdsUserId } from '@/lib/googleAdsUserId'

const CUSTOMER_QUERY = 'SELECT customer.id, customer.manager FROM customer LIMIT 1'

/**
 * GET /api/integrations/google-ads/selected
 * Returns selected customer for provider=google_ads. DB-first, then cookies.
 * No customer selected -> { selected: null }
 */
export async function GET() {
  const cookieStore = await cookies()
  const userId = getGoogleAdsUserId(cookieStore)

  let customerId = cookieStore.get(COOKIE.CUSTOMER_ID)?.value
  let loginCustomerId = cookieStore.get(COOKIE.LOGIN_CUSTOMER_ID)?.value
  let customerName =
    cookieStore.get(COOKIE.ACCOUNT_NAME)?.value ||
    cookieStore.get(COOKIE.CUSTOMER_NAME)?.value

  if ((!customerId || !loginCustomerId) && userId) {
    const dbCtx = await getConnection(userId)
    if (dbCtx) {
      customerId = customerId || dbCtx.customerId
      loginCustomerId = loginCustomerId || dbCtx.loginCustomerId
    }
  }

  if (!customerId) {
    return NextResponse.json(
      { selected: null },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  // Fast path: read isManager from cookie cache
  const cachedIsManager = cookieStore.get(COOKIE.IS_MANAGER)?.value
  if (cachedIsManager === 'true' || cachedIsManager === 'false') {
    return NextResponse.json(
      {
        selected: {
          customerId,
          loginCustomerId: loginCustomerId || customerId,
          customerName: customerName || `Account ${customerId}`,
          isManager: cachedIsManager === 'true',
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  // Slow path: query Google Ads API for isManager, then cache result
  let isManager = false
  let refreshToken = cookieStore.get(COOKIE.REFRESH_TOKEN)?.value
  if (!refreshToken && userId) {
    refreshToken = (await getConnection(userId))?.refreshToken ?? undefined
  }
  if (refreshToken) {
    try {
      const accessToken = await getGoogleAdsAccessToken(refreshToken)
      const loginId = loginCustomerId || customerId
      const ctx = { accessToken, customerId, loginCustomerId: loginId }
      const rows = await searchGAds<any>(ctx, CUSTOMER_QUERY)
      const first = rows[0]
      const c = first?.customer ?? first
      const manager = c?.manager ?? (c as { manager?: boolean })?.manager
      isManager = manager === true || manager === 'true' || String(manager) === 'true'
    } catch {
      // on error assume client so we don't block
    }
  }

  const response = NextResponse.json(
    {
      selected: {
        customerId,
        loginCustomerId: loginCustomerId || customerId,
        customerName: customerName || `Account ${customerId}`,
        isManager,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )

  // Cache isManager in cookie for subsequent page loads
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  }
  response.cookies.set(COOKIE.IS_MANAGER, String(isManager), cookieOpts)

  return response
}
