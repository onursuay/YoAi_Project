/**
 * Google Search Console API service.
 * Fetches sites, performance reports.
 */

import { refreshAccessToken, fetchWithRetry } from '@/lib/integrations/googleOAuthHelpers'
import { GSC_API_BASE } from '@/lib/integrations/constants'
import type { ReportSummaryKpi, ReportDailySeries, ReportTableRow } from '@/lib/integrations/types'

interface GSCSite {
  siteUrl: string
  permissionLevel: string
}

/**
 * List verified sites accessible to the user.
 */
export async function listSites(refreshToken: string): Promise<{ siteUrl: string; permissionLevel: string }[]> {
  const accessToken = await refreshAccessToken(refreshToken)
  const res = await fetchWithRetry(`${GSC_API_BASE}/sites`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `GSC API error ${res.status}`)
  }

  const data = await res.json()
  return (data.siteEntry || []).map((site: GSCSite) => ({
    siteUrl: site.siteUrl,
    permissionLevel: site.permissionLevel,
  }))
}

/**
 * Run a Search Analytics query.
 */
async function searchAnalytics(
  refreshToken: string,
  siteUrl: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const accessToken = await refreshAccessToken(refreshToken)
  const encodedUrl = encodeURIComponent(siteUrl)
  const res = await fetchWithRetry(
    `${GSC_API_BASE}/sites/${encodedUrl}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `GSC Search Analytics error ${res.status}`)
  }

  return res.json()
}

/**
 * Get summary KPIs (clicks, impressions, ctr, position).
 */
export async function getSummaryKpis(
  refreshToken: string,
  siteUrl: string,
  dateFrom: string,
  dateTo: string,
  prevFrom: string,
  prevTo: string
): Promise<ReportSummaryKpi[]> {
  const [currentData, prevData] = await Promise.all([
    searchAnalytics(refreshToken, siteUrl, {
      startDate: dateFrom,
      endDate: dateTo,
      type: 'web',
    }),
    searchAnalytics(refreshToken, siteUrl, {
      startDate: prevFrom,
      endDate: prevTo,
      type: 'web',
    }),
  ])

  const current = (currentData as { rows?: { clicks: number; impressions: number; ctr: number; position: number }[] }).rows?.[0]
  const prev = (prevData as { rows?: { clicks: number; impressions: number; ctr: number; position: number }[] }).rows?.[0]

  const metrics = [
    { key: 'clicks', format: 'number' as const },
    { key: 'impressions', format: 'number' as const },
    { key: 'ctr', format: 'percent' as const },
    { key: 'position', format: 'decimal' as const },
  ]

  return metrics.map(({ key, format }) => {
    const currentVal = (current as Record<string, number> | undefined)?.[key] ?? 0
    const prevVal = (prev as Record<string, number> | undefined)?.[key] ?? 0
    const changePercent = prevVal > 0 ? ((currentVal - prevVal) / prevVal) * 100 : 0

    return {
      key,
      value: key === 'ctr' ? currentVal * 100 : key === 'position' ? Math.round(currentVal * 10) / 10 : currentVal,
      previousValue: key === 'ctr' ? prevVal * 100 : key === 'position' ? Math.round(prevVal * 10) / 10 : prevVal,
      changePercent: Math.round(changePercent * 100) / 100,
      format,
    }
  })
}

/**
 * Get daily performance series.
 */
export async function getDailySeries(
  refreshToken: string,
  siteUrl: string,
  dateFrom: string,
  dateTo: string
): Promise<ReportDailySeries[]> {
  const data = await searchAnalytics(refreshToken, siteUrl, {
    startDate: dateFrom,
    endDate: dateTo,
    dimensions: ['date'],
    type: 'web',
    rowLimit: 90,
  })

  const rows = (data as { rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }).rows || []

  return rows.map((row) => ({
    date: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: Math.round(row.ctr * 10000) / 100,
    position: Math.round(row.position * 10) / 10,
  }))
}

/**
 * Get top queries table.
 */
export async function getTopQueries(
  refreshToken: string,
  siteUrl: string,
  dateFrom: string,
  dateTo: string
): Promise<ReportTableRow[]> {
  const data = await searchAnalytics(refreshToken, siteUrl, {
    startDate: dateFrom,
    endDate: dateTo,
    dimensions: ['query'],
    type: 'web',
    rowLimit: 25,
  })

  const rows = (data as { rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }).rows || []

  return rows.map((row) => ({
    query: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: Math.round(row.ctr * 10000) / 100,
    position: Math.round(row.position * 10) / 10,
  }))
}

/**
 * Get top pages table.
 */
export async function getTopPages(
  refreshToken: string,
  siteUrl: string,
  dateFrom: string,
  dateTo: string
): Promise<ReportTableRow[]> {
  const data = await searchAnalytics(refreshToken, siteUrl, {
    startDate: dateFrom,
    endDate: dateTo,
    dimensions: ['page'],
    type: 'web',
    rowLimit: 25,
  })

  const rows = (data as { rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }).rows || []

  return rows.map((row) => ({
    page: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: Math.round(row.ctr * 10000) / 100,
    position: Math.round(row.position * 10) / 10,
  }))
}

/**
 * Get country breakdown.
 */
export async function getCountryTable(
  refreshToken: string,
  siteUrl: string,
  dateFrom: string,
  dateTo: string
): Promise<ReportTableRow[]> {
  const data = await searchAnalytics(refreshToken, siteUrl, {
    startDate: dateFrom,
    endDate: dateTo,
    dimensions: ['country'],
    type: 'web',
    rowLimit: 20,
  })

  const rows = (data as { rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }).rows || []

  return rows.map((row) => ({
    country: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: Math.round(row.ctr * 10000) / 100,
    position: Math.round(row.position * 10) / 10,
  }))
}

/**
 * Get device breakdown.
 */
export async function getDeviceTable(
  refreshToken: string,
  siteUrl: string,
  dateFrom: string,
  dateTo: string
): Promise<ReportTableRow[]> {
  const data = await searchAnalytics(refreshToken, siteUrl, {
    startDate: dateFrom,
    endDate: dateTo,
    dimensions: ['device'],
    type: 'web',
  })

  const rows = (data as { rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }).rows || []

  return rows.map((row) => ({
    device: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: Math.round(row.ctr * 10000) / 100,
    position: Math.round(row.position * 10) / 10,
  }))
}
