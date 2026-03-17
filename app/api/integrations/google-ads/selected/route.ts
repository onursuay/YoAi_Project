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

  return NextResponse.json(
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
}
