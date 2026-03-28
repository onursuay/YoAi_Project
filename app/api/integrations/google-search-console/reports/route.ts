import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGSCConnection } from '@/lib/google-search-console/connectionStore'
import { upsertGSCConnection } from '@/lib/google-search-console/connectionStore'
import { getCachedReport, setCachedReport } from '@/lib/integrations/reportCache'
import * as gscService from '@/lib/google-search-console/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('session_id')?.value

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const conn = await getGSCConnection(userId)
  if (!conn?.refreshToken || !conn?.siteUrl) {
    return NextResponse.json({ error: 'Google Search Console not connected or no site selected' }, { status: 400 })
  }

  const url = new URL(request.url)
  const dateFrom = url.searchParams.get('from') || getDefaultDateFrom()
  const dateTo = url.searchParams.get('to') || getDefaultDateTo()

  const daysDiff = Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24))
  const prevTo = new Date(new Date(dateFrom).getTime() - 1000 * 60 * 60 * 24)
  const prevFrom = new Date(prevTo.getTime() - daysDiff * 1000 * 60 * 60 * 24)
  const prevFromStr = prevFrom.toISOString().split('T')[0]
  const prevToStr = prevTo.toISOString().split('T')[0]

  // Check cache
  const cached = await getCachedReport(userId, 'google_search_console', 'full', dateFrom, dateTo)
  if (cached) {
    return NextResponse.json(cached)
  }

  try {
    const [kpis, dailySeries, queries, pages, countries, devices] = await Promise.all([
      gscService.getSummaryKpis(conn.refreshToken, conn.siteUrl, dateFrom, dateTo, prevFromStr, prevToStr),
      gscService.getDailySeries(conn.refreshToken, conn.siteUrl, dateFrom, dateTo),
      gscService.getTopQueries(conn.refreshToken, conn.siteUrl, dateFrom, dateTo),
      gscService.getTopPages(conn.refreshToken, conn.siteUrl, dateFrom, dateTo),
      gscService.getCountryTable(conn.refreshToken, conn.siteUrl, dateFrom, dateTo),
      gscService.getDeviceTable(conn.refreshToken, conn.siteUrl, dateFrom, dateTo),
    ])

    const result = {
      provider: 'google_search_console',
      kpis,
      dailySeries,
      tables: [
        {
          key: 'queries',
          columns: [
            { key: 'query', label: 'query' },
            { key: 'clicks', label: 'clicks', format: 'number' },
            { key: 'impressions', label: 'impressions', format: 'number' },
            { key: 'ctr', label: 'ctr', format: 'percent' },
            { key: 'position', label: 'position', format: 'decimal' },
          ],
          rows: queries,
        },
        {
          key: 'pages',
          columns: [
            { key: 'page', label: 'page' },
            { key: 'clicks', label: 'clicks', format: 'number' },
            { key: 'impressions', label: 'impressions', format: 'number' },
            { key: 'ctr', label: 'ctr', format: 'percent' },
            { key: 'position', label: 'position', format: 'decimal' },
          ],
          rows: pages,
        },
        {
          key: 'countries',
          columns: [
            { key: 'country', label: 'country' },
            { key: 'clicks', label: 'clicks', format: 'number' },
            { key: 'impressions', label: 'impressions', format: 'number' },
            { key: 'ctr', label: 'ctr', format: 'percent' },
            { key: 'position', label: 'position', format: 'decimal' },
          ],
          rows: countries,
        },
        {
          key: 'devices',
          columns: [
            { key: 'device', label: 'device' },
            { key: 'clicks', label: 'clicks', format: 'number' },
            { key: 'impressions', label: 'impressions', format: 'number' },
            { key: 'ctr', label: 'ctr', format: 'percent' },
            { key: 'position', label: 'position', format: 'decimal' },
          ],
          rows: devices,
        },
      ],
      fetchedAt: new Date().toISOString(),
    }

    await setCachedReport(userId, 'google_search_console', 'full', dateFrom, dateTo, result as unknown as Record<string, unknown>)
    await upsertGSCConnection(userId, { lastSyncAt: new Date().toISOString(), lastError: null })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch GSC report'
    await upsertGSCConnection(userId, { lastError: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function getDefaultDateFrom(): string {
  const d = new Date()
  d.setDate(d.getDate() - 28)
  return d.toISOString().split('T')[0]
}

function getDefaultDateTo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 3) // GSC data has ~3 day delay
  return d.toISOString().split('T')[0]
}
