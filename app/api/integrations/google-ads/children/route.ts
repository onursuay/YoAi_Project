import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsAccessToken, searchGAds } from '@/lib/googleAdsAuth'
import { COOKIE } from '@/lib/google-ads/constants'
import { normalizeError } from '@/lib/google-ads/errors'

const CHILDREN_QUERY = `
  SELECT
    customer_client.client_customer,
    customer_client.descriptive_name,
    customer_client.level,
    customer_client.manager,
    customer_client.status
  FROM customer_client
  WHERE customer_client.level = 1
`.trim()

/**
 * GET /api/integrations/google-ads/children?loginCustomerId=XXXXXXXXXX
 * Lists client accounts (level 1) under a manager.
 */
export async function GET(request: Request) {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get(COOKIE.REFRESH_TOKEN)?.value
  if (!refreshToken) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const loginCustomerId = searchParams.get('loginCustomerId')?.replace(/-/g, '').trim()
  if (!loginCustomerId || !/^\d{10}$/.test(loginCustomerId)) {
    return NextResponse.json(
      { error: 'invalid_login_customer_id', message: 'loginCustomerId (10-digit) is required' },
      { status: 400 }
    )
  }

  try {
    const accessToken = await getGoogleAdsAccessToken(refreshToken)
    const ctx = { accessToken, customerId: loginCustomerId, loginCustomerId }

    type Row = {
      customerClient?: {
        clientCustomer?: string
        descriptiveName?: string
        descriptive_name?: string
        level?: string | number
        manager?: boolean
        status?: string
      }
    }

    const rows = await searchGAds<Row>(ctx, CHILDREN_QUERY)

    const children = rows.map((r) => {
      const cc = r.customerClient ?? (r as unknown as { customer_client?: Row['customerClient'] }).customer_client
      const rn = cc?.clientCustomer ?? (cc as { client_customer?: string })?.client_customer ?? ''
      const customerId = rn.replace(/^customers\//, '').replace(/-/g, '')
      const name = cc?.descriptiveName ?? cc?.descriptive_name ?? `Account ${customerId}`
      const manager = cc?.manager ?? (cc as { manager?: boolean })?.manager ?? false
      const isManager = !!manager
      const status = cc?.status ?? (cc as { status?: string })?.status ?? 'UNKNOWN'
      return { customerId, name, isManager, status }
    }).filter((c) => c.customerId)

    return NextResponse.json({ children }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const { error, message, status } = normalizeError(e, 'children_fetch_failed', 401)
    return NextResponse.json({ error, message }, { status })
  }
}
