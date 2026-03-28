'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import {
  BarChart3,
  TrendingUp,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

/* ────── Types ────── */

type ProviderKey = 'meta_ads' | 'google_ads' | 'google_analytics' | 'google_search_console'

interface ProviderConfig {
  key: ProviderKey
  icon: string
  statusUrl: string
  reportUrl: string
  needsProperty?: boolean
}

interface ConnectionState {
  connected: boolean
  hasSelection: boolean
  label?: string
}

interface KpiItem {
  key: string
  value: number | string
  previousValue?: number | string
  changePercent?: number
  format?: string
}

interface TableDef {
  key: string
  columns: { key: string; label: string; format?: string }[]
  rows: Record<string, string | number>[]
}

interface ReportPayload {
  kpis: KpiItem[]
  dailySeries: Record<string, string | number>[]
  tables: TableDef[]
  fetchedAt: string
}

/* ────── Provider configs ────── */

const PROVIDERS: ProviderConfig[] = [
  { key: 'meta_ads', icon: '/integration-icons/meta.svg', statusUrl: '/api/meta/status', reportUrl: '/api/meta/insights' },
  { key: 'google_ads', icon: '/integration-icons/google-ads.svg', statusUrl: '/api/google/status', reportUrl: '/api/integrations/google-ads/dashboard-kpis' },
  { key: 'google_analytics', icon: '/integration-icons/google-analytics.svg', statusUrl: '/api/integrations/google-analytics/status', reportUrl: '/api/integrations/google-analytics/reports', needsProperty: true },
  { key: 'google_search_console', icon: '/integration-icons/google-search-console.svg', statusUrl: '/api/integrations/google-search-console/status', reportUrl: '/api/integrations/google-search-console/reports', needsProperty: true },
]

/* ────── Date helpers ────── */

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

/* ────── Main content ────── */

