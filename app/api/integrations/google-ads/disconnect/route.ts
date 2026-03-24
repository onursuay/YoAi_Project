import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE } from '@/lib/google-ads/constants'
import { revokeConnection } from '@/lib/googleAdsConnectionStore'
import { getGoogleAdsUserId } from '@/lib/googleAdsUserId'

export async function POST() {
  const cookieStore = await cookies()
  const userId = getGoogleAdsUserId(cookieStore)
  const refreshToken = cookieStore.get(COOKIE.REFRESH_TOKEN)?.value

  // 1. Clear cookies FIRST — must always happen (same pattern as Meta disconnect)
  cookieStore.delete(COOKIE.REFRESH_TOKEN)
  cookieStore.delete(COOKIE.CUSTOMER_ID)
  cookieStore.delete(COOKIE.LOGIN_CUSTOMER_ID)
  cookieStore.delete(COOKIE.ACCOUNT_NAME)
  cookieStore.delete(COOKIE.CUSTOMER_NAME)
  cookieStore.delete(COOKIE.IS_MANAGER)

  // 2. Revoke DB + Google token — fire-and-forget (never blocks cookie cleanup)
  if (userId) {
    revokeConnection(userId).catch(() => {})
  }
  if (refreshToken) {
    fetch(`https://oauth2.googleapis.com/revoke?token=${refreshToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
