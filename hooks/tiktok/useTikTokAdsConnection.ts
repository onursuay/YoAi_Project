'use client'

import { useState, useEffect, useCallback } from 'react'

export interface TikTokAdvertiser {
  advertiserId: string
  name: string
}

export interface TikTokSelected {
  advertiserId: string
  advertiserName: string
}

type ToastFn = (message: string, type: 'info' | 'success' | 'error') => void

interface UseTikTokAdsConnectionOpts {
  addToast: ToastFn
  onAccountSelected?: () => Promise<void>
  onInitReady?: () => Promise<void>
}

export function useTikTokAdsConnection({ addToast, onAccountSelected, onInitReady }: UseTikTokAdsConnectionOpts) {
  const [isTikTokConnected, setIsTikTokConnected] = useState(false)
  const [selected, setSelected] = useState<TikTokSelected | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [advertisers, setAdvertisers] = useState<TikTokAdvertiser[]>([])
  const [advertisersLoading, setAdvertisersLoading] = useState(false)
  const [selectingKey, setSelectingKey] = useState<string | null>(null)
  const [accountsError, setAccountsError] = useState<string | null>(null)

  const fetchSelected = useCallback(async (): Promise<TikTokSelected | null> => {
    const res = await fetch('/api/integrations/tiktok-ads/selected', { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    return data.selected ?? null
  }, [])

  // Init effect
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const statusRes = await fetch('/api/tiktok/status', { cache: 'no-store' })
        const statusData = await statusRes.json().catch(() => ({}))
        if (!cancelled) setIsTikTokConnected(Boolean(statusData?.connected))

        if (!statusData?.connected) {
          if (!cancelled) setIsLoading(false)
          return
        }

        const sel = await fetchSelected()
        if (!cancelled) {
          setSelected(sel)
          if (!sel) setShowAccountModal(true)
        }
        if (sel && !cancelled) {
          await onInitReady?.()
        }
      } catch {
        if (!cancelled) setIsTikTokConnected(false)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Account modal: fetch advertisers when opened
  useEffect(() => {
    if (!showAccountModal || !isTikTokConnected) return
    setAccountsError(null)
    setAdvertisers([])
    setAdvertisersLoading(true)
    fetch('/api/integrations/tiktok-ads/accounts', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setAccountsError(data?.error || 'Failed to load accounts')
          return
        }
        setAdvertisers(data.advertisers || [])
        if (!(data.advertisers?.length > 0)) setAccountsError('Hesap bulunamadı')
      })
      .catch((e) => setAccountsError(e instanceof Error ? e.message : 'Network error'))
      .finally(() => setAdvertisersLoading(false))
  }, [showAccountModal, isTikTokConnected])

  const openAccountModal = useCallback(() => {
    setShowAccountModal(true)
  }, [])

  const selectAccount = useCallback(async (advertiserId: string, advertiserName?: string) => {
    setSelectingKey(advertiserId)
    setAccountsError(null)
    try {
      const res = await fetch('/api/integrations/tiktok-ads/select-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advertiserId, advertiserName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data?.error || 'Failed to select account'
        setAccountsError(msg)
        addToast(msg, 'error')
        return
      }
      setSelected({
        advertiserId: data.advertiserId,
        advertiserName: data.advertiserName || `Advertiser ${data.advertiserId}`,
      })
      setShowAccountModal(false)
      await onAccountSelected?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error'
      setAccountsError(msg)
      addToast(msg, 'error')
    } finally {
      setSelectingKey(null)
    }
  }, [addToast, onAccountSelected])

  const disconnect = useCallback(async () => {
    try {
      await fetch('/api/integrations/tiktok-ads/disconnect', { method: 'POST' })
      setIsTikTokConnected(false)
      setSelected(null)
      addToast('TikTok Ads bağlantısı kesildi', 'info')
    } catch {
      addToast('Bağlantı kesilirken hata oluştu', 'error')
    }
  }, [addToast])

  return {
    isTikTokConnected, selected, isLoading,
    showAccountModal, setShowAccountModal,
    advertisers, advertisersLoading,
    selectingKey, accountsError,
    openAccountModal, selectAccount, disconnect,
  }
}
