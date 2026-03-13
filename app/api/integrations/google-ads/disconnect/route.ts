import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE } from '@/lib/google-ads/constants'

export async function POST() {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get(COOKIE.REFRESH_TOKEN)?.value

  if (refreshToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${refreshToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    } catch {
      // Token revoke failed — still clear cookies
    }
  }

  cookieStore.delete(COOKIE.REFRESH_TOKEN)
  cookieStore.delete(COOKIE.CUSTOMER_ID)
  cookieStore.delete(COOKIE.LOGIN_CUSTOMER_ID)
  cookieStore.delete(COOKIE.ACCOUNT_NAME)

  return NextResponse.json({ success: true })
}
