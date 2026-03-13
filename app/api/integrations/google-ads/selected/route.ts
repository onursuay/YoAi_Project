import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsAccessToken, searchGAds } from '@/lib/googleAdsAuth'
import { COOKIE } from '@/lib/google-ads/constants'

const CUSTOMER_QUERY = 'SELECT customer.id, customer.manager FROM customer LIMIT 1'

/**
 * GET /api/integrations/google-ads/selected
 * Returns selected customer for provider=google_ads (from cookies).
 * Includes loginCustomerId and isManager.
 * No customer selected -> { selected: null }
 */
export async function GET() {
  const cookieStore = await cookies()
  const customerId = cookieStore.get(COOKIE.CUSTOMER_ID)?.value
  const loginCustomerId = cookieStore.get(COOKIE.LOGIN_CUSTOMER_ID)?.value
  const customerName =
    cookieStore.get(COOKIE.ACCOUNT_NAME)?.value ||
    cookieStore.get(COOKIE.CUSTOMER_NAME)?.value

  if (!customerId) {
    return NextResponse.json(
      { selected: null },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  let isManager = false
  const refreshToken = cookieStore.get(COOKIE.REFRESH_TOKEN)?.value
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
