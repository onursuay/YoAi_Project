'use client'

import { useState, useCallback } from 'react'

export interface TikTokCampaign {
  publishEnabled: boolean
  status: string
  campaignId: string
  campaignName: string
  objective: string
  budget: number
  budgetMode: string
  amountSpent: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  conversions: number
  reach: number
}

type ToastFn = (message: string, type: 'info' | 'success' | 'error') => void

interface UseTikTokAdsCampaignsOpts {
  addToast: ToastFn
}

export function useTikTokAdsCampaigns({ addToast }: UseTikTokAdsCampaignsOpts) {
  const [campaigns, setCampaigns] = useState<TikTokCampaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [tableError, setTableError] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchCampaigns = useCallback(async (from: string, to: string, showInactiveParam?: boolean) => {
    const si = showInactiveParam ?? showInactive
    setTableError(null)
    setCampaignsLoading(true)
    try {
      const params = new URLSearchParams({ from, to, showInactive: si ? '1' : '0' })
      const res = await fetch(`/api/integrations/tiktok-ads/campaigns?${params}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data.campaigns)) {
        setCampaigns(data.campaigns)
      } else {
        setCampaigns([])
        if (!res.ok) setTableError(data?.error || res.statusText)
      }
    } catch (e) {
      setCampaigns([])
      setTableError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setCampaignsLoading(false)
    }
  }, [showInactive])

  return {
    campaigns, campaignsLoading,
    tableError, setTableError,
    showInactive, setShowInactive,
    searchQuery, setSearchQuery,
    fetchCampaigns,
  }
}
