'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Topbar from '@/components/Topbar'
import { ToastContainer } from '@/components/Toast'
import type { ToastType } from '@/components/Toast'
import DashboardKpiCard from '@/components/DashboardKpiCard'
import AlertBanner from '@/components/AlertBanner'
import DateRangePicker from '@/components/DateRangePicker'
import TikTokTableReal from './components/TikTokTableReal'
import TikTokTableSkeleton from './components/TikTokTableSkeleton'
import TikTokAccountModal from './components/TikTokAccountModal'
import { RefreshCw, Search, Eye, EyeOff, X } from 'lucide-react'
import { useTikTokAdsKpis } from '@/hooks/tiktok/useTikTokAdsKpis'
import { useTikTokAdsCampaigns } from '@/hooks/tiktok/useTikTokAdsCampaigns'
import { useTikTokAdsConnection } from '@/hooks/tiktok/useTikTokAdsConnection'

export default function TikTokPage() {
  const t = useTranslations('dashboard.tiktok')
  const tTable = useTranslations('dashboard.meta')
  const locale = useLocale()
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType }>>([])
  const [emptyBannerDismissed, setEmptyBannerDismissed] = useState(false)

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const kpis = useTikTokAdsKpis()
  const data = useTikTokAdsCampaigns({ addToast })

  const onAccountSelected = useCallback(async () => {
    data.setTableError(null)
    kpis.fetchKpis()
    await data.fetchCampaigns(kpis.dateFrom, kpis.dateTo)
  }, [kpis, data])

  const onInitReady = useCallback(async () => {
    await kpis.fetchKpis()
  }, [kpis])

  const connection = useTikTokAdsConnection({ addToast, onAccountSelected, onInitReady })

  useEffect(() => {
    fetch('/api/session', { credentials: 'include' }).catch(() => {})
  }, [])

  // Fetch campaigns when connection is ready
  useEffect(() => {
    if (!connection.selected) return
    data.fetchCampaigns(kpis.dateFrom, kpis.dateTo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.selected?.advertiserId])

  const handleDateChange = useCallback((startDate: string, endDate: string, preset?: string) => {
    kpis.setDateRange(startDate, endDate, preset)
    data.setTableError(null)
    kpis.fetchKpis(startDate, endDate)
    data.fetchCampaigns(startDate, endDate, data.showInactive)
  }, [kpis, data])

  const handleShowInactiveChange = useCallback((show: boolean) => {
    data.setShowInactive(show)
    data.setTableError(null)
    data.fetchCampaigns(kpis.dateFrom, kpis.dateTo, show)
  }, [kpis.dateFrom, kpis.dateTo, data])

  const handleRefresh = useCallback(() => {
    data.setTableError(null)
    data.fetchCampaigns(kpis.dateFrom, kpis.dateTo, data.showInactive)
  }, [kpis.dateFrom, kpis.dateTo, data])

  const tableColumns = [
    { key: 'status', label: tTable('table.status') },
    { key: 'campaign', label: tTable('table.campaign') },
    { key: 'objective', label: t('table.objective') },
    { key: 'budget', label: tTable('table.budget') },
    { key: 'spent', label: tTable('table.spent') },
    { key: 'impressions', label: tTable('table.impressions') },
    { key: 'clicks', label: tTable('table.clicks') },
    { key: 'ctr', label: tTable('table.ctr') },
    { key: 'cpc', label: tTable('table.cpc') },
    { key: 'conversions', label: t('table.conversions') },
    { key: 'reach', label: t('table.reach') },
  ]

  const showEmptyState = !connection.isLoading && (!connection.isTikTokConnected || !connection.selected)

  // KPI computations
  const ALWAYS_HIDDEN = ['CAMPAIGN_STATUS_DELETE']
  const campaignsForKpi = useMemo(() => {
    return (data.campaigns || []).filter(c => !ALWAYS_HIDDEN.includes(c.status ?? ''))
  }, [data.campaigns])

  const campaignKpis = useMemo(() => {
    const active = campaignsForKpi.filter(c => c.publishEnabled)
    const totals = { cost: 0, clicks: 0, impressions: 0, conversions: 0, reach: 0 }
    for (const c of active) {
      totals.cost += c.amountSpent || 0
      totals.clicks += c.clicks || 0
      totals.impressions += c.impressions || 0
      totals.conversions += c.conversions || 0
      totals.reach += c.reach || 0
    }
    return {
      ...totals,
      avgCtr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    }
  }, [campaignsForKpi])

  const showPlaceholderKpis = showEmptyState || (data.campaignsLoading && data.campaigns.length === 0)
  const placeholderChartData = [0, 0]
  const kpiDates = kpis.kpisData?.dates ?? []
  const localeTag = locale === 'en' ? 'en-US' : 'tr-TR'
  const fmtCurrency = (v: number) => `${v.toLocaleString(localeTag, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TRY`
  const fmtInt = (v: number) => v.toLocaleString(localeTag)
  const fmtPct = (v: number) => `${v.toLocaleString(localeTag, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

  // Tooltip formatters
  const gTooltipCost = useMemo(() => kpis.kpisData?.series.cost.map(fmtCurrency) ?? [], [kpis.kpisData])
  const gTooltipClicks = useMemo(() => kpis.kpisData?.series.clicks.map(fmtInt) ?? [], [kpis.kpisData])
  const gTooltipImpressions = useMemo(() => kpis.kpisData?.series.impressions.map(fmtInt) ?? [], [kpis.kpisData])
  const gTooltipConversions = useMemo(() => kpis.kpisData?.series.conversions.map(fmtInt) ?? [], [kpis.kpisData])
  const gTooltipCtr = useMemo(() => kpis.kpisData?.series.ctr.map(fmtPct) ?? [], [kpis.kpisData])
  const gTooltipReach = useMemo(() => kpis.kpisData?.series.reach.map(fmtInt) ?? [], [kpis.kpisData])

  const periodLabel = (() => {
    const presetLabels: Record<string, string> = {
      'all_time': tTable('dateRange.allTime'),
      'today': tTable('dateRange.today'),
      'yesterday': tTable('dateRange.yesterday'),
      'last_7d': tTable('dateRange.last7d'),
      'last_30d': tTable('dateRange.last30d'),
      'this_month': tTable('dateRange.thisMonth'),
    }
    if (kpis.datePreset !== 'custom' && presetLabels[kpis.datePreset]) {
      return presetLabels[kpis.datePreset]
    }
    const fmt = (d: string) => new Date(d).toLocaleDateString(localeTag, { day: 'numeric', month: 'short' })
    return `${fmt(kpis.dateFrom)} - ${fmt(kpis.dateTo)}`
  })()

  // Filtered campaigns for table
  const filteredCampaigns = useMemo(() => {
    let list = campaignsForKpi
    if (!data.showInactive) {
      list = list.filter(c => c.publishEnabled)
    }
    if (data.searchQuery.trim()) {
      const q = data.searchQuery.toLowerCase()
      list = list.filter(c => c.campaignName.toLowerCase().includes(q))
    }
    return list
  }, [campaignsForKpi, data.showInactive, data.searchQuery])

  function deltaDisplay(change: number | undefined): string {
    if (change === undefined || change === null) return ''
    return `${change >= 0 ? '↑' : '↓'} %${Math.abs(change).toFixed(1)}`
  }

  return (
    <>
      <Topbar
        title={t('title')}
        description={t('description')}
      />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-6 space-y-6">
          {/* Date picker + refresh */}
          {!showEmptyState && (
            <div className="flex items-center justify-between">
              <div>
                {connection.selected && (
                  <p className="text-sm text-gray-500">
                    {connection.selected.advertiserName}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <DateRangePicker
                  onDateChange={handleDateChange}
                  locale={locale}
                />
                <button
                  onClick={handleRefresh}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          )}

          {/* KPI Cards */}
          {!showEmptyState && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <DashboardKpiCard
                label={tTable('kpi.spend')}
                periodLabel={periodLabel}
                value={showPlaceholderKpis ? '—' : fmtCurrency(campaignKpis.cost)}
                deltaDisplay={deltaDisplay(kpis.kpisData?.changes.cost)}
                chartData={kpis.kpisData?.series.cost && kpis.kpisData.series.cost.length >= 2 ? kpis.kpisData.series.cost : placeholderChartData}
                chartColor={showPlaceholderKpis ? 'gray' : 'red'}
                chartLabels={kpiDates}
                chartTooltipValues={gTooltipCost}
                locale={locale}
              />
              <DashboardKpiCard
                label={tTable('kpi.impressions')}
                periodLabel={periodLabel}
                value={showPlaceholderKpis ? '—' : fmtInt(campaignKpis.impressions)}
                deltaDisplay={deltaDisplay(kpis.kpisData?.changes.impressions)}
                chartData={kpis.kpisData?.series.impressions && kpis.kpisData.series.impressions.length >= 2 ? kpis.kpisData.series.impressions : placeholderChartData}
                chartColor={showPlaceholderKpis ? 'gray' : 'green'}
                chartLabels={kpiDates}
                chartTooltipValues={gTooltipImpressions}
                locale={locale}
              />
              <DashboardKpiCard
                label={tTable('kpi.clicks')}
                periodLabel={periodLabel}
                value={showPlaceholderKpis ? '—' : fmtInt(campaignKpis.clicks)}
                deltaDisplay={deltaDisplay(kpis.kpisData?.changes.clicks)}
                chartData={kpis.kpisData?.series.clicks && kpis.kpisData.series.clicks.length >= 2 ? kpis.kpisData.series.clicks : placeholderChartData}
                chartColor={showPlaceholderKpis ? 'gray' : 'green'}
                chartLabels={kpiDates}
                chartTooltipValues={gTooltipClicks}
                locale={locale}
              />
              <DashboardKpiCard
                label={tTable('kpi.ctr')}
                periodLabel={periodLabel}
                value={showPlaceholderKpis ? '—' : fmtPct(campaignKpis.avgCtr)}
                deltaDisplay={deltaDisplay(kpis.kpisData?.changes.ctr)}
                chartData={kpis.kpisData?.series.ctr && kpis.kpisData.series.ctr.length >= 2 ? kpis.kpisData.series.ctr : placeholderChartData}
                chartColor={showPlaceholderKpis ? 'gray' : 'red'}
                chartLabels={kpiDates}
                chartTooltipValues={gTooltipCtr}
                locale={locale}
              />
              <DashboardKpiCard
                label={t('kpi.conversions')}
                periodLabel={periodLabel}
                value={showPlaceholderKpis ? '—' : fmtInt(campaignKpis.conversions)}
                deltaDisplay={deltaDisplay(kpis.kpisData?.changes.conversions)}
                chartData={kpis.kpisData?.series.conversions && kpis.kpisData.series.conversions.length >= 2 ? kpis.kpisData.series.conversions : placeholderChartData}
                chartColor={showPlaceholderKpis ? 'gray' : 'green'}
                chartLabels={kpiDates}
                chartTooltipValues={gTooltipConversions}
                locale={locale}
              />
              <DashboardKpiCard
                label={t('kpi.reach')}
                periodLabel={periodLabel}
                value={showPlaceholderKpis ? '—' : fmtInt(campaignKpis.reach)}
                deltaDisplay={deltaDisplay(kpis.kpisData?.changes.reach)}
                chartData={kpis.kpisData?.series.reach && kpis.kpisData.series.reach.length >= 2 ? kpis.kpisData.series.reach : placeholderChartData}
                chartColor={showPlaceholderKpis ? 'gray' : 'green'}
                chartLabels={kpiDates}
                chartTooltipValues={gTooltipReach}
                locale={locale}
              />
            </div>
          )}

          {/* Empty state alert */}
          {showEmptyState && !emptyBannerDismissed && (
            <AlertBanner
              title={t('notConnected.title')}
              description={t('notConnected.description')}
              onClose={() => setEmptyBannerDismissed(true)}
            >
              {!connection.isTikTokConnected ? (
                <a
                  href="/api/integrations/tiktok-ads/start"
                  className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors"
                >
                  {t('connectButton')}
                </a>
              ) : (
                <button
                  onClick={connection.openAccountModal}
                  className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors"
                >
                  {t('selectAccount')}
                </button>
              )}
            </AlertBanner>
          )}

          {/* Account selection modal */}
          {connection.showAccountModal && (
            <TikTokAccountModal
              advertisers={connection.advertisers}
              advertisersLoading={connection.advertisersLoading}
              selectingKey={connection.selectingKey}
              accountsError={connection.accountsError}
              onSelect={(adv) => connection.selectAccount(adv.advertiserId, adv.name)}
              onClose={() => connection.setShowAccountModal(false)}
            />
          )}

          {/* Campaign Table */}
          {!showEmptyState && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {/* Table toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-gray-700">{t('tabs.campaigns')}</h2>
                  <span className="text-xs text-gray-400">
                    {filteredCampaigns.length} {t('campaignCount')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder={tTable('search.placeholder')}
                      value={data.searchQuery}
                      onChange={(e) => data.setSearchQuery(e.target.value)}
                      className="pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-400 w-48"
                    />
                    {data.searchQuery && (
                      <button
                        onClick={() => data.setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                      >
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    )}
                  </div>
                  {/* Show inactive toggle */}
                  <button
                    onClick={() => handleShowInactiveChange(!data.showInactive)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      data.showInactive
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {data.showInactive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {data.showInactive ? tTable('filters.hideInactive') : tTable('filters.showInactive')}
                  </button>
                </div>
              </div>

              {/* Table Error */}
              {data.tableError && (
                <div className="px-4 py-3 bg-red-50 border-b border-red-100">
                  <p className="text-sm text-red-700">{data.tableError}</p>
                </div>
              )}

              {/* Table Content */}
              {data.campaignsLoading ? (
                <TikTokTableSkeleton columns={tableColumns} />
              ) : filteredCampaigns.length > 0 ? (
                <TikTokTableReal campaigns={filteredCampaigns} locale={localeTag} />
              ) : (
                <div className="px-4 py-12 text-center text-gray-400 text-sm">
                  {data.searchQuery ? tTable('search.noResults') : t('noCampaigns')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
