import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE } from '@/lib/tiktok-ads/constants'
import { updateSelectedAdvertiser } from '@/lib/tiktokAdsConnectionStore'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { advertiserId, advertiserName } = body

  if (!advertiserId) {
    return NextResponse.json({ error: 'advertiserId required' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value

  // Persist to DB
  if (sessionId) {
    await updateSelectedAdvertiser(sessionId, advertiserId, advertiserName)
  }

  // Also set cookies for fast access
  const response = NextResponse.json({
    ok: true,
    advertiserId,
    advertiserName: advertiserName || `Advertiser ${advertiserId}`,
  })

  const maxAge = 60 * 60 * 24 * 365
  response.cookies.set(COOKIE.ADVERTISER_ID, advertiserId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  })
  if (advertiserName) {
    response.cookies.set(COOKIE.ADVERTISER_NAME, advertiserName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    })
  }

  return response
}
