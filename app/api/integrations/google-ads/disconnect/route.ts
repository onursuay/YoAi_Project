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

  const response = NextResponse.json({ success: true })
  response.cookies.set(COOKIE.REFRESH_TOKEN, '', { maxAge: 0, path: '/' })
  response.cookies.set(COOKIE.CUSTOMER_ID, '', { maxAge: 0, path: '/' })
  response.cookies.set(COOKIE.LOGIN_CUSTOMER_ID, '', { maxAge: 0, path: '/' })
  response.cookies.set(COOKIE.ACCOUNT_NAME, '', { maxAge: 0, path: '/' })
  response.cookies.set(COOKIE.CUSTOMER_NAME, '', { maxAge: 0, path: '/' })
  response.cookies.set(COOKIE.IS_MANAGER, '', { maxAge: 0, path: '/' })

  return response
}
