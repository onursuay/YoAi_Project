import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE } from '@/lib/google-ads/constants'

/**
 * Google Ads connection status. Cookie-based (same pattern as Meta status).
 */
export async function GET() {
  const cookieStore = await cookies()

  const hasToken = !!cookieStore.get(COOKIE.REFRESH_TOKEN)?.value
  const customerId = cookieStore.get(COOKIE.CUSTOMER_ID)?.value
  const accountName = cookieStore.get(COOKIE.ACCOUNT_NAME)?.value

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
