import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE } from '@/lib/tiktok-ads/constants'
import { getConnectionStatus } from '@/lib/tiktokAdsConnectionStore'

export async function GET() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value

  // DB first
  if (sessionId) {
    const dbStatus = await getConnectionStatus(sessionId)
    if (dbStatus.exists && dbStatus.advertiserId) {
      return NextResponse.json({
        selected: {
          advertiserId: dbStatus.advertiserId,
          advertiserName: dbStatus.advertiserName || `Advertiser ${dbStatus.advertiserId}`,
        },
      })
    }
  }

  // Cookie fallback
  const advertiserId = cookieStore.get(COOKIE.ADVERTISER_ID)?.value
  const advertiserName = cookieStore.get(COOKIE.ADVERTISER_NAME)?.value

  if (!advertiserId) {
    return NextResponse.json({ selected: null })
  }

  return NextResponse.json({
    selected: {
      advertiserId,
      advertiserName: advertiserName || `Advertiser ${advertiserId}`,
    },
  })
}
