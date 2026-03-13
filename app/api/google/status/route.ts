import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE } from '@/lib/google-ads/constants'

/**
 * Google Ads connection status.
 * Check google_refresh_token cookie to determine connection status.
 */
export async function GET() {
  const cookieStore = await cookies()
  const googleRefreshToken = cookieStore.get(COOKIE.REFRESH_TOKEN)

  if (!googleRefreshToken?.value) {
    return NextResponse.json(
      { connected: false },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  }

  const customerId = cookieStore.get(COOKIE.CUSTOMER_ID)?.value
  const accountName = cookieStore.get(COOKIE.ACCOUNT_NAME)?.value

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
