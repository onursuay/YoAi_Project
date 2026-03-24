import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE } from '@/lib/google-ads/constants'
import { getConnectionStatus } from '@/lib/googleAdsConnectionStore'
import { getGoogleAdsUserId } from '@/lib/googleAdsUserId'

/**
 * Google Ads connection status. DB-first, then cookie.
 */
export async function GET() {
  const cookieStore = await cookies()
  const userId = getGoogleAdsUserId(cookieStore)

  let hasToken = false
  let customerId = cookieStore.get(COOKIE.CUSTOMER_ID)?.value
  const accountName = cookieStore.get(COOKIE.ACCOUNT_NAME)?.value

  if (userId) {
    const connStatus = await getConnectionStatus(userId)
    if (connStatus.exists) {
      // Row found in DB → trust DB completely, no cookie fallback
      hasToken = connStatus.hasToken
      if (connStatus.customerId) customerId = connStatus.customerId
    } else {
      // No DB row → cookie fallback (pre-migration / no session)
      hasToken = !!cookieStore.get(COOKIE.REFRESH_TOKEN)?.value
    }
  } else {
    hasToken = !!cookieStore.get(COOKIE.REFRESH_TOKEN)?.value
  }

  if (!hasToken) {
    return NextResponse.json(
      { connected: false },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  }

  return NextResponse.json(
    {
      connected: true,
      accountId: customerId || null,
      accountName: accountName || null,
      hasSelectedAccount: Boolean(customerId),
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}
