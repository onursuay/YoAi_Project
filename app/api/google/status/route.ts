import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE } from '@/lib/google-ads/constants'
import { getConnectionStatus } from '@/lib/googleAdsConnectionStore'
import { getGoogleAdsUserId } from '@/lib/googleAdsUserId'

export const dynamic = 'force-dynamic'

/**
 * Google Ads connection status.
 * DB-first (google_ads_connections), cookie fallback — mirrors getGoogleAdsContext()
 * lookup order so the status reflects the real connection (not just the cookie session).
 * Lightweight: never calls the Google Ads API.
 */
export async function GET() {
  const cookieStore = await cookies()
  const userId = getGoogleAdsUserId(cookieStore)
  const accountName =
    cookieStore.get(COOKIE.ACCOUNT_NAME)?.value ||
    cookieStore.get(COOKIE.CUSTOMER_NAME)?.value ||
    null

  // 1) DB-first
  if (userId) {
    const status = await getConnectionStatus(userId)
    if (status.exists && status.hasToken) {
      return NextResponse.json(
        {
          connected: true,
          accountId: status.customerId,
          accountName,
          hasSelectedAccount: Boolean(status.customerId),
        },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      )
    }
  }

  // 2) Cookie fallback (no session / pre-migration)
  const hasToken = !!cookieStore.get(COOKIE.REFRESH_TOKEN)?.value
  const customerId = cookieStore.get(COOKIE.CUSTOMER_ID)?.value

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
      accountName,
      hasSelectedAccount: Boolean(customerId),
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}
