import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE } from '@/lib/tiktok-ads/constants'
import { getConnectionStatus } from '@/lib/tiktokAdsConnectionStore'

export async function GET() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value

  // Check DB first
  if (sessionId) {
    const dbStatus = await getConnectionStatus(sessionId)
    if (dbStatus.exists) {
      return NextResponse.json({
        connected: dbStatus.hasToken,
        advertiserId: dbStatus.advertiserId,
        advertiserName: dbStatus.advertiserName,
        hasSelectedAccount: !!dbStatus.advertiserId,
      })
    }
  }

  // Cookie fallback
  const token = cookieStore.get(COOKIE.ACCESS_TOKEN)?.value
  const advertiserId = cookieStore.get(COOKIE.ADVERTISER_ID)?.value
  const advertiserName = cookieStore.get(COOKIE.ADVERTISER_NAME)?.value

  return NextResponse.json({
    connected: !!token,
    advertiserId: advertiserId || null,
    advertiserName: advertiserName || null,
    hasSelectedAccount: !!advertiserId,
  })
}
