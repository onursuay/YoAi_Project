/**
 * Google Analytics Data API v1beta service.
 * Fetches properties, report summaries, and detail tables.
 */

import { refreshAccessToken, fetchWithRetry } from '@/lib/integrations/googleOAuthHelpers'
import { GA_DATA_API_BASE, GA_ADMIN_API_BASE } from '@/lib/integrations/constants'
import type { ReportSummaryKpi, ReportDailySeries, ReportTableRow } from '@/lib/integrations/types'

interface GAProperty {
  name: string         // e.g. "properties/123456"
  displayName: string
  propertyType: string
}

/**
 * List GA4 properties accessible to the user.
 */
export async function listProperties(refreshToken: string): Promise<{ propertyId: string; displayName: string }[]> {
  const accessToken = await refreshAccessToken(refreshToken)
  const res = await fetchWithRetry(`${GA_ADMIN_API_BASE}/accountSummaries?pageSize=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `GA Admin API error ${res.status}`)
  }

  const data = await res.json()
  const properties: { propertyId: string; displayName: string }[] = []

  for (const account of data.accountSummaries || []) {
    for (const prop of account.propertySummaries || []) {
      const propertyId = prop.property?.replace('properties/', '') || ''
      if (propertyId) {
        properties.push({
          propertyId,
          displayName: prop.displayName || `Property ${propertyId}`,
        })
      }
    }
  }

  return properties
}

/**
 * Run a GA4 Data API report.
 */
async function runReport(
  refreshToken: string,
  propertyId: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const accessToken = await refreshAccessToken(refreshToken)
  const res = await fetchWithRetry(`${GA_DATA_API_BASE}/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `GA Data API error ${res.status}`)
  }

  return res.json()
}

/**
 * Get summary KPIs for a date range.
 */
export async function getSummaryKpis(
  refreshToken: string,
  propertyId: string,
  dateFrom: string,
  dateTo: string,
  prevFrom: string,
  prevTo: string
): Promise<ReportSummaryKpi[]> {
  const body = {
    dateRanges: [
      { startDate: dateFrom, endDate: dateTo },
      { startDate: prevFrom, endDate: prevTo },
    ],
    metrics: [
      { name: 'totalUsers' },
      { name: 'sessions' },
      { name: 'engagedSessions' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
      { name: 'conversions' },
      { name: 'totalRevenue' },
    ],
  }

  const data = await runReport(refreshToken, propertyId, body) as {
    rows?: { metricValues: { value: string }[] }[]
  }

  const metricNames = ['users', 'sessions', 'engagedSessions', 'engagementRate', 'avgSessionDuration', 'conversions', 'totalRevenue']
  const formats: ('number' | 'percent' | 'currency' | 'duration' | 'decimal')[] = ['number', 'number', 'number', 'percent', 'duration', 'number', 'currency']

  const currentRow = data.rows?.[0]?.metricValues || []
  const prevRow = data.rows?.[1]?.metricValues || []

  return metricNames.map((key, i) => {
    const current = parseFloat(currentRow[i]?.value || '0')
    const previous = parseFloat(prevRow[i]?.value || '0')
    const changePercent = previous > 0 ? ((current - previous) / previous) * 100 : 0

    return {
      key,
      value: current,
      previousValue: previous,
      changePercent: Math.round(changePercent * 100) / 100,
      format: formats[i],
    }
  })
}

/**
 * Get daily trend series.
 */
export async function getDailySeries(
  refreshToken: string,
  propertyId: string,
  dateFrom: string,
  dateTo: string
): Promise<ReportDailySeries[]> {
  const body = {
    dateRanges: [{ startDate: dateFrom, endDate: dateTo }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'totalUsers' },
      { name: 'sessions' },
      { name: 'engagedSessions' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
    limit: 90,
  }

  const data = await runReport(refreshToken, propertyId, body) as {
    rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[]
  }

  return (data.rows || []).map((row) => {
    const dateStr = row.dimensionValues[0]?.value || ''
    const formatted = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    return {
      date: formatted,
      users: parseInt(row.metricValues[0]?.value || '0', 10),
      sessions: parseInt(row.metricValues[1]?.value || '0', 10),
      engagedSessions: parseInt(row.metricValues[2]?.value || '0', 10),
    }
  })
}

/**
 * Get source/medium breakdown.
 */
export async function getSourceMediumTable(
  refreshToken: string,
  propertyId: string,
  dateFrom: string,
  dateTo: string
): Promise<ReportTableRow[]> {
  const body = {
    dateRanges: [{ startDate: dateFrom, endDate: dateTo }],
    dimensions: [{ name: 'sessionSourceMedium' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'engagementRate' },
      { name: 'conversions' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  }

  const data = await runReport(refreshToken, propertyId, body) as {
    rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[]
  }

  return (data.rows || []).map((row) => ({
    sourceMedium: row.dimensionValues[0]?.value || '(not set)',
    sessions: parseInt(row.metricValues[0]?.value || '0', 10),
    users: parseInt(row.metricValues[1]?.value || '0', 10),
    engagementRate: parseFloat(row.metricValues[2]?.value || '0'),
    conversions: parseInt(row.metricValues[3]?.value || '0', 10),
  }))
}

/**
 * Get landing page performance.
 */
export async function getLandingPageTable(
  refreshToken: string,
  propertyId: string,
  dateFrom: string,
  dateTo: string
): Promise<ReportTableRow[]> {
  const body = {
    dateRanges: [{ startDate: dateFrom, endDate: dateTo }],
    dimensions: [{ name: 'landingPagePlusQueryString' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  }

  const data = await runReport(refreshToken, propertyId, body) as {
    rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[]
  }

  return (data.rows || []).map((row) => ({
    landingPage: row.dimensionValues[0]?.value || '/',
    sessions: parseInt(row.metricValues[0]?.value || '0', 10),
    users: parseInt(row.metricValues[1]?.value || '0', 10),
    engagementRate: parseFloat(row.metricValues[2]?.value || '0'),
    avgDuration: parseFloat(row.metricValues[3]?.value || '0'),
  }))
}

/**
 * Get device category breakdown.
 */
export async function getDeviceTable(
  refreshToken: string,
  propertyId: string,
  dateFrom: string,
  dateTo: string
): Promise<ReportTableRow[]> {
  const body = {
    dateRanges: [{ startDate: dateFrom, endDate: dateTo }],
    dimensions: [{ name: 'deviceCategory' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'engagementRate' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  }

  const data = await runReport(refreshToken, propertyId, body) as {
    rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[]
  }

  return (data.rows || []).map((row) => ({
    device: row.dimensionValues[0]?.value || 'unknown',
    sessions: parseInt(row.metricValues[0]?.value || '0', 10),
    users: parseInt(row.metricValues[1]?.value || '0', 10),
    engagementRate: parseFloat(row.metricValues[2]?.value || '0'),
  }))
}
