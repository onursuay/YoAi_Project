'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Topbar from '@/components/Topbar'
import Tabs from '@/components/Tabs'
import { ToastContainer, ToastType } from '@/components/Toast'
import TableShimmer from '@/components/TableShimmer'
import DashboardKpiCard from '@/components/DashboardKpiCard'
import AlertBanner from '@/components/AlertBanner'
import GoogleCampaignWizard from '@/components/google/wizard/GoogleCampaignWizard'
import GoogleAccountModal from '@/components/google/GoogleAccountModal'
import DateRangePicker from '@/components/DateRangePicker'
import GoogleTableReal from './components/GoogleTableReal'
import GoogleTableSkeleton from './components/GoogleTableSkeleton'
import GoogleCampaignEditOverlay from '@/components/google/GoogleCampaignEditOverlay'
import GoogleAdGroupEditOverlay from '@/components/google/GoogleAdGroupEditOverlay'
import GoogleAdEditOverlay from '@/components/google/GoogleAdEditOverlay'
import CampaignEditPanel from '@/components/google/CampaignEditPanel'
import { RefreshCw, Pencil, Trash2, Copy, Search, Eye, EyeOff, X } from 'lucide-react'
import { useGoogleAdsKpis } from '@/hooks/google/useGoogleAdsKpis'
import { useGoogleAdsCampaigns } from '@/hooks/google/useGoogleAdsCampaigns'
import { useGoogleAdsConnection } from '@/hooks/google/useGoogleAdsConnection'

