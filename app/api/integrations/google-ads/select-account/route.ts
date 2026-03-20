import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsAccessToken, GOOGLE_ADS_BASE, buildGoogleAdsHeaders } from '@/lib/googleAdsAuth'
import { COOKIE } from '@/lib/google-ads/constants'
import { parseGoogleAdsResponse } from '@/lib/google-ads/errors'
import { getConnection, upsertConnection } from '@/lib/googleAdsConnectionStore'
import { getGoogleAdsUserId } from '@/lib/googleAdsUserId'

const SANITY_QUERY = 'SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1'

/**
 * POST /api/integrations/google-ads/select-account
 * Body: { loginCustomerId?: string, customerId: string }
 * Persists customer IDs to DB and optionally cookies. Runs sanity query to confirm access.
 */
export async function POST(request: Request) {
  console.log('GOOGLE_ADS_SELECT_ACCOUNT_HIT')
  const cookieStore = await cookies()
  const userId = getGoogleAdsUserId(cookieStore)
  console.log('GOOGLE_ADS_SELECT_ACCOUNT_SESSION_ID_PRESENT', !!userId)
  let refreshToken = cookieStore.get(COOKIE.REFRESH_TOKEN)?.value

  if (!refreshToken && userId) {
    const dbCtx = await getConnection(userId)
    refreshToken = dbCtx?.refreshToken ?? undefined
  }
  if (!refreshToken) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!developerToken) {
    return NextResponse.json({ error: 'developer_token_not_configured' }, { status: 503 })
  }

  let body: { loginCustomerId?: string; customerId: string; customerName?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const customerId = String(body.customerId || '').replace(/-/g, '').trim()
  if (!customerId || !/^\d{10}$/.test(customerId)) {
    return NextResponse.json(
      { error: 'invalid_customer_id', message: 'customerId must be a 10-digit ID' },
      { status: 400 }
    )
  }

  const loginCustomerId = body.loginCustomerId
    ? String(body.loginCustomerId).replace(/-/g, '').trim()
    : customerId

  const providedName = typeof body.customerName === 'string' ? body.customerName.trim() : ''

  let descriptiveName: string
  if (providedName) {
    descriptiveName = providedName
  } else {
    let accessToken: string
    try {
      accessToken = await getGoogleAdsAccessToken(refreshToken)
    } catch (e) {
      return NextResponse.json(
        { error: 'token_exchange_failed', message: e instanceof Error ? e.message : 'Unknown' },
        { status: 401 }
      )
    }
    const searchUrl = `${GOOGLE_ADS_BASE}/customers/${customerId}/googleAds:search`
    const headers = buildGoogleAdsHeaders({
      accessToken,
      customerId,
      loginCustomerId,
    })
    const searchRes = await fetch(searchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: SANITY_QUERY }),
    })
    if (!searchRes.ok) {
      const parsed = await parseGoogleAdsResponse(searchRes, 'sanity_query_failed')
      return NextResponse.json(
        { error: parsed.error, message: parsed.message },
        { status: parsed.status }
      )
    }
    const searchData = await searchRes.json().catch(() => ({}))
    const results = searchData.results || []
    const first = results[0]
    descriptiveName =
      first?.customer?.descriptiveName ?? first?.customer?.descriptive_name ?? `Account ${customerId}`
  }

  const response = NextResponse.json({
    ok: true,
    customerId,
    customerName: descriptiveName,
    loginCustomerId,
  })

  // Persist to DB (primary). Include refreshToken if available for backfill.
  if (userId) {
    console.log('GOOGLE_ADS_SELECT_ACCOUNT_DB_UPSERT_ATTEMPT')
    const ok = await upsertConnection(userId, {
      refreshToken: refreshToken || undefined,
      customerId,
      loginCustomerId,
      status: 'active',
    })
    if (ok) {
      console.log('GOOGLE_ADS_SELECT_ACCOUNT_DB_UPSERT_OK')
    } else {
      console.log('GOOGLE_ADS_SELECT_ACCOUNT_DB_UPSERT_FAIL')
    }
  } else {
    console.log('GOOGLE_ADS_SELECT_ACCOUNT_DB_UPSERT_FAIL userId missing')
  }

  // Cookies for UI compatibility
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  }
  response.cookies.set(COOKIE.LOGIN_CUSTOMER_ID, loginCustomerId, cookieOpts)
  response.cookies.set(COOKIE.CUSTOMER_ID, customerId, cookieOpts)
  response.cookies.set(COOKIE.ACCOUNT_NAME, descriptiveName, cookieOpts)
  response.cookies.set(COOKIE.CUSTOMER_NAME, descriptiveName, cookieOpts)
  response.cookies.set(COOKIE.IS_MANAGER, 'false', cookieOpts)

  return response
}
