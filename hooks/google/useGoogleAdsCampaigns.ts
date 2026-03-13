'use client'

import { useState, useCallback } from 'react'

export interface GoogleCampaign {
  publishEnabled: boolean
  status: string
  optScorePct: number | null
  campaignId: string
  campaignName: string
  campaignBudgetResourceName?: string | null
  budget: number | null
  isSharedBudget?: boolean
  amountSpent: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  conversions: number
  roas: number | null
}

export interface GoogleAdGroup {
  publishEnabled: boolean
  status: string
  adGroupId: string
  adGroupName: string
  campaignId: string
  campaignName: string
  cpcBid: number | null
  amountSpent: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  roas: number | null
}

export interface GoogleAd {
  publishEnabled: boolean
  status: string
  adId: string
  adName: string
  adGroupId: string
  adGroupName: string
  campaignId: string
  campaignName: string
  amountSpent: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  roas: number | null
}

type ToastFn = (message: string, type: 'info' | 'success' | 'error') => void

interface UseGoogleAdsCampaignsOpts {
  addToast: ToastFn
  tTable: (key: string) => string
  tGoogle: (key: string) => string
}

export function useGoogleAdsCampaigns({ addToast, tTable, tGoogle }: UseGoogleAdsCampaignsOpts) {
  const [campaigns, setCampaigns] = useState<GoogleCampaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [campaignsRefreshing, setCampaignsRefreshing] = useState(false)
  const [adGroups, setAdGroups] = useState<GoogleAdGroup[]>([])
  const [adGroupsLoading, setAdGroupsLoading] = useState(false)
  const [ads, setAds] = useState<GoogleAd[]>([])
  const [adsLoading, setAdsLoading] = useState(false)
  const [tableError, setTableError] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingCampaignStatus, setLoadingCampaignStatus] = useState<Record<string, boolean>>({})
  const [loadingCampaignBudget, setLoadingCampaignBudget] = useState<Record<string, boolean>>({})
  const [loadingAdGroupStatus, setLoadingAdGroupStatus] = useState<Record<string, boolean>>({})
  const [loadingAdStatus, setLoadingAdStatus] = useState<Record<string, boolean>>({})
  const [showEditBudgetModal, setShowEditBudgetModal] = useState(false)
  const [selectedCampaignForBudget, setSelectedCampaignForBudget] = useState<GoogleCampaign | null>(null)
  const [budgetEditInput, setBudgetEditInput] = useState('')
  const [showEditBidModal, setShowEditBidModal] = useState(false)
  const [selectedAdGroupForBid, setSelectedAdGroupForBid] = useState<GoogleAdGroup | null>(null)
  const [bidEditInput, setBidEditInput] = useState('')
  const [loadingAdGroupBid, setLoadingAdGroupBid] = useState<Record<string, boolean>>({})
  const [deletingItem, setDeletingItem] = useState<{ type: 'campaign' | 'adgroup' | 'ad'; id: string; name: string; adGroupId?: string } | null>(null)
  const [isDeletingItem, setIsDeletingItem] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)

  const fetchCampaigns = useCallback(async (from: string, to: string, _showInactiveParam?: boolean, isBackground = false) => {
    // Always fetch ALL campaigns (active + paused) — showInactive filtering is client-side
    // This ensures KPI cards always have the full dataset to aggregate from
    setTableError(null)
    if (isBackground) {
      setCampaignsRefreshing(true)
    } else {
      setCampaignsLoading(true)
    }
    try {
      const params = new URLSearchParams({ from, to, showInactive: '1' })
      const res = await fetch(`/api/integrations/google-ads/campaigns?${params}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      const rows = Array.isArray(data.campaigns) ? data.campaigns : []
      if (res.ok) {
        setCampaigns((prevCampaigns) => {
          const loadingIds = Object.keys(loadingCampaignBudget).filter((id) => loadingCampaignBudget[id])
          const recentUpdates = JSON.parse(localStorage.getItem('recentBudgetUpdates') || '{}')
          const now = Date.now()
          const recentlyUpdatedIds = Object.keys(recentUpdates).filter((id) => now - recentUpdates[id] < 60000)
          const allProtectedIds = [...loadingIds, ...recentlyUpdatedIds]
          if (allProtectedIds.length === 0) return rows
          return rows.map((apiCampaign: GoogleCampaign) => {
            if (allProtectedIds.includes(apiCampaign.campaignId)) {
              const existing = prevCampaigns.find((c) => c.campaignId === apiCampaign.campaignId)
              return existing || apiCampaign
            }
            return apiCampaign
          })
        })
      } else {
        if (!isBackground) setCampaigns([])
        const msg = data?.message || data?.error || res.statusText
        setTableError(msg)
        if (isBackground) addToast(msg, 'error')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error'
      if (!isBackground) setCampaigns([])
      setTableError(msg)
      if (isBackground) addToast(msg, 'error')
    } finally {
      setCampaignsLoading(false)
      setCampaignsRefreshing(false)
    }
  }, [addToast, loadingCampaignBudget])

  const fetchAdGroups = useCallback(async (from: string, to: string, showInactiveParam?: boolean) => {
    const si = showInactiveParam ?? showInactive
    setTableError(null)
    setAdGroupsLoading(true)
    try {
      const params = new URLSearchParams({ from, to, showInactive: si ? '1' : '0' })
      const res = await fetch(`/api/integrations/google-ads/ad-groups?${params}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data.adGroups)) {
        setAdGroups(data.adGroups)
      } else {
        setAdGroups([])
        if (!res.ok) setTableError(data?.message || data?.error || res.statusText)
      }
    } catch (e) {
      setAdGroups([])
      setTableError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setAdGroupsLoading(false)
    }
  }, [showInactive])

  const fetchAds = useCallback(async (from: string, to: string, showInactiveParam?: boolean) => {
    const si = showInactiveParam ?? showInactive
    setTableError(null)
    setAdsLoading(true)
    try {
      const params = new URLSearchParams({ from, to, showInactive: si ? '1' : '0' })
      const res = await fetch(`/api/integrations/google-ads/ads?${params}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data.ads)) {
        setAds(data.ads)
      } else {
        setAds([])
        if (!res.ok) setTableError(data?.message || data?.error || res.statusText)
      }
    } catch (e) {
      setAds([])
      setTableError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setAdsLoading(false)
    }
  }, [showInactive])

  // ── Campaign toggle ────────────────────────────────────────────

  const handlePublishToggle = useCallback(async (campaign: GoogleCampaign, dateFrom: string, dateTo: string) => {
    const nextEnabled = !campaign.publishEnabled
    const nextStatus = nextEnabled ? 'ENABLED' : 'PAUSED'
    const previousCampaigns = campaigns
    setCampaigns((prev) =>
      prev.map((c) =>
        c.campaignId === campaign.campaignId ? { ...c, status: nextStatus, publishEnabled: nextEnabled } : c
      )
    )
    setLoadingCampaignStatus((prev) => ({ ...prev, [campaign.campaignId]: true }))
    try {
      const res = await fetch(`/api/integrations/google-ads/campaigns/${campaign.campaignId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCampaigns(previousCampaigns)
        addToast(data?.message || data?.error || res.statusText || tTable('errors.updateStatusFailed'), 'error')
        return
      }
      fetchCampaigns(dateFrom, dateTo, showInactive, true)
    } finally {
      setLoadingCampaignStatus((prev) => ({ ...prev, [campaign.campaignId]: false }))
    }
  }, [campaigns, showInactive, addToast, tTable, fetchCampaigns])

  // ── Ad Group toggle ────────────────────────────────────────────

  const handleAdGroupToggle = useCallback(async (adGroup: GoogleAdGroup, dateFrom: string, dateTo: string) => {
    const nextEnabled = !adGroup.publishEnabled
    const nextStatus = nextEnabled ? 'ENABLED' : 'PAUSED'
    const previousAdGroups = adGroups
    setAdGroups((prev) =>
      prev.map((ag) =>
        ag.adGroupId === adGroup.adGroupId ? { ...ag, status: nextStatus, publishEnabled: nextEnabled } : ag
      )
    )
    setLoadingAdGroupStatus((prev) => ({ ...prev, [adGroup.adGroupId]: true }))
    try {
      const res = await fetch(`/api/integrations/google-ads/ad-groups/${adGroup.adGroupId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAdGroups(previousAdGroups)
        addToast(data?.message || data?.error || tGoogle('toastMessages.adGroupStatusFailed'), 'error')
        return
      }
      fetchAdGroups(dateFrom, dateTo, showInactive)
    } finally {
      setLoadingAdGroupStatus((prev) => ({ ...prev, [adGroup.adGroupId]: false }))
    }
  }, [adGroups, showInactive, addToast, tGoogle, fetchAdGroups])

  // ── Ad toggle ──────────────────────────────────────────────────

  const handleAdToggle = useCallback(async (ad: GoogleAd, dateFrom: string, dateTo: string) => {
    const nextEnabled = !ad.publishEnabled
    const nextStatus = nextEnabled ? 'ENABLED' : 'PAUSED'
    const previousAds = ads
    setAds((prev) =>
      prev.map((a) =>
        a.adId === ad.adId ? { ...a, status: nextStatus, publishEnabled: nextEnabled } : a
      )
    )
    setLoadingAdStatus((prev) => ({ ...prev, [ad.adId]: true }))
    try {
      const res = await fetch(`/api/integrations/google-ads/ads/${ad.adId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled, adGroupId: ad.adGroupId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAds(previousAds)
        addToast(data?.message || data?.error || tGoogle('toastMessages.adStatusFailed'), 'error')
        return
      }
      fetchAds(dateFrom, dateTo, showInactive)
    } finally {
      setLoadingAdStatus((prev) => ({ ...prev, [ad.adId]: false }))
    }
  }, [ads, showInactive, addToast, tGoogle, fetchAds])

  // ── Delete (remove) ────────────────────────────────────────────

  const handleDeleteConfirm = useCallback(async (dateFrom: string, dateTo: string) => {
    if (!deletingItem || isDeletingItem) return
    setIsDeletingItem(true)

    const previousCampaigns = campaigns
    const previousAdGroups = adGroups
    const previousAds = ads

    // Optimistic remove
    if (deletingItem.type === 'campaign') {
      setCampaigns((prev) => prev.filter((c) => c.campaignId !== deletingItem.id))
    } else if (deletingItem.type === 'adgroup') {
      setAdGroups((prev) => prev.filter((ag) => ag.adGroupId !== deletingItem.id))
    } else {
      setAds((prev) => prev.filter((a) => a.adId !== deletingItem.id))
    }

    try {
      let url = ''
      let body: string | undefined
      if (deletingItem.type === 'campaign') {
        url = `/api/integrations/google-ads/campaigns/${deletingItem.id}/remove`
      } else if (deletingItem.type === 'adgroup') {
        url = `/api/integrations/google-ads/ad-groups/${deletingItem.id}/remove`
      } else {
        url = `/api/integrations/google-ads/ads/${deletingItem.id}/remove`
        body = JSON.stringify({ adGroupId: deletingItem.adGroupId })
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body && { body }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.ok) {
        addToast(tGoogle('toastMessages.deleted'), 'success')
        // Refresh in background
        if (deletingItem.type === 'campaign') fetchCampaigns(dateFrom, dateTo, showInactive, true)
        else if (deletingItem.type === 'adgroup') fetchAdGroups(dateFrom, dateTo, showInactive)
        else fetchAds(dateFrom, dateTo, showInactive)
      } else {
        // Rollback
        setCampaigns(previousCampaigns)
        setAdGroups(previousAdGroups)
        setAds(previousAds)
        addToast(data?.message || data?.error || tGoogle('toastMessages.deleteFailed'), 'error')
      }
    } catch {
      setCampaigns(previousCampaigns)
      setAdGroups(previousAdGroups)
      setAds(previousAds)
      addToast(tGoogle('toastMessages.deleteFailed'), 'error')
    } finally {
      setIsDeletingItem(false)
      setDeletingItem(null)
    }
  }, [deletingItem, isDeletingItem, campaigns, adGroups, ads, showInactive, addToast, tGoogle, fetchCampaigns, fetchAdGroups, fetchAds])

  // ── Duplicate ──────────────────────────────────────────────────

  const handleDuplicate = useCallback(async (
    type: 'campaign' | 'adgroup' | 'ad',
    id: string,
    dateFrom: string,
    dateTo: string,
    adGroupId?: string,
  ) => {
    if (isDuplicating) return
    setIsDuplicating(true)
    try {
      let url = ''
      let body: string | undefined
      if (type === 'campaign') {
        url = `/api/integrations/google-ads/campaigns/${id}/duplicate`
      } else if (type === 'adgroup') {
        url = `/api/integrations/google-ads/ad-groups/${id}/duplicate`
      } else {
        url = `/api/integrations/google-ads/ads/${id}/duplicate`
        body = JSON.stringify({ adGroupId })
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body && { body }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.ok) {
        addToast(tGoogle('toastMessages.duplicated'), 'success')
        // Refresh
        if (type === 'campaign') fetchCampaigns(dateFrom, dateTo, showInactive, true)
        else if (type === 'adgroup') fetchAdGroups(dateFrom, dateTo, showInactive)
        else fetchAds(dateFrom, dateTo, showInactive)
      } else {
        addToast(data?.message || data?.error || tGoogle('toastMessages.duplicateFailed'), 'error')
      }
    } catch {
      addToast(tGoogle('toastMessages.duplicateFailed'), 'error')
    } finally {
      setIsDuplicating(false)
    }
  }, [isDuplicating, showInactive, addToast, tGoogle, fetchCampaigns, fetchAdGroups, fetchAds])

  // ── Budget edit ────────────────────────────────────────────────

  const handleEditCampaignBudgetClick = useCallback((campaign: GoogleCampaign) => {
    setSelectedCampaignForBudget(campaign)
    setBudgetEditInput(
      campaign.budget != null && campaign.budget > 0
        ? String(campaign.budget)
        : ''
    )
    setShowEditBudgetModal(true)
  }, [])

  const handleConfirmBudgetEdit = useCallback(async () => {
    if (!selectedCampaignForBudget) return
    const amount = parseFloat(budgetEditInput)
    if (!Number.isFinite(amount) || amount <= 0) return
    setLoadingCampaignBudget((prev) => ({ ...prev, [selectedCampaignForBudget.campaignId]: true }))
    try {
      const res = await fetch(
        `/api/integrations/google-ads/campaigns/${selectedCampaignForBudget.campaignId}/budget`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount }),
        }
      )
      await res.json().catch(() => ({}))
      if (!res.ok) return
      const campaignId = selectedCampaignForBudget.campaignId
      const recentUpdates = JSON.parse(localStorage.getItem('recentBudgetUpdates') || '{}')
      recentUpdates[campaignId] = Date.now()
      localStorage.setItem('recentBudgetUpdates', JSON.stringify(recentUpdates))
      setCampaigns((prev) =>
        prev.map((c) =>
          c.campaignId === campaignId ? { ...c, budget: amount } : c
        )
      )
      setShowEditBudgetModal(false)
      setSelectedCampaignForBudget(null)
      setBudgetEditInput('')
    } finally {
      setLoadingCampaignBudget((prev) => ({ ...prev, [selectedCampaignForBudget.campaignId]: false }))
    }
  }, [selectedCampaignForBudget, budgetEditInput])

  // ── Ad group bid edit ──────────────────────────────────────────

  const handleEditAdGroupBidClick = useCallback((adGroup: GoogleAdGroup) => {
    setSelectedAdGroupForBid(adGroup)
    setBidEditInput(
      adGroup.cpcBid != null && adGroup.cpcBid > 0
        ? String(adGroup.cpcBid)
        : ''
    )
    setShowEditBidModal(true)
  }, [])

  const handleConfirmBidEdit = useCallback(async (dateFrom: string, dateTo: string) => {
    if (!selectedAdGroupForBid) return
    const cpcBid = parseFloat(bidEditInput)
    if (!Number.isFinite(cpcBid) || cpcBid <= 0) return
    setLoadingAdGroupBid((prev) => ({ ...prev, [selectedAdGroupForBid.adGroupId]: true }))
    try {
      const res = await fetch(
        `/api/integrations/google-ads/ad-groups/${selectedAdGroupForBid.adGroupId}/bid`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cpcBid }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        addToast(data?.message || data?.error || tGoogle('toastMessages.bidUpdateFailed'), 'error')
        return
      }
      setAdGroups((prev) =>
        prev.map((ag) =>
          ag.adGroupId === selectedAdGroupForBid.adGroupId ? { ...ag, cpcBid } : ag
        )
      )
      setShowEditBidModal(false)
      setSelectedAdGroupForBid(null)
      setBidEditInput('')
      fetchAdGroups(dateFrom, dateTo, showInactive)
    } finally {
      setLoadingAdGroupBid((prev) => ({ ...prev, [selectedAdGroupForBid.adGroupId]: false }))
    }
  }, [selectedAdGroupForBid, bidEditInput, showInactive, addToast, tGoogle, fetchAdGroups])

  return {
    campaigns, campaignsLoading, campaignsRefreshing,
    adGroups, adGroupsLoading,
    ads, adsLoading,
    tableError, setTableError,
    showInactive, setShowInactive,
    searchQuery, setSearchQuery,
    loadingCampaignStatus, loadingCampaignBudget,
    loadingAdGroupStatus, loadingAdStatus, loadingAdGroupBid,
    showEditBudgetModal, setShowEditBudgetModal,
    selectedCampaignForBudget, setSelectedCampaignForBudget,
    budgetEditInput, setBudgetEditInput,
    showEditBidModal, setShowEditBidModal,
    selectedAdGroupForBid, setSelectedAdGroupForBid,
    bidEditInput, setBidEditInput,
    deletingItem, setDeletingItem, isDeletingItem,
    isDuplicating,
    fetchCampaigns, fetchAdGroups, fetchAds,
    handlePublishToggle, handleAdGroupToggle, handleAdToggle,
    handleDeleteConfirm, handleDuplicate,
    handleEditCampaignBudgetClick, handleConfirmBudgetEdit,
    handleEditAdGroupBidClick, handleConfirmBidEdit,
  }
}