export default function GooglePage() {
  const t = useTranslations('dashboard.google')
  const tTable = useTranslations('dashboard.meta')
  const locale = useLocale()
  const [activeTab, setActiveTab] = useState('kampanyalar')
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType }>>([])
  const [showWizard, setShowWizard] = useState(false)
  const [emptyBannerDismissed, setEmptyBannerDismissed] = useState(false)

  // Selection state — one per tab
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [selectedAdGroupId, setSelectedAdGroupId] = useState<string | null>(null)
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Campaign edit panel (tree view)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)

  // Edit overlay state
  const [editingCampaign, setEditingCampaign] = useState<{ id: string; name: string } | null>(null)
  const [editingAdGroup, setEditingAdGroup] = useState<{ id: string; name: string } | null>(null)
  const [editingAd, setEditingAd] = useState<{ id: string; name: string; adGroupId: string } | null>(null)

  const [bulkDeleting, setBulkDeleting] = useState<{ ids: string[]; type: 'campaign' | 'adgroup' | 'ad' } | null>(null)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [editQueue, setEditQueue] = useState<Array<{ id: string; name: string; adGroupId?: string }>>([])

  const [multiEditAdGroups, setMultiEditAdGroups] = useState<Array<{ adGroupId: string; adGroupName: string; campaignId: string }>>([])
  const [multiEditAds, setMultiEditAds] = useState<Array<{ adId: string; adName: string; adGroupId: string; campaignId: string }>>([])
  const [refreshToken, setRefreshToken] = useState(0)

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const kpis = useGoogleAdsKpis()
  const data = useGoogleAdsCampaigns({ addToast, tTable: (key: string) => tTable(key), tGoogle: (key: string) => t(key) })

  const onAccountSelected = useCallback(async () => {
    data.setTableError(null)
    kpis.fetchKpis()
    if (activeTab === 'kampanyalar') await data.fetchCampaigns(kpis.dateFrom, kpis.dateTo)
    else if (activeTab === 'reklam-gruplari') await data.fetchAdGroups(kpis.dateFrom, kpis.dateTo)
    else await data.fetchAds(kpis.dateFrom, kpis.dateTo)
  }, [kpis, data, activeTab])

  const onInitReady = useCallback(async () => {
    await kpis.fetchKpis()
  }, [kpis])

  const connection = useGoogleAdsConnection({ addToast, onAccountSelected, onInitReady })

  // Clear selection when tab changes
  useEffect(() => {
    setSelectedCampaignId(null)
    setSelectedAdGroupId(null)
    setSelectedAdId(null)
    setSelectedIds([])
  }, [activeTab])

  // Fetch data when tab changes
  useEffect(() => {
    if (!connection.selected || connection.selected.isManager) return
    if (activeTab === 'kampanyalar') data.fetchCampaigns(kpis.dateFrom, kpis.dateTo)
    else if (activeTab === 'reklam-gruplari') data.fetchAdGroups(kpis.dateFrom, kpis.dateTo)
    else data.fetchAds(kpis.dateFrom, kpis.dateTo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, connection.selected?.customerId, connection.selected?.isManager])

  const handleDateChange = useCallback((startDate: string, endDate: string, preset?: string) => {
    kpis.setDateRange(startDate, endDate, preset)
    data.setTableError(null)
    kpis.fetchKpis(startDate, endDate)
    const isBackground = activeTab === 'kampanyalar' ? data.campaigns.length > 0 : activeTab === 'reklam-gruplari' ? data.adGroups.length > 0 : data.ads.length > 0
    if (activeTab === 'kampanyalar') data.fetchCampaigns(startDate, endDate, data.showInactive, isBackground)
    else if (activeTab === 'reklam-gruplari') data.fetchAdGroups(startDate, endDate, data.showInactive)
    else data.fetchAds(startDate, endDate, data.showInactive)
  }, [kpis, data, activeTab])

  const handleShowInactiveChange = useCallback((show: boolean) => {
    data.setShowInactive(show)
    data.setTableError(null)
    // Campaigns are always fetched with all statuses — showInactive is client-side only
    // Only re-fetch ad groups and ads since they use server-side filtering
    if (activeTab === 'reklam-gruplari') data.fetchAdGroups(kpis.dateFrom, kpis.dateTo, show)
    else if (activeTab === 'reklamlar') data.fetchAds(kpis.dateFrom, kpis.dateTo, show)
  }, [activeTab, kpis.dateFrom, kpis.dateTo, data])

  const handleRefresh = useCallback(() => {
    setEditingCampaignId(null)
    setEditingAdGroup(null)
    setEditingAd(null)
    setMultiEditAdGroups([])
    setMultiEditAds([])
    setSelectedCampaignId(null)
    setSelectedAdGroupId(null)
    setSelectedAdId(null)
    setSelectedIds([])
    data.setTableError(null)
    setRefreshToken((v) => v + 1)
    if (activeTab === 'kampanyalar') data.fetchCampaigns(kpis.dateFrom, kpis.dateTo, data.showInactive, true)
    else if (activeTab === 'reklam-gruplari') data.fetchAdGroups(kpis.dateFrom, kpis.dateTo, data.showInactive)
    else data.fetchAds(kpis.dateFrom, kpis.dateTo, data.showInactive)
  }, [activeTab, kpis.dateFrom, kpis.dateTo, data])

  const tabs = [
    { id: 'kampanyalar', label: t('tabs.campaigns') },
    { id: 'reklam-gruplari', label: t('tabs.adGroups') },
    { id: 'reklamlar', label: t('tabs.ads') },
  ]

  // Dynamic columns based on active tab
  const getTableColumns = () => {
    const baseCols = [
      { key: 'checkbox', label: '' },
      { key: 'publish', label: tTable('table.status') },
      { key: 'effectiveStatus', label: tTable('table.statusColumn') },
    ]

    if (activeTab === 'kampanyalar') {
      return [
        ...baseCols,
        { key: 'optScore', label: tTable('table.optScore') },
        { key: 'campaign', label: tTable('table.campaign') },
        { key: 'budget', label: tTable('table.budget') },
        { key: 'spent', label: tTable('table.spent') },
        { key: 'impressions', label: tTable('table.impressions') },
        { key: 'clicks', label: tTable('table.clicks') },
        { key: 'ctr', label: tTable('table.ctr') },
        { key: 'cpc', label: tTable('table.cpc') },
        { key: 'roas', label: tTable('table.roas') },
      ]
    } else if (activeTab === 'reklam-gruplari') {
      return [
        ...baseCols,
        { key: 'adgroup', label: t('tabs.adGroups') },
        { key: 'spent', label: tTable('table.spent') },
        { key: 'impressions', label: tTable('table.impressions') },
        { key: 'clicks', label: tTable('table.clicks') },
        { key: 'ctr', label: tTable('table.ctr') },
        { key: 'cpc', label: tTable('table.cpc') },
        { key: 'roas', label: tTable('table.roas') },
      ]
    } else {
      return [
        ...baseCols,
        { key: 'ad', label: tTable('table.ad') },
        { key: 'spent', label: tTable('table.spent') },
        { key: 'impressions', label: tTable('table.impressions') },
        { key: 'clicks', label: tTable('table.clicks') },
        { key: 'ctr', label: tTable('table.ctr') },
        { key: 'cpc', label: tTable('table.cpc') },
        { key: 'roas', label: tTable('table.roas') },
      ]
    }
  }

  const tableColumns = getTableColumns()

  const showEmptyState = !connection.isGoogleConnected || !connection.selected || (connection.selected?.isManager === true)

  // ── Status constants (same pattern as Meta Ads) ──────────────────────
  // ALWAYS_HIDDEN: never shown anywhere (table or KPI)
  const ALWAYS_HIDDEN = ['REMOVED', 'UNKNOWN']
  // HIDDEN_WHEN_INACTIVE: hidden from KPI always, hidden from table unless showInactive
  const HIDDEN_WHEN_INACTIVE = ['PAUSED']

  // ── Data pipeline: campaigns → campaignsForKpi → campaignKpis + filteredCampaigns ──
  // campaignsForKpi: all campaigns minus ALWAYS_HIDDEN; search/showInactive NOT applied
  const campaignsForKpi = useMemo(() => {
    return (data.campaigns || []).filter(c => !ALWAYS_HIDDEN.includes(c.status ?? ''))
  }, [data.campaigns])

  // campaignKpis: aggregate ONLY ENABLED campaigns (KPI = active campaign totals)
  // Independent of showInactive toggle and searchQuery
  const campaignKpis = useMemo(() => {
    const active = campaignsForKpi.filter(c => !HIDDEN_WHEN_INACTIVE.includes(c.status ?? '') && c.status === 'ENABLED')
    const totals = { cost: 0, clicks: 0, impressions: 0, conversions: 0 }
    for (const c of active) {
      totals.cost += c.amountSpent || 0
      totals.clicks += c.clicks || 0
      totals.impressions += c.impressions || 0
      totals.conversions += c.conversions || 0
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
  const gTooltipCost = useMemo(() => kpis.kpisData?.series.cost.map(fmtCurrency) ?? [], [kpis.kpisData])
  const gTooltipClicks = useMemo(() => kpis.kpisData?.series.clicks.map(fmtInt) ?? [], [kpis.kpisData])
  const gTooltipImpressions = useMemo(() => kpis.kpisData?.series.impressions.map(fmtInt) ?? [], [kpis.kpisData])
  const gTooltipConversions = useMemo(() => kpis.kpisData?.series.conversions.map(fmtInt) ?? [], [kpis.kpisData])
  const gTooltipCtr = useMemo(() => kpis.kpisData?.series.ctr.map(fmtPct) ?? [], [kpis.kpisData])

  const periodLabel = (() => {
    const presetLabels: Record<string, string> = {
      'all_time': tTable('dateRange.allTime'),
      'today': tTable('dateRange.today'),
      'yesterday': tTable('dateRange.yesterday'),
      'last_7d': tTable('dateRange.last7d'),
      'last_30d': tTable('dateRange.last30d'),
      'this_month': tTable('dateRange.thisMonth'),
      'last_month': tTable('dateRange.lastMonth'),
    }
    if (kpis.datePreset !== 'custom' && presetLabels[kpis.datePreset]) {
      return presetLabels[kpis.datePreset]
    }
    const fmt = (d: string) => new Date(d).toLocaleDateString(locale === 'en' ? 'en-US' : 'tr-TR', { day: 'numeric', month: 'short' })
    return `${fmt(kpis.dateFrom)} - ${fmt(kpis.dateTo)}`
  })()

  // filteredCampaigns: campaignsForKpi + showInactive filter + search query (table data)
  const filteredCampaigns = useMemo(() => {
    let filtered = campaignsForKpi
    if (!data.showInactive) {
      filtered = filtered.filter((c) => c.status === 'ENABLED' || data.loadingCampaignStatus[c.campaignId])
    }
    if (data.searchQuery) {
      filtered = filtered.filter((c) => c.campaignName.toLowerCase().includes(data.searchQuery.toLowerCase()))
    }
    return filtered
  }, [campaignsForKpi, data.showInactive, data.searchQuery, data.loadingCampaignStatus])

  // Hide ad groups/ads whose parent campaign is inactive
  const enabledCampaignIds = useMemo(
    () => new Set(data.campaigns.filter((c) => c.status === 'ENABLED').map((c) => c.campaignId)),
    [data.campaigns]
  )

  const adGroupsToShow = useMemo(() => {
    let filtered = data.showInactive
      ? data.adGroups
      : data.adGroups.filter((ag) => ag.status === 'ENABLED' && enabledCampaignIds.has(ag.campaignId))
    if (data.searchQuery) {
      filtered = filtered.filter((ag) => ag.adGroupName.toLowerCase().includes(data.searchQuery.toLowerCase()))
    }
    return filtered
  }, [data.adGroups, data.showInactive, data.searchQuery, enabledCampaignIds])

  const adsToShow = useMemo(() => {
    let filtered = data.showInactive
      ? data.ads
      : data.ads.filter((ad) => ad.status === 'ENABLED' && enabledCampaignIds.has(ad.campaignId))
    if (data.searchQuery) {
      filtered = filtered.filter((ad) => ad.adName.toLowerCase().includes(data.searchQuery.toLowerCase()))
    }
    return filtered
  }, [data.ads, data.showInactive, data.searchQuery, enabledCampaignIds])

  const currentData = activeTab === 'kampanyalar' ? filteredCampaigns : activeTab === 'reklam-gruplari' ? adGroupsToShow : adsToShow

  // Selection helpers
  const selectedId = activeTab === 'kampanyalar' ? selectedCampaignId : activeTab === 'reklam-gruplari' ? selectedAdGroupId : selectedAdId
  const onSelect = activeTab === 'kampanyalar' ? setSelectedCampaignId : activeTab === 'reklam-gruplari' ? setSelectedAdGroupId : setSelectedAdId
  const hasSelection = selectedId !== null || selectedIds.length > 0

  const clearSelection = () => {
    if (activeTab === 'kampanyalar') { setSelectedCampaignId(null); setSelectedIds([]) }
    else if (activeTab === 'reklam-gruplari') { setSelectedAdGroupId(null); setSelectedIds([]) }
    else { setSelectedAdId(null); setSelectedIds([]) }
  }

  const handleEditAction = async () => {
    if (!hasSelection) return
    if (activeTab === 'kampanyalar') {
      const id = selectedIds.length > 0 ? selectedIds[0] : selectedCampaignId
      if (!id) return
      if (selectedIds.length > 1) {
        // Direkt API'den çek
        const params = new URLSearchParams({ from: kpis.dateFrom, to: kpis.dateTo, showInactive: '1' })
        const [agRes, adsRes] = await Promise.all([
          fetch(`/api/integrations/google-ads/ad-groups?${params}`, { cache: 'no-store' }),
          fetch(`/api/integrations/google-ads/ads?${params}`, { cache: 'no-store' }),
        ])
        const [agData, adsData] = await Promise.all([agRes.json(), adsRes.json()])
        setMultiEditAdGroups(Array.isArray(agData.adGroups) ? agData.adGroups : [])
        setMultiEditAds(Array.isArray(adsData.ads) ? adsData.ads : [])
      }
      setEditingCampaignId(id)
    } else if (activeTab === 'reklam-gruplari') {
      const id = selectedIds.length > 0 ? selectedIds[0] : selectedAdGroupId
      const ag = data.adGroups.find((ag) => ag.adGroupId === id)
      if (ag) setEditingAdGroup({ id: ag.adGroupId, name: ag.adGroupName })
    } else {
      const id = selectedIds.length > 0 ? selectedIds[0] : selectedAdId
      const ad = data.ads.find((a) => a.adId === id)
      if (ad) setEditingAd({ id: ad.adId, name: ad.adName, adGroupId: ad.adGroupId })
    }
  }

  const handleDeleteAction = () => {
    if (!hasSelection) return
    const idsToDelete = selectedIds.length > 0 ? selectedIds : (selectedId ? [selectedId] : [])
    if (idsToDelete.length > 1) {
      const type = activeTab === 'kampanyalar' ? 'campaign' as const
        : activeTab === 'reklam-gruplari' ? 'adgroup' as const : 'ad' as const
      setBulkDeleting({ ids: idsToDelete, type })
      return
    }
    if (activeTab === 'kampanyalar') {
      const c = data.campaigns.find((c) => c.campaignId === (selectedIds[0] || selectedCampaignId))
      if (c) data.setDeletingItem({ type: 'campaign', id: c.campaignId, name: c.campaignName })
    } else if (activeTab === 'reklam-gruplari') {
      const ag = data.adGroups.find((ag) => ag.adGroupId === (selectedIds[0] || selectedAdGroupId))
      if (ag) data.setDeletingItem({ type: 'adgroup', id: ag.adGroupId, name: ag.adGroupName })
    } else {
      const ad = data.ads.find((a) => a.adId === (selectedIds[0] || selectedAdId))
      if (ad) data.setDeletingItem({ type: 'ad', id: ad.adId, name: ad.adName, adGroupId: ad.adGroupId })
    }
  }

  const handleBulkDeleteConfirm = async () => {
    if (!bulkDeleting || isBulkDeleting) return
    const { ids, type } = bulkDeleting
    setIsBulkDeleting(true)
    let successCount = 0
    for (const id of ids) {
      try {
        const fakeItem = { type, id, name: id, adGroupId: '' }
        data.setDeletingItem(fakeItem as { type: 'campaign' | 'adgroup' | 'ad'; id: string; name: string; adGroupId?: string })
        await new Promise<void>((r) => setTimeout(r, 0))
        await data.handleDeleteConfirm(kpis.dateFrom, kpis.dateTo)
        successCount++
      } catch { /* continue */ }
    }
    addToast(`${successCount}/${ids.length} öğe silindi`, successCount === ids.length ? 'success' : 'error')
    setIsBulkDeleting(false)
    setBulkDeleting(null)
    setSelectedIds([])
    if (type === 'campaign') data.fetchCampaigns(kpis.dateFrom, kpis.dateTo, data.showInactive, true)
    else if (type === 'adgroup') data.fetchAdGroups(kpis.dateFrom, kpis.dateTo, data.showInactive)
    else data.fetchAds(kpis.dateFrom, kpis.dateTo, data.showInactive)
  }

  const handleDuplicateAction = () => {
    if (!hasSelection) return
    if (activeTab === 'kampanyalar') {
      data.handleDuplicate('campaign', selectedCampaignId!, kpis.dateFrom, kpis.dateTo)
    } else if (activeTab === 'reklam-gruplari') {
      data.handleDuplicate('adgroup', selectedAdGroupId!, kpis.dateFrom, kpis.dateTo)
    } else {
      const ad = data.ads.find((a) => a.adId === selectedAdId)
      if (ad) data.handleDuplicate('ad', ad.adId, kpis.dateFrom, kpis.dateTo, ad.adGroupId)
    }
    clearSelection()
  }

  const isLoading = activeTab === 'kampanyalar' ? data.campaignsLoading : activeTab === 'reklam-gruplari' ? data.adGroupsLoading : data.adsLoading
  const showTableShimmer = activeTab === 'kampanyalar' && data.campaignsRefreshing && data.campaigns.length > 0

  if (connection.isLoading) {
    return (
      <>
        <Topbar title={t('title')} description={t('description')} />
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-600">{t('loading')}</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar
        title={t('title')}
        description={t('description')}
        actionButton={{
          label: t('createCampaign'),
          onClick: () => setShowWizard(true),
          disabled: showEmptyState,
          title: showEmptyState ? t('selectAdAccountFirst') : undefined,
        }}
        googleAccountName={!showEmptyState ? connection.selected?.customerName : undefined}
        onGoogleChangeAccount={!showEmptyState ? connection.openAccountModal : undefined}
        googleChangeAccountLabel={tTable('common.change')}
      />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-6 space-y-6">
          {/* KPI Cards — values from campaign data, charts from daily series */}
          <div className="grid grid-cols-5 gap-4">
            <DashboardKpiCard
              label={t('kpi.spent')}
              periodLabel={periodLabel}
              value={showPlaceholderKpis ? '—' : fmtCurrency(campaignKpis.cost)}
              deltaDisplay={showPlaceholderKpis || !kpis.kpisData ? '' : `${kpis.kpisData.changes.cost >= 0 ? '↑' : '↓'} %${Math.abs(kpis.kpisData.changes.cost).toFixed(1)}`}
              chartData={kpis.kpisData?.series.cost && kpis.kpisData.series.cost.length >= 2 ? kpis.kpisData.series.cost : placeholderChartData}
              chartColor={showPlaceholderKpis ? 'gray' : 'red'}
              chartLabels={kpiDates}
              chartTooltipValues={gTooltipCost}
              locale={locale}
            />
            <DashboardKpiCard
              label={t('kpi.clicksCount')}
              periodLabel={periodLabel}
              value={showPlaceholderKpis ? '—' : fmtInt(campaignKpis.clicks)}
              deltaDisplay={showPlaceholderKpis || !kpis.kpisData ? '' : `${kpis.kpisData.changes.clicks >= 0 ? '↑' : '↓'} %${Math.abs(kpis.kpisData.changes.clicks).toFixed(1)}`}
              chartData={kpis.kpisData?.series.clicks && kpis.kpisData.series.clicks.length >= 2 ? kpis.kpisData.series.clicks : placeholderChartData}
              chartColor={showPlaceholderKpis ? 'gray' : 'green'}
              chartLabels={kpiDates}
              chartTooltipValues={gTooltipClicks}
              locale={locale}
            />
            <DashboardKpiCard
              label={t('kpi.impressions')}
              periodLabel={periodLabel}
              value={showPlaceholderKpis ? '—' : fmtInt(campaignKpis.impressions)}
              deltaDisplay={showPlaceholderKpis || !kpis.kpisData ? '' : `${kpis.kpisData.changes.impressions >= 0 ? '↑' : '↓'} %${Math.abs(kpis.kpisData.changes.impressions).toFixed(1)}`}
              chartData={kpis.kpisData?.series.impressions && kpis.kpisData.series.impressions.length >= 2 ? kpis.kpisData.series.impressions : placeholderChartData}
              chartColor={showPlaceholderKpis ? 'gray' : 'green'}
              chartLabels={kpiDates}
              chartTooltipValues={gTooltipImpressions}
              locale={locale}
            />
            <DashboardKpiCard
              label={t('kpi.engagements')}
              periodLabel={periodLabel}
              value={showPlaceholderKpis ? '—' : fmtInt(campaignKpis.conversions)}
              deltaDisplay={showPlaceholderKpis || !kpis.kpisData ? '' : `${kpis.kpisData.changes.conversions >= 0 ? '↑' : '↓'} %${Math.abs(kpis.kpisData.changes.conversions).toFixed(1)}`}
              chartData={kpis.kpisData?.series.conversions && kpis.kpisData.series.conversions.length >= 2 ? kpis.kpisData.series.conversions : placeholderChartData}
              chartColor={showPlaceholderKpis ? 'gray' : 'green'}
              chartLabels={kpiDates}
              chartTooltipValues={gTooltipConversions}
              locale={locale}
            />
            <DashboardKpiCard
              label={t('kpi.avgCtr')}
              periodLabel={periodLabel}
              value={showPlaceholderKpis ? '—' : fmtPct(campaignKpis.avgCtr)}
              deltaDisplay={showPlaceholderKpis || !kpis.kpisData ? '' : `${kpis.kpisData.changes.ctr >= 0 ? '↑' : '↓'} %${Math.abs(kpis.kpisData.changes.ctr).toFixed(1)}`}
              chartData={kpis.kpisData?.series.ctr && kpis.kpisData.series.ctr.length >= 2 ? kpis.kpisData.series.ctr : placeholderChartData}
              chartColor={showPlaceholderKpis ? 'gray' : 'red'}
              chartLabels={kpiDates}
              chartTooltipValues={gTooltipCtr}
              locale={locale}
            />
          </div>

          {/* Empty state alert */}
          {showEmptyState && !emptyBannerDismissed && (
            <AlertBanner
              title={t('noAdAccountTitle')}
              description={t('noAdAccountDesc')}
              onClose={() => setEmptyBannerDismissed(true)}
            >
              {!connection.isGoogleConnected ? (
                <a
                  href="/api/integrations/google-ads/start"
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  {t('connectButton')}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={connection.openAccountModal}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  {t('selectAccountCta')}
                </button>
              )}
            </AlertBanner>
          )}

          {(kpis.kpisError || (data.tableError && !showEmptyState)) && (
            <AlertBanner
              title={kpis.kpisError || data.tableError || ''}
              onClose={() => { kpis.setKpisError(null); data.setTableError(null) }}
            />
          )}

          {/* Data table */}
          <div className="bg-white rounded-xl border border-gray-200">
            <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Inline toolbar (Meta style) */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
              {/* Action icons */}
              <button
                onClick={handleRefresh}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                title={tTable('toolbar.refresh')}
              >
                <RefreshCw className={`w-4 h-4 transition-transform ${showTableShimmer ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleEditAction}
                disabled={!hasSelection}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={tTable('actions.edit')}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={handleDeleteAction}
                disabled={!hasSelection}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={tTable('actions.delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleDuplicateAction}
                disabled={!hasSelection || data.isDuplicating}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={tTable('actions.duplicate')}
              >
                <Copy className="w-4 h-4" />
              </button>

              {/* Search */}
              <div className="relative ml-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder={tTable('toolbar.searchPlaceholder')}
                  value={data.searchQuery}
                  onChange={(e) => data.setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 w-48 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-300 focus:border-green-300"
                />
              </div>

              {/* Clear selection */}
              {hasSelection && (
                <button
                  onClick={clearSelection}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors ml-1"
                  title={tTable('actions.clearSelection')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Show inactive */}
              <button
                onClick={() => handleShowInactiveChange(!data.showInactive)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  data.showInactive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {data.showInactive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {tTable('showInactive')}
              </button>

              {/* Date range picker */}
              <DateRangePicker onDateChange={handleDateChange} locale={locale} />
            </div>

            {/* Table */}
            <TableShimmer isRefreshing={showTableShimmer}>
              {showEmptyState ? (
                <GoogleTableSkeleton columns={tableColumns} />
              ) : (
                <GoogleTableReal
                  key={`google-${refreshToken}`}
                  columns={tableColumns}
                  data={currentData}
                  activeTab={activeTab}
                  loadingCampaignStatus={data.loadingCampaignStatus}
                  loadingCampaignBudget={data.loadingCampaignBudget}
                  loadingAdGroupStatus={data.loadingAdGroupStatus}
                  loadingAdStatus={data.loadingAdStatus}
                  onPublishToggle={(c) => data.handlePublishToggle(c, kpis.dateFrom, kpis.dateTo)}
                  onAdGroupToggle={(ag) => data.handleAdGroupToggle(ag, kpis.dateFrom, kpis.dateTo)}
                  onAdToggle={(ad) => data.handleAdToggle(ad, kpis.dateFrom, kpis.dateTo)}
                  onEditBudget={data.handleEditCampaignBudgetClick}
                  onEditCampaign={(id) => setEditingCampaignId(id)}
                  t={(key: string) => tTable(key)}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  selectedIds={selectedIds}
                  onSelectAll={(ids: string[]) => setSelectedIds(ids)}
                  onDeselectAll={() => setSelectedIds([])}
                  onRowSelect={(id: string, checked: boolean) => setSelectedIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id))}
                />
              )}
            </TableShimmer>

            {/* Budget edit modal */}
            {data.showEditBudgetModal && data.selectedCampaignForBudget && (
              <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                <div className="bg-white rounded-lg p-6 w-full max-w-md">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{tTable('common.editBudget')}</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {tTable('common.updateBudgetDescriptionCampaign', { name: data.selectedCampaignForBudget.campaignName })}
                  </p>
                  {data.selectedCampaignForBudget.isSharedBudget && (
                    <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                      {t('sharedBudgetWarning')}
                    </div>
                  )}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">{tTable('common.newBudget')}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={data.budgetEditInput}
                      onChange={(e) => data.setBudgetEditInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder={t('budgetPlaceholder')}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={data.handleConfirmBudgetEdit}
                      disabled={
                        data.loadingCampaignBudget[data.selectedCampaignForBudget.campaignId] ||
                        !data.budgetEditInput ||
                        parseFloat(data.budgetEditInput) <= 0
                      }
                      className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {data.loadingCampaignBudget[data.selectedCampaignForBudget.campaignId]
                        ? tTable('common.updating')
                        : tTable('common.update')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        data.setShowEditBudgetModal(false)
                        data.setSelectedCampaignForBudget(null)
                        data.setBudgetEditInput('')
                      }}
                      disabled={!!data.loadingCampaignBudget[data.selectedCampaignForBudget.campaignId]}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                    >
                      {tTable('common.cancel')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bid edit modal (ad groups) */}
          {data.showEditBidModal && data.selectedAdGroupForBid && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('editBid')}</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {t('bidDescription', { name: data.selectedAdGroupForBid.adGroupName })}
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('newBid')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={data.bidEditInput}
                    onChange={(e) => data.setBidEditInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder={t('bidPlaceholder')}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => data.handleConfirmBidEdit(kpis.dateFrom, kpis.dateTo)}
                    disabled={
                      data.loadingAdGroupBid[data.selectedAdGroupForBid.adGroupId] ||
                      !data.bidEditInput ||
                      parseFloat(data.bidEditInput) <= 0
                    }
                    className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {data.loadingAdGroupBid[data.selectedAdGroupForBid.adGroupId]
                      ? tTable('common.updating')
                      : tTable('common.update')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      data.setShowEditBidModal(false)
                      data.setSelectedAdGroupForBid(null)
                      data.setBidEditInput('')
                    }}
                    disabled={!!data.loadingAdGroupBid[data.selectedAdGroupForBid.adGroupId]}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    {tTable('common.cancel')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {bulkDeleting && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Toplu Silme</h3>
                <p className="text-sm text-gray-600 mb-6">
                  {bulkDeleting.ids.length} öğeyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setBulkDeleting(null)}
                    disabled={isBulkDeleting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleBulkDeleteConfirm}
                    disabled={isBulkDeleting}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {isBulkDeleting ? 'Siliniyor...' : `${bulkDeleting.ids.length} Öğeyi Sil`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete confirmation modal */}
          {data.deletingItem && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('deleteConfirmTitle')}</h3>
                <p className="text-sm text-gray-600 mb-6">
                  {t('deleteConfirmMessage', { name: data.deletingItem.name })}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      await data.handleDeleteConfirm(kpis.dateFrom, kpis.dateTo)
                      clearSelection()
                      data.setDeletingItem(null)
                    }}
                    disabled={data.isDeletingItem}
                    className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {data.isDeletingItem ? tTable('deleteDialog.deleting') : tTable('actions.delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => data.setDeletingItem(null)}
                    disabled={data.isDeletingItem}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    {tTable('common.cancel')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Overlays */}
      {editingCampaign && (
        <GoogleCampaignEditOverlay
          campaignId={editingCampaign.id}
          campaignName={editingCampaign.name}
          open={true}
          onClose={() => setEditingCampaign(null)}
          onSuccess={() => {
            setEditingCampaign(null)
            data.fetchCampaigns(kpis.dateFrom, kpis.dateTo, data.showInactive, true)
          }}
          onToast={addToast}
        />
      )}
      {editingAdGroup && (
        <GoogleAdGroupEditOverlay
          adGroupId={editingAdGroup.id}
          adGroupName={editingAdGroup.name}
          open={true}
          onClose={() => {
            setEditingAdGroup(null)
            if (editQueue.length > 0) {
              const [next, ...remaining] = editQueue
              setEditQueue(remaining)
              setTimeout(() => setEditingAdGroup({ id: next.id, name: next.name }), 100)
            }
          }}
          onSuccess={() => {
            setEditingAdGroup(null)
            if (editQueue.length > 0) {
              const [next, ...remaining] = editQueue
              setEditQueue(remaining)
              setTimeout(() => setEditingAdGroup({ id: next.id, name: next.name }), 100)
            } else {
              data.fetchAdGroups(kpis.dateFrom, kpis.dateTo, data.showInactive)
            }
          }}
          onToast={addToast}
        />
      )}
      {editingAd && (
        <GoogleAdEditOverlay
          adId={editingAd.id}
          adGroupId={editingAd.adGroupId}
          adName={editingAd.name}
          open={true}
          onClose={() => {
            setEditingAd(null)
            if (editQueue.length > 0) {
              const [next, ...remaining] = editQueue
              setEditQueue(remaining)
              const ad = data.ads.find((a) => a.adId === next.id)
              setTimeout(() => setEditingAd({ id: next.id, name: next.name, adGroupId: next.adGroupId ?? ad?.adGroupId ?? '' }), 100)
            }
          }}
          onSuccess={() => {
            setEditingAd(null)
            if (editQueue.length > 0) {
              const [next, ...remaining] = editQueue
              setEditQueue(remaining)
              const ad = data.ads.find((a) => a.adId === next.id)
              setTimeout(() => setEditingAd({ id: next.id, name: next.name, adGroupId: next.adGroupId ?? ad?.adGroupId ?? '' }), 100)
            } else {
              data.fetchAds(kpis.dateFrom, kpis.dateTo, data.showInactive)
            }
          }}
          onToast={addToast}
        />
      )}

      <GoogleAccountModal
        isOpen={connection.showAccountModal && (connection.selected !== null || connection.isGoogleConnected)}
        onClose={() => !connection.selectingKey && connection.setShowAccountModal(false)}
        managers={connection.managers}
        managersLoading={connection.managersLoading}
        children={connection.children}
        childrenLoading={connection.childrenLoading}
        accountStep={connection.accountStep}
        selectingKey={connection.selectingKey}
        accountsError={connection.accountsError}
        onManagerOrAccountClick={connection.onManagerOrAccountClick}
        onChildClick={connection.onChildClick}
        backToManagers={connection.backToManagers}
      />
      {editingCampaignId && (
        <CampaignEditPanel
          campaignId={editingCampaignId}
          allCampaignIds={selectedIds.length > 1 ? selectedIds : undefined}
          allCampaignData={selectedIds.length > 1 ? selectedIds.map((id) => {
            const c = data.campaigns.find((c) => c.campaignId === id)
            const cAdGroups = multiEditAdGroups
              .filter((ag) => ag.campaignId === id)
              .map((ag) => ({ id: ag.adGroupId, name: ag.adGroupName, campaignId: id }))
            const cAds = multiEditAds
              .filter((a) => a.campaignId === id)
              .map((a) => ({ id: a.adId, name: a.adName || `Reklam #${a.adId}`, adGroupId: a.adGroupId, campaignId: id }))
            return { id, name: c?.campaignName ?? id, adGroups: cAdGroups, ads: cAds }
          }) : undefined}
          onSwitchCampaign={(id) => setEditingCampaignId(id)}
          onClose={() => {
            setEditingCampaignId(null)
            setMultiEditAdGroups([])
            setMultiEditAds([])
            data.fetchCampaigns(kpis.dateFrom, kpis.dateTo)
          }}
          onToast={addToast}
        />
      )}
      <GoogleCampaignWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onSuccess={() => { setShowWizard(false); data.fetchCampaigns(kpis.dateFrom, kpis.dateTo) }}
        onToast={addToast}
      />
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