function RaporlarContent() {
  const t = useTranslations('dashboard.raporlar')
  const searchParams = useSearchParams()

  const [connections, setConnections] = useState<Record<ProviderKey, ConnectionState>>({
    meta_ads: { connected: false, hasSelection: false },
    google_ads: { connected: false, hasSelection: false },
    google_analytics: { connected: false, hasSelection: false },
    google_search_console: { connected: false, hasSelection: false },
  })
  const [connectionsLoading, setConnectionsLoading] = useState(true)
  const [activeProvider, setActiveProvider] = useState<ProviderKey | null>(null)
  const [reportData, setReportData] = useState<Record<string, ReportPayload>>({})
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState(getDefaultDateFrom)
  const [dateTo, setDateTo] = useState(getDefaultDateTo)

  // Load all connection statuses
  useEffect(() => {
    let cancelled = false
    async function loadStatuses() {
      try {
        await fetch('/api/session', { credentials: 'include' })
        const results = await Promise.all(
          PROVIDERS.map(async (p) => {
            try {
              const res = await fetch(p.statusUrl, { credentials: 'include' })
              if (!res.ok) return { key: p.key, connected: false, hasSelection: false }
              const data = await res.json()

              if (p.key === 'meta_ads') {
                return {
                  key: p.key,
                  connected: Boolean(data?.connected),
                  hasSelection: Boolean(data?.adAccountId),
                  label: data?.adAccountName,
                }
              }
              if (p.key === 'google_ads') {
                return {
                  key: p.key,
                  connected: Boolean(data?.connected),
                  hasSelection: Boolean(data?.hasSelectedAccount ?? data?.accountId),
                  label: data?.accountName,
                }
              }
              if (p.key === 'google_analytics') {
                return {
                  key: p.key,
                  connected: Boolean(data?.connected),
                  hasSelection: Boolean(data?.hasSelectedProperty),
                  label: data?.propertyName,
                }
              }
              if (p.key === 'google_search_console') {
                return {
                  key: p.key,
                  connected: Boolean(data?.connected),
                  hasSelection: Boolean(data?.hasSelectedSite),
                  label: data?.siteName || data?.siteUrl,
                }
              }
              return { key: p.key, connected: false, hasSelection: false }
            } catch {
              return { key: p.key, connected: false, hasSelection: false }
            }
          })
        )

        if (cancelled) return

        const newConnections: Record<string, ConnectionState> = {}
        let firstConnected: ProviderKey | null = null

        for (const r of results) {
          newConnections[r.key] = { connected: r.connected, hasSelection: r.hasSelection, label: r.label }
          if (!firstConnected && r.connected && r.hasSelection) {
            firstConnected = r.key as ProviderKey
          }
        }

        setConnections(newConnections as Record<ProviderKey, ConnectionState>)

        // Auto-select first connected provider
        const paramProvider = searchParams.get('provider') as ProviderKey | null
        if (paramProvider && newConnections[paramProvider]?.connected) {
          setActiveProvider(paramProvider)
        } else if (firstConnected) {
          setActiveProvider(firstConnected)
        } else {
          // select first provider even if not connected
          setActiveProvider('meta_ads')
        }
      } catch (error) {
        console.error('Failed to load connection statuses:', error)
      } finally {
        if (!cancelled) setConnectionsLoading(false)
      }
    }
    loadStatuses()
    return () => { cancelled = true }
  }, [searchParams])

  // Fetch report data when provider or dates change
  const fetchReport = useCallback(async (provider: ProviderKey) => {
    const conn = connections[provider]
    if (!conn?.connected || !conn?.hasSelection) return

    const cacheKey = `${provider}_${dateFrom}_${dateTo}`
    if (reportData[cacheKey]) return

    setReportLoading(true)
    setReportError(null)

    try {
      const config = PROVIDERS.find((p) => p.key === provider)!
      let url: string

      if (provider === 'meta_ads') {
        url = `${config.reportUrl}?since=${dateFrom}&until=${dateTo}`
      } else if (provider === 'google_ads') {
        url = `${config.reportUrl}?from=${dateFrom}&to=${dateTo}`
      } else {
        url = `${config.reportUrl}?from=${dateFrom}&to=${dateTo}`
      }

      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `HTTP ${res.status}`)
      }
      const data = await res.json()

      // Normalize different response shapes
      const normalized = normalizeReportData(provider, data)
      setReportData((prev) => ({ ...prev, [cacheKey]: normalized }))
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setReportLoading(false)
    }
  }, [connections, dateFrom, dateTo, reportData])

  useEffect(() => {
    if (activeProvider && !connectionsLoading) {
      fetchReport(activeProvider)
    }
  }, [activeProvider, connectionsLoading, fetchReport])

  const currentCacheKey = activeProvider ? `${activeProvider}_${dateFrom}_${dateTo}` : ''
  const currentReport = reportData[currentCacheKey] || null
  const currentConn = activeProvider ? connections[activeProvider] : null

  // Chart line keys
  const chartLines = useMemo(() => {
    if (!currentReport?.dailySeries?.length) return []
    const keys = Object.keys(currentReport.dailySeries[0]).filter((k) => k !== 'date')
    return keys.slice(0, 4) // max 4 lines
  }, [currentReport])

  const CHART_COLORS = ['#2BB673', '#3B82F6', '#F59E0B', '#EF4444']

  const handleRefresh = () => {
    if (!activeProvider) return
    const cacheKey = `${activeProvider}_${dateFrom}_${dateTo}`
    setReportData((prev) => {
      const next = { ...prev }
      delete next[cacheKey]
      return next
    })
    fetchReport(activeProvider)
  }

  return (
    <>
      <Topbar title={t('title')} description={t('description')} />
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">

          {/* Provider Tabs */}
          <div className="flex flex-wrap gap-3 mb-6">
            {PROVIDERS.map((p) => {
              const conn = connections[p.key]
              const isActive = activeProvider === p.key
              const isConnected = conn.connected && conn.hasSelection

              return (
                <button
                  key={p.key}
                  onClick={() => isConnected && setActiveProvider(p.key)}
                  disabled={!isConnected}
                  className={`
                    flex items-center gap-3 px-5 py-3 rounded-xl border-2 font-medium text-sm transition-all
                    ${isActive
                      ? 'border-primary bg-primary/5 text-gray-900 shadow-sm'
                      : isConnected
                        ? 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow-sm'
                        : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60'
                    }
                  `}
                >
                  <img src={p.icon} alt="" className="h-5 w-5 object-contain" />
                  <span>{t(`providers.${p.key}`)}</span>
                  {isConnected ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  ) : (
                    <span className="text-xs text-gray-400">{t('notConnected')}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Date filter + Refresh */}
          {activeProvider && currentConn?.connected && currentConn?.hasSelection && (
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="text-sm text-gray-700 border-none outline-none bg-transparent"
                />
                <span className="text-gray-400">—</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="text-sm text-gray-700 border-none outline-none bg-transparent"
                />
              </div>
              <button
                onClick={handleRefresh}
                disabled={reportLoading}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${reportLoading ? 'animate-spin' : ''}`} />
                {t('refresh')}
              </button>
            </div>
          )}

          {/* Content Area */}
          {connectionsLoading ? (
            <ReportSkeleton />
          ) : !activeProvider || !currentConn?.connected || !currentConn?.hasSelection ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('noConnection')}</h3>
              <p className="text-gray-500 text-sm">{t('noConnectionDesc')}</p>
            </div>
          ) : reportLoading && !currentReport ? (
            <ReportSkeleton />
          ) : reportError && !currentReport ? (
            <div className="bg-white rounded-2xl border border-red-200 p-12 text-center">
              <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('error')}</h3>
              <p className="text-red-500 text-sm mb-4">{reportError}</p>
              <button onClick={handleRefresh} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90">
                {t('retry')}
              </button>
            </div>
          ) : currentReport ? (
            <div className="space-y-6">
              {/* KPI Cards */}
              {currentReport.kpis.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                  {currentReport.kpis.map((kpi) => (
                    <KpiCard key={kpi.key} kpi={kpi} t={t} />
                  ))}
                </div>
              )}

              {/* Daily Trend Chart */}
              {currentReport.dailySeries.length > 0 && chartLines.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    {t('dailyTrend')}
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={currentReport.dailySeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: '#9ca3af' }}
                          tickFormatter={(v) => {
                            const d = new Date(v)
                            return `${d.getDate()}/${d.getMonth() + 1}`
                          }}
                        />
                        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        {chartLines.map((key, i) => (
                          <Line
                            key={key}
                            type="monotone"
                            dataKey={key}
                            name={t(`metrics.${key}`, { defaultMessage: key })}
                            stroke={CHART_COLORS[i % CHART_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Data Tables */}
              {currentReport.tables.map((table) => (
                <div key={table.key} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-primary" />
                      {t(`tables.${table.key}`, { defaultMessage: table.key })}
                    </h3>
                  </div>
                  {table.rows.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">{t('noData')}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            {table.columns.map((col) => (
                              <th
                                key={col.key}
                                className="px-4 py-3 text-left font-medium text-gray-600 text-xs uppercase tracking-wider"
                              >
                                {t(`metrics.${col.label}`, { defaultMessage: col.label })}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.map((row, ri) => (
                            <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                              {table.columns.map((col) => (
                                <td key={col.key} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                  {formatCellValue(row[col.key], col.format)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}

              {/* Fetched at */}
              {currentReport.fetchedAt && (
                <p className="text-xs text-gray-400 text-right">
                  {t('fetchedAt')}: {new Date(currentReport.fetchedAt).toLocaleString()}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}

/* ────── KPI Card ────── */

function KpiCard({ kpi, t }: { kpi: KpiItem; t: (key: string, opts?: Record<string, string>) => string }) {
  const formattedValue = formatKpiValue(kpi.value, kpi.format)
  const hasChange = typeof kpi.changePercent === 'number' && kpi.changePercent !== 0
  const isPositive = (kpi.changePercent || 0) > 0
  // For position metric, lower is better
  const isPositionMetric = kpi.key === 'position'
  const changePositive = isPositionMetric ? !isPositive : isPositive

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider truncate">
        {t(`metrics.${kpi.key}`, { defaultMessage: kpi.key })}
      </p>
      <p className="text-xl font-bold text-gray-900">{formattedValue}</p>
      {hasChange && (
        <p className={`text-xs font-medium mt-1 ${changePositive ? 'text-green-600' : 'text-red-500'}`}>
          {isPositive ? '+' : ''}{kpi.changePercent?.toFixed(1)}%
        </p>
      )}
    </div>
  )
}

/* ────── Skeleton ────── */

function ReportSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
            <div className="h-6 bg-gray-200 rounded w-20" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
        <div className="h-72 bg-gray-100 rounded-lg" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="h-4 bg-gray-200 rounded w-40 mb-4" />
        <div className="h-48 bg-gray-100 rounded-lg" />
      </div>
    </div>
  )
}

/* ────── Format helpers ────── */

function formatKpiValue(value: number | string, format?: string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return String(value)

  switch (format) {
    case 'percent':
      return `${num.toFixed(1)}%`
    case 'currency':
      return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    case 'duration': {
      const mins = Math.floor(num / 60)
      const secs = Math.round(num % 60)
      return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
    }
    case 'decimal':
      return num.toFixed(1)
    default:
      return num >= 1000 ? num.toLocaleString() : String(Math.round(num * 100) / 100)
  }
}

function formatCellValue(value: string | number | undefined, format?: string): string {
  if (value === undefined || value === null) return '-'
  if (typeof value === 'string' && !format) return value
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return String(value)
  return formatKpiValue(num, format)
}

/* ────── Normalize report data from different provider shapes ────── */

function normalizeReportData(provider: ProviderKey, data: Record<string, unknown>): ReportPayload {
  // GA and GSC return our standard format
  if (provider === 'google_analytics' || provider === 'google_search_console') {
    return data as unknown as ReportPayload
  }

  // Meta Ads: normalize from insights response
  if (provider === 'meta_ads') {
    return normalizeMetaReport(data)
  }

  // Google Ads: normalize from dashboard-kpis response
  if (provider === 'google_ads') {
    return normalizeGoogleAdsReport(data)
  }

  return { kpis: [], dailySeries: [], tables: [], fetchedAt: new Date().toISOString() }
}

function normalizeMetaReport(data: Record<string, unknown>): ReportPayload {
  const kpis: KpiItem[] = []
  const summary = (data as Record<string, unknown>)

  // Extract KPIs from Meta insights format
  const metricKeys = ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'reach', 'purchases', 'roas']
  const formatMap: Record<string, string> = {
    spend: 'currency', ctr: 'percent', cpc: 'currency', roas: 'decimal',
    impressions: 'number', clicks: 'number', reach: 'number', purchases: 'number',
  }

  for (const key of metricKeys) {
    const val = (summary as Record<string, unknown>)[key]
    if (val !== undefined && val !== null) {
      kpis.push({
        key,
        value: typeof val === 'number' ? val : parseFloat(String(val)) || 0,
        format: formatMap[key] || 'number',
      })
    }
  }

  const dailySeries = Array.isArray((summary as Record<string, unknown>).dailySeries)
    ? (summary as Record<string, unknown>).dailySeries as Record<string, string | number>[]
    : []

  const campaigns = Array.isArray((summary as Record<string, unknown>).campaigns)
    ? (summary as Record<string, unknown>).campaigns as Record<string, string | number>[]
    : []

  const tables: TableDef[] = []
  if (campaigns.length > 0) {
    tables.push({
      key: 'campaigns',
      columns: [
        { key: 'name', label: 'campaign' },
        { key: 'spend', label: 'spend', format: 'currency' },
        { key: 'impressions', label: 'impressions', format: 'number' },
        { key: 'clicks', label: 'clicks', format: 'number' },
        { key: 'ctr', label: 'ctr', format: 'percent' },
      ],
      rows: campaigns,
    })
  }

  return { kpis, dailySeries, tables, fetchedAt: new Date().toISOString() }
}

function normalizeGoogleAdsReport(data: Record<string, unknown>): ReportPayload {
  const kpis: KpiItem[] = []

  const metricKeys = ['cost', 'impressions', 'clicks', 'ctr', 'averageCpc', 'conversions', 'conversionRate', 'costPerConversion']
  const formatMap: Record<string, string> = {
    cost: 'currency', ctr: 'percent', averageCpc: 'currency', conversionRate: 'percent', costPerConversion: 'currency',
    impressions: 'number', clicks: 'number', conversions: 'number',
  }

  for (const key of metricKeys) {
    const val = (data as Record<string, unknown>)[key]
    if (val !== undefined && val !== null) {
      kpis.push({
        key,
        value: typeof val === 'number' ? val : parseFloat(String(val)) || 0,
        format: formatMap[key] || 'number',
      })
    }
  }

  const dailySeries = Array.isArray((data as Record<string, unknown>).dailySeries)
    ? (data as Record<string, unknown>).dailySeries as Record<string, string | number>[]
    : []

  const campaigns = Array.isArray((data as Record<string, unknown>).campaigns)
    ? (data as Record<string, unknown>).campaigns as Record<string, string | number>[]
    : []

  const tables: TableDef[] = []
  if (campaigns.length > 0) {
    tables.push({
      key: 'campaigns',
      columns: [
        { key: 'name', label: 'campaign' },
        { key: 'cost', label: 'cost', format: 'currency' },
        { key: 'impressions', label: 'impressions', format: 'number' },
        { key: 'clicks', label: 'clicks', format: 'number' },
        { key: 'ctr', label: 'ctr', format: 'percent' },
        { key: 'conversions', label: 'conversions', format: 'number' },
      ],
      rows: campaigns,
    })
  }

  return { kpis, dailySeries, tables, fetchedAt: new Date().toISOString() }
}

/* ────── Page export ────── */

export default function RaporlarPage() {
  return (
    <Suspense
      fallback={
        <>
          <Topbar title="..." description="" />
          <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">
              <ReportSkeleton />
            </div>
          </div>
        </>
      }
    >
      <RaporlarContent />
    </Suspense>
  )
}
