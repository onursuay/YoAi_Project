import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE } from '@/lib/google-ads/constants'
import { getConnection, getConnectionStatus } from '@/lib/googleAdsConnectionStore'
import { getGoogleAdsUserId } from '@/lib/googleAdsUserId'
import { getGoogleAdsAccessToken } from '@/lib/googleAdsAuth'

export const dynamic = 'force-dynamic'

/**
 * Best-effort: Google OAuth userinfo endpoint'inden bağlı kullanıcının adını çek.
 * Hata olursa null döner; status akışı bozulmaz.
 */
async function fetchGoogleUserName(refreshToken: string): Promise<string | null> {
  try {
    const accessToken = await getGoogleAdsAccessToken(refreshToken)
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { name?: string; email?: string }
    return data?.name || data?.email || null
  } catch {
    return null
  }
}

/**
 * Google Ads connection status.
 * DB-first (google_ads_connections), cookie fallback — mirrors getGoogleAdsContext()
 * lookup order so the status reflects the real connection (not just the cookie session).
 * Lightweight: never calls the Google Ads API.
 */
export async function GET() {
  const cookieStore = await cookies()
  const userId = getGoogleAdsUserId(cookieStore)
  const accountName =
    cookieStore.get(COOKIE.ACCOUNT_NAME)?.value ||
    cookieStore.get(COOKIE.CUSTOMER_NAME)?.value ||
    null

  // 1) DB-first
  if (userId) {
    const status = await getConnectionStatus(userId)
    if (status.exists && status.hasToken) {
      // DB connection'dan refresh token al → userinfo'dan bağlı kullanıcı adını çek
      let connectedUserName: string | null = null
      try {
        const conn = await getConnection(userId)
        if (conn?.refreshToken) {
          connectedUserName = await fetchGoogleUserName(conn.refreshToken)
        }
      } catch { /* connectedUserName null kalır */ }
      return NextResponse.json(
        {
          connected: true,
          accountId: status.customerId,
          accountName,
          hasSelectedAccount: Boolean(status.customerId),
          connectedUserName,
        },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      )
    }
  }

  // 2) Cookie fallback (no session / pre-migration)
  const cookieRefreshToken = cookieStore.get(COOKIE.REFRESH_TOKEN)?.value
  const hasToken = !!cookieRefreshToken
  const customerId = cookieStore.get(COOKIE.CUSTOMER_ID)?.value

  if (!hasToken) {
    return NextResponse.json(
      { connected: false },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  }

  // Cookie refresh token varsa userinfo'yu yine çek (best-effort)
  const connectedUserName = cookieRefreshToken
    ? await fetchGoogleUserName(cookieRefreshToken)
    : null

  return NextResponse.json(
    {
      connected: true,
      accountId: customerId || null,
      accountName,
      hasSelectedAccount: Boolean(customerId),
      connectedUserName,
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}
