import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsAccessToken, GOOGLE_ADS_BASE, searchGAds } from '@/lib/googleAdsAuth'
import { COOKIE } from '@/lib/google-ads/constants'
import { getConnection } from '@/lib/googleAdsConnectionStore'
import { getGoogleAdsUserId } from '@/lib/googleAdsUserId'

const CUSTOMER_QUERY =
  'SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1'

/**
 * GET /api/integrations/google-ads/accounts
 * Lists accessible Google Ads customers via ListAccessibleCustomers.
 * Uses DB-first, then cookie fallback.
 */
export async function GET() {
  const cookieStore = await cookies()
  const userId = getGoogleAdsUserId(cookieStore)
  let refreshToken = cookieStore.get(COOKIE.REFRESH_TOKEN)?.value
  if (!refreshToken && userId) {
    refreshToken = (await getConnection(userId))?.refreshToken ?? undefined
  }
  if (!refreshToken) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!developerToken) {
    return NextResponse.json({ error: 'developer_token_not_configured' }, { status: 503 })
  }

  let accessToken: string
  try {
    accessToken = await getGoogleAdsAccessToken(refreshToken)
  } catch (e) {
    return NextResponse.json(
      { error: 'token_exchange_failed', message: e instanceof Error ? e.message : 'Unknown' },
      { status: 401 }
    )
  }

  const listUrl = `${GOOGLE_ADS_BASE}/customers:listAccessibleCustomers`
  const listRes = await fetch(listUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
    },
  })

  if (!listRes.ok) {
    const err = await listRes.text()
    if (err.includes('NOT_ADS_USER')) {
      return NextResponse.json(
        { error: 'not_ads_user' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'list_accessible_failed', message: err || listRes.statusText },
      { status: listRes.status >= 500 ? 502 : 400 }
    )
  }

  const listData = await listRes.json().catch(() => ({}))
  const resourceNames: string[] = listData.resourceNames || []
  const customerIds = resourceNames.map((rn: string) => rn.replace(/^customers\//, '').replace(/-/g, ''))

  const fetchInfo = async (id: string): Promise<{ name: string; isManager: boolean }> => {
    try {
      const ctx = { accessToken, customerId: id, loginCustomerId: id }
      const rows = await searchGAds<any>(ctx, CUSTOMER_QUERY)
      const first = rows[0]
      const c = first?.customer ?? first
      const name = c?.descriptiveName ?? c?.descriptive_name ?? `Account ${id}`
      const manager = c?.manager ?? (c as { manager?: boolean })?.manager
      const isManager = manager === true || manager === 'true' || String(manager) === 'true'
      return { name, isManager }
    } catch {
      return { name: `Account ${id}`, isManager: false }
    }
  }

  const infos = await Promise.all(customerIds.map((id) => fetchInfo(id)))

  const customers = customerIds.map((id, i) => ({
    customerId: id,
    name: infos[i].name,
    isManager: infos[i].isManager,
  }))

  return NextResponse.json({ customers }, { headers: { 'Cache-Control': 'no-store' } })
}
