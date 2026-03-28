import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE } from '@/lib/tiktok-ads/constants'
import { revokeConnection } from '@/lib/tiktokAdsConnectionStore'

export async function POST() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value

  // Revoke in DB
  if (sessionId) {
    await revokeConnection(sessionId)
  }

  const response = NextResponse.json({ ok: true })

  // Clear all TikTok cookies
  response.cookies.set(COOKIE.ACCESS_TOKEN, '', { maxAge: 0, path: '/' })
  response.cookies.set(COOKIE.ADVERTISER_ID, '', { maxAge: 0, path: '/' })
  response.cookies.set(COOKIE.ADVERTISER_NAME, '', { maxAge: 0, path: '/' })
  response.cookies.set('tiktok_advertiser_ids', '', { maxAge: 0, path: '/' })

  return response
}
