import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGAConnection } from '@/lib/google-analytics/connectionStore'
import { upsertGAConnection } from '@/lib/google-analytics/connectionStore'
import { getCachedReport, setCachedReport } from '@/lib/integrations/reportCache'
import * as gaService from '@/lib/google-analytics/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const conn = await getGAConnection(userId)
  if (!conn?.refreshToken || !conn?.propertyId) {
    return NextResponse.json({ error: 'Google Analytics not connected or no property selected' }, { status: 400 })
  }

  const url = new URL(request.url)
  const dateFrom = url.searchParams.get('from') || getDefaultDateFrom()
  const dateTo = url.searchParams.get('to') || getDefaultDateTo()

  // Previous period for comparison
  const daysDiff = Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24))
  const prevTo = new Date(new Date(dateFrom).getTime() - 1000 * 60 * 60 * 24)
  const prevFrom = new Date(prevTo.getTime() - daysDiff * 1000 * 60 * 60 * 24)
  const prevFromStr = prevFrom.toISOString().split('T')[0]
  const prevToStr = prevTo.toISOString().split('T')[0]

  // Check cache
  const cached = await getCachedReport(userId, 'google_analytics', 'full', dateFrom, dateTo)
  if (cached) {
    return NextResponse.json(cached)
  }

  try {
    const [kpis, dailySeries, sourceMedium, landingPages, devices] = await Promise.all([
      gaService.getSummaryKpis(conn.refreshToken, conn.propertyId, dateFrom, dateTo, prevFromStr, prevToStr),
      gaService.getDailySeries(conn.refreshToken, conn.propertyId, dateFrom, dateTo),
      gaService.getSourceMediumTable(conn.refreshToken, conn.propertyId, dateFrom, dateTo),
      gaService.getLandingPageTable(conn.refreshToken, conn.propertyId, dateFrom, dateTo),
      gaService.getDeviceTable(conn.refreshToken, conn.propertyId, dateFrom, dateTo),
    ])

    const result = {
      provider: 'google_analytics',
      kpis,
      dailySeries,
      tables: [
        {
          key: 'sourceMedium',
          columns: [
            { key: 'sourceMedium', label: 'sourceMedium' },
            { key: 'sessions', label: 'sessions', format: 'number' },
            { key: 'users', label: 'users', format: 'number' },
            { key: 'engagementRate', label: 'engagementRate', format: 'percent' },
            { key: 'conversions', label: 'conversions', format: 'number' },
          ],
          rows: sourceMedium,
        },
        {
          key: 'landingPages',
          columns: [
            { key: 'landingPage', label: 'landingPage' },
            { key: 'sessions', label: 'sessions', format: 'number' },
            { key: 'users', label: 'users', format: 'number' },
            { key: 'engagementRate', label: 'engagementRate', format: 'percent' },
            { key: 'avgDuration', label: 'avgDuration', format: 'duration' },
          ],
          rows: landingPages,
        },
        {
          key: 'devices',
          columns: [
            { key: 'device', label: 'device' },
            { key: 'sessions', label: 'sessions', format: 'number' },
            { key: 'users', label: 'users', format: 'number' },
            { key: 'engagementRate', label: 'engagementRate', format: 'percent' },
          ],
          rows: devices,
        },
      ],
      fetchedAt: new Date().toISOString(),
    }

    // Cache
    await setCachedReport(userId, 'google_analytics', 'full', dateFrom, dateTo, result as unknown as Record<string, unknown>)

    // Update last sync
    await upsertGAConnection(userId, { lastSyncAt: new Date().toISOString(), lastError: null })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch GA report'
    await upsertGAConnection(userId, { lastError: message })
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
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}
