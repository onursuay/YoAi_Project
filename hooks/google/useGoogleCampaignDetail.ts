'use client'

import { useState, useCallback, useEffect } from 'react'
import type { SearchTerm } from '@/lib/google-ads/reports'
import type { AdScheduleEntry } from '@/lib/google-ads/adschedule'
import type { LocationTarget } from '@/lib/google-ads/locations'
import type { CampaignAsset } from '@/components/google/detail/CampaignAssetsTab'
import type { ViewErrorInfo } from '@/components/google/detail/ViewErrorAlert'

export interface CampaignDetail {
  campaign: {
    id: string
    name: string
    status: string
    servingStatus: string
    biddingStrategyType: string
    optimizationScore: number | null
    budget: number | null
    budgetShared: boolean
  }
  metrics: {
    impressions: number
    clicks: number
    cost: number
    conversions: number
    conversionsValue: number
    ctr: number
    cpc: number
    roas: number | null
  }
  diagnostics: Array<{ type: 'warning' | 'info' | 'error'; code: string; message: string }>
  adSummary: { totalAds: number; disapprovedAds: number; lowAssetAds: number }
}

export interface LandingPage {
  url: string
  clicks: number
  impressions: number
  cost: number
  conversions: number
  conversionsValue: number
  ctr: number
  cpc: number
}

function getDefaultDateRange() {
  const today = new Date()
  const to = today.toISOString().split('T')[0]
  const from = new Date(today)
  from.setDate(from.getDate() - 30)
  return { from: from.toISOString().split('T')[0], to }
}

export function useGoogleCampaignDetail(campaignId: string) {
  const [dateFrom, setDateFrom] = useState(() => getDefaultDateRange().from)
  const [dateTo, setDateTo] = useState(() => getDefaultDateRange().to)

  // Detail / overview
  const [detail, setDetail] = useState<CampaignDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(true)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Search terms
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([])
  const [searchTermsLoading, setSearchTermsLoading] = useState(false)
  const [searchTermsError, setSearchTermsError] = useState<ViewErrorInfo | null>(null)

  // Locations
  const [locations, setLocations] = useState<LocationTarget[]>([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [locationsError, setLocationsError] = useState<string | null>(null)

  // Ad Schedule
  const [schedule, setSchedule] = useState<AdScheduleEntry[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  // Landing Pages
  const [landingPages, setLandingPages] = useState<LandingPage[]>([])
  const [landingPagesLoading, setLandingPagesLoading] = useState(false)
  const [landingPagesError, setLandingPagesError] = useState<ViewErrorInfo | null>(null)

  // Assets
  const [assets, setAssets] = useState<CampaignAsset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [assetsError, setAssetsError] = useState<ViewErrorInfo | null>(null)

  const fetchDetail = useCallback(async (from?: string, to?: string) => {
    const f = from ?? dateFrom
    const t = to ?? dateTo
    setDetailLoading(true)
    setDetailError(null)
    try {
      const params = new URLSearchParams({ from: f, to: t })
      const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/detail?${params}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setDetailError(data?.message || data?.error || 'Detay yüklenemedi'); return }
      setDetail(data as CampaignDetail)
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setDetailLoading(false)
    }
  }, [campaignId, dateFrom, dateTo])

  const fetchSearchTerms = useCallback(async (from?: string, to?: string) => {
    const f = from ?? dateFrom
    const t = to ?? dateTo
    setSearchTermsLoading(true)
    setSearchTermsError(null)
    try {
      const res = await fetch('/api/integrations/google-ads/search-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, dateRange: { startDate: f, endDate: t } }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setSearchTermsError({ userMessage: data?.userMessage || 'Arama terimleri şu anda alınamadı.', technicalDetail: data?.technicalDetail || data?.message }); return }
      setSearchTerms(data.searchTerms || [])
    } catch (e) {
      setSearchTermsError({ userMessage: 'Arama terimleri şu anda alınamadı.', technicalDetail: e instanceof Error ? e.message : undefined })
    } finally {
      setSearchTermsLoading(false)
    }
  }, [campaignId, dateFrom, dateTo])

  const fetchLocations = useCallback(async () => {
    setLocationsLoading(true)
    setLocationsError(null)
    try {
      const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/locations`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setLocationsError(data?.message || data?.error || 'Lokasyonlar yüklenemedi'); return }
      setLocations(data.locations || [])
    } catch (e) {
      setLocationsError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLocationsLoading(false)
    }
  }, [campaignId])

  const fetchSchedule = useCallback(async () => {
    setScheduleLoading(true)
    setScheduleError(null)
    try {
      const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/ad-schedule`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setScheduleError(data?.message || data?.error || 'Zamanlama yüklenemedi'); return }
      setSchedule(data.schedule || [])
    } catch (e) {
      setScheduleError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setScheduleLoading(false)
    }
  }, [campaignId])

  const fetchLandingPages = useCallback(async (from?: string, to?: string) => {
    const f = from ?? dateFrom
    const t = to ?? dateTo
    setLandingPagesLoading(true)
    setLandingPagesError(null)
    try {
      const params = new URLSearchParams({ from: f, to: t })
      const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/landing-pages?${params}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setLandingPagesError({ userMessage: data?.userMessage || 'Açılış sayfası verisi şu anda getirilemedi.', technicalDetail: data?.technicalDetail || data?.message }); return }
      setLandingPages(data.landingPages || [])
    } catch (e) {
      setLandingPagesError({ userMessage: 'Açılış sayfası verisi şu anda getirilemedi.', technicalDetail: e instanceof Error ? e.message : undefined })
    } finally {
      setLandingPagesLoading(false)
    }
  }, [campaignId, dateFrom, dateTo])

  const fetchAssets = useCallback(async () => {
    setAssetsLoading(true)
    setAssetsError(null)
    try {
      const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/assets`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setAssetsError({ userMessage: data?.userMessage || 'Kampanya öğeleri şu anda alınamadı.', technicalDetail: data?.technicalDetail || data?.message }); return }
      setAssets(data.assets || [])
    } catch (e) {
      setAssetsError({ userMessage: 'Kampanya öğeleri şu anda alınamadı.', technicalDetail: e instanceof Error ? e.message : undefined })
    } finally {
      setAssetsLoading(false)
    }
  }, [campaignId])

  // Fetch detail on mount
  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const setDateRange = useCallback((from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
  }, [])

  return {
    dateFrom, dateTo, setDateRange,
    detail, detailLoading, detailError, fetchDetail,
    searchTerms, searchTermsLoading, searchTermsError, fetchSearchTerms,
    locations, locationsLoading, locationsError, fetchLocations,
    schedule, scheduleLoading, scheduleError, fetchSchedule,
    landingPages, landingPagesLoading, landingPagesError, fetchLandingPages,
    assets, assetsLoading, assetsError, fetchAssets,
  }
}
