import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsAccessToken, GOOGLE_ADS_BASE, searchGAds } from '@/lib/googleAdsAuth'
import { COOKIE } from '@/lib/google-ads/constants'
import { getConnection } from '@/lib/googleAdsConnectionStore'
import { getGoogleAdsUserId } from '@/lib/googleAdsUserId'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Salt-okunur wizard endpoint'i — global Google Ads seçimini (Reklam Yöneticisi
// cookie/DB bağlantısı) DEĞİŞTİRMEZ; yalnız erişilebilir hesapları listeler ve
// manager (MCC) hesaplarının altındaki müşteri hesaplarını açar. Mevcut
// /api/integrations/google-ads/accounts endpoint'i bilinçli olarak tutulur.

const CUSTOMER_QUERY =
  'SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1'

// Manager altındaki BİRİNCİ seviye müşteri hesapları (kendisi level 0, çocuklar level 1).
const CLIENT_QUERY =
  'SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.level FROM customer_client WHERE customer_client.level <= 1'

interface AdsChild {
  customerId: string
  name: string
  isManager: boolean
  loginCustomerId: string
}

interface AdsAccountNode {
  customerId: string
  name: string
  isManager: boolean
  loginCustomerId: string
  children: AdsChild[]
}

/**
 * GET /api/marketing-setup/google-ads-accounts
 * Lists accessible Google Ads customers; expands managers (MCC) to their direct
 * client accounts so the user can pick a specific operating account in the wizard.
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
      { status: 401 },
    )
  }

  const listUrl = `${GOOGLE_ADS_BASE}/customers:listAccessibleCustomers`
  const listRes = await fetch(listUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, 'developer-token': developerToken },
  })
  if (!listRes.ok) {
    const err = await listRes.text()
    if (err.includes('NOT_ADS_USER')) return NextResponse.json({ error: 'not_ads_user' }, { status: 400 })
    return NextResponse.json(
      { error: 'list_accessible_failed', message: err || listRes.statusText },
      { status: listRes.status >= 500 ? 502 : 400 },
    )
  }

  const listData = await listRes.json().catch(() => ({}))
  const resourceNames: string[] = listData.resourceNames || []
  const customerIds = resourceNames.map((rn) => rn.replace(/^customers\//, '').replace(/-/g, ''))

  const fetchInfo = async (id: string): Promise<{ name: string; isManager: boolean }> => {
    try {
      const rows = await searchGAds<Record<string, unknown>>(
        { accessToken, customerId: id, loginCustomerId: id },
        CUSTOMER_QUERY,
      )
      const c = (rows[0]?.customer ?? rows[0]) as Record<string, unknown> | undefined
      const name = (c?.descriptiveName ?? c?.descriptive_name ?? `Account ${id}`) as string
      const manager = c?.manager
      const isManager = manager === true || String(manager) === 'true'
      return { name, isManager }
    } catch {
      return { name: `Account ${id}`, isManager: false }
    }
  }

  // Manager hesabının altındaki birinci seviye müşteri hesaplarını çek.
  const fetchChildren = async (managerId: string): Promise<AdsChild[]> => {
    try {
      const rows = await searchGAds<Record<string, unknown>>(
        { accessToken, customerId: managerId, loginCustomerId: managerId },
        CLIENT_QUERY,
      )
      const children: AdsChild[] = []
      for (const r of rows) {
        const cc = (r.customerClient ?? r.customer_client) as Record<string, unknown> | undefined
        if (!cc) continue
        const rawId = cc.id ?? cc.clientCustomer
        const childId = String(rawId ?? '').replace(/^customers\//, '').replace(/-/g, '')
        if (!childId || childId === managerId) continue // kendisini atla (level 0)
        const lvl = Number(cc.level ?? 1)
        if (lvl !== 1) continue // yalnız doğrudan çocuklar
        const childIsManager = cc.manager === true || String(cc.manager) === 'true'
        children.push({
          customerId: childId,
          name: (cc.descriptiveName ?? cc.descriptive_name ?? `Account ${childId}`) as string,
          isManager: childIsManager,
          loginCustomerId: managerId, // alt hesap işlemleri MCC üzerinden yetkilenir
        })
      }
      // Manager altındaki alt-manager'ları en sona, normal hesapları öne al.
      return children.sort((a, b) => Number(a.isManager) - Number(b.isManager))
    } catch {
      return []
    }
  }

  const infos = await Promise.all(customerIds.map((id) => fetchInfo(id)))
  const accounts: AdsAccountNode[] = await Promise.all(
    customerIds.map(async (id, i) => {
      const node: AdsAccountNode = {
        customerId: id,
        name: infos[i].name,
        isManager: infos[i].isManager,
        loginCustomerId: id,
        children: [],
      }
      if (infos[i].isManager) node.children = await fetchChildren(id)
      return node
    }),
  )

  return NextResponse.json({ accounts }, { headers: { 'Cache-Control': 'no-store' } })
}
