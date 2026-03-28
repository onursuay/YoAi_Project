import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { TIKTOK_ADS_API_BASE, COOKIE } from '@/lib/tiktok-ads/constants'
import { buildTikTokHeaders, fetchWithRetry } from '@/lib/tiktokAdsAuth'

/**
 * Get advertiser accounts for the connected TikTok user.
 * Uses advertiser_ids from OAuth callback + fetches account info.
 */
export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(COOKIE.ACCESS_TOKEN)?.value
  const advertiserIdsRaw = cookieStore.get('tiktok_advertiser_ids')?.value

  if (!accessToken) {
    return NextResponse.json({ error: 'Not connected' }, { status: 401 })
  }

  let advertiserIds: string[] = []
  try {
    advertiserIds = advertiserIdsRaw ? JSON.parse(advertiserIdsRaw) : []
  } catch {
    advertiserIds = []
  }

  if (advertiserIds.length === 0) {
    return NextResponse.json({ advertisers: [] })
  }

  // Fetch advertiser info for each ID
  try {
    const ctx = { accessToken, advertiserId: '', locale: 'tr' }
    const params = new URLSearchParams({
      advertiser_ids: JSON.stringify(advertiserIds),
    })

    const res = await fetchWithRetry(
      `${TIKTOK_ADS_API_BASE}/advertiser/info/?${params}`,
      {
        method: 'GET',
        headers: buildTikTokHeaders(ctx),
      }
    )
    const json = await res.json().catch(() => ({}))

    if (json.code !== 0 || !json.data?.list) {
      // Fallback: return IDs without names
      return NextResponse.json({
        advertisers: advertiserIds.map((id) => ({ advertiserId: id, name: `Advertiser ${id}` })),
      })
    }

    const advertisers = json.data.list.map((item: { advertiser_id: string; name: string }) => ({
      advertiserId: String(item.advertiser_id),
      name: item.name || `Advertiser ${item.advertiser_id}`,
    }))

    return NextResponse.json({ advertisers })
  } catch (err) {
    console.error('[TikTok Accounts]', err)
    // Fallback
    return NextResponse.json({
      advertisers: advertiserIds.map((id) => ({ advertiserId: id, name: `Advertiser ${id}` })),
    })
  }
}
