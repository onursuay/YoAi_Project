import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE } from '@/lib/google-ads/constants'
import { getConnection, revokeConnection } from '@/lib/googleAdsConnectionStore'
import { getGoogleAdsUserId } from '@/lib/googleAdsUserId'

export async function POST() {
  const cookieStore = await cookies()
  const userId = getGoogleAdsUserId(cookieStore)
  let refreshToken = cookieStore.get(COOKIE.REFRESH_TOKEN)?.value

  if (!refreshToken && userId) {
    const dbCtx = await getConnection(userId)
    refreshToken = dbCtx?.refreshToken ?? undefined
  }

  if (refreshToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${refreshToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    } catch {
      // Token revoke failed — still clear DB and cookies
    }
  }

  if (userId) {
    await revokeConnection(userId)
  }

  cookieStore.delete(COOKIE.REFRESH_TOKEN)
  cookieStore.delete(COOKIE.CUSTOMER_ID)
  cookieStore.delete(COOKIE.LOGIN_CUSTOMER_ID)
  cookieStore.delete(COOKIE.ACCOUNT_NAME)
  cookieStore.delete(COOKIE.CUSTOMER_NAME)
  cookieStore.delete(COOKIE.IS_MANAGER)

  return NextResponse.json({ success: true })
}
