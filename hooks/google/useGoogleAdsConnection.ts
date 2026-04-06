'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'

export interface GoogleManagerOrAccount {
  customerId: string
  name: string
  isManager: boolean
}

export interface GoogleSelected {
  customerId: string
  loginCustomerId?: string
  customerName: string
  isManager?: boolean
}

type ToastFn = (message: string, type: 'info' | 'success' | 'error') => void

interface UseGoogleAdsConnectionOpts {
  addToast: ToastFn
  onAccountSelected?: () => Promise<void>
  onInitReady?: () => Promise<void>
}

export function useGoogleAdsConnection({ addToast, onAccountSelected, onInitReady }: UseGoogleAdsConnectionOpts) {
  const tEnt = useTranslations('dashboard.entegrasyon.google')

  const [isGoogleConnected, setIsGoogleConnected] = useState(false)
  const [selected, setSelected] = useState<GoogleSelected | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [managers, setManagers] = useState<GoogleManagerOrAccount[]>([])
  const [managersLoading, setManagersLoading] = useState(false)
  const [children, setChildren] = useState<GoogleManagerOrAccount[]>([])
  const [childrenLoading, setChildrenLoading] = useState(false)
  const [accountStep, setAccountStep] = useState<'managers' | 'children'>('managers')
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null)
  const [selectingKey, setSelectingKey] = useState<string | null>(null)
  const [accountsError, setAccountsError] = useState<string | null>(null)

  const fetchSelected = useCallback(async (): Promise<GoogleSelected | null> => {
    const res = await fetch('/api/integrations/google-ads/selected', { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    return data.selected ?? null
  }, [])

  // Init effect
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const statusRes = await fetch('/api/google/status', { cache: 'no-store' })
        const statusData = await statusRes.json().catch(() => ({}))
        if (!cancelled) setIsGoogleConnected(Boolean(statusData?.connected))

        if (!statusData?.connected) {
          if (!cancelled) setIsLoading(false)
          return
        }

        const sel = await fetchSelected()
        if (!cancelled) {
          setSelected(sel)
          if (!sel) setShowAccountModal(true)
          else if (sel.isManager) setShowAccountModal(true)
        }
        if (sel && !sel.isManager && !cancelled) {
          await onInitReady?.()
        }
      } catch {
        if (!cancelled) setIsGoogleConnected(false)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Account modal: fetch accounts when opened
  useEffect(() => {
    if (!showAccountModal || !isGoogleConnected) return
    setAccountsError(null)
    setManagers([])
    setChildren([])
    setAccountStep('managers')
    setSelectedManagerId(null)
    setManagersLoading(true)
    fetch('/api/integrations/google-ads/accounts', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (data?.error === 'not_ads_user') {
            setAccountsError('Hesabınız bulunamadı. Lütfen Google Ads hesabınız olan bir Gmail ile giriş yapın.')
          } else {
            setAccountsError(data?.message || data?.error || 'Failed to load accounts')
          }
          return
        }
        setManagers(data.customers || [])
        if (!(data.customers?.length > 0)) setAccountsError(tEnt('noAccounts'))
      })
      .catch((e) => setAccountsError(e instanceof Error ? e.message : 'Network error'))
      .finally(() => setManagersLoading(false))
  }, [showAccountModal, isGoogleConnected, tEnt])

  const openAccountModal = useCallback(() => {
    setShowAccountModal(true)
  }, [])

  const selectAccount = useCallback(async (loginCustomerId: string, customerId: string, customerName?: string) => {
    setSelectingKey(`account:${customerId}`)
    setAccountsError(null)
    try {
      const res = await fetch('/api/integrations/google-ads/select-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginCustomerId, customerId, customerName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data?.message || data?.error || 'Failed to select account'
        setAccountsError(msg)
        addToast(msg, 'error')
        return
      }
      setSelected({
        customerId: data.customerId,
        loginCustomerId: data.loginCustomerId,
        customerName: data.customerName || `Account ${data.customerId}`,
        isManager: false,
      })
      setShowAccountModal(false)
      setAccountStep('managers')
      setSelectedManagerId(null)
      setSelectingKey(null)
      await onAccountSelected?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error'
      setAccountsError(msg)
      addToast(msg, 'error')
    } finally {
      setSelectingKey(null)
    }
  }, [addToast, onAccountSelected])

  const onManagerOrAccountClick = useCallback(async (item: GoogleManagerOrAccount) => {
    if (item.isManager) {
      setSelectingKey(`manager:${item.customerId}`)
      setAccountsError(null)
      setChildren([])
      setSelectedManagerId(item.customerId)
      setChildrenLoading(true)
      try {
        const res = await fetch(
          `/api/integrations/google-ads/children?loginCustomerId=${encodeURIComponent(item.customerId)}`,
          { cache: 'no-store' }
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setAccountsError(data?.message || data?.error || 'Failed to load child accounts')
          return
        }
        setChildren(data.children || [])
        if (!(data.children?.length > 0)) setAccountsError(tEnt('noChildren'))
        setAccountStep('children')
      } catch (e) {
        setAccountsError(e instanceof Error ? e.message : 'Network error')
      } finally {
        setChildrenLoading(false)
        setSelectingKey(null)
      }
    } else {
      await selectAccount(item.customerId, item.customerId, item.name)
    }
  }, [selectAccount, tEnt])

  const onChildClick = useCallback((child: GoogleManagerOrAccount) => {
    if (selectedManagerId) selectAccount(selectedManagerId, child.customerId, child.name)
  }, [selectedManagerId, selectAccount])

  const backToManagers = useCallback(() => {
    setAccountStep('managers')
    setSelectedManagerId(null)
    setChildren([])
    setAccountsError(null)
  }, [])

  return {
    isGoogleConnected, selected, isLoading,
    showAccountModal, setShowAccountModal,
    managers, managersLoading,
    children, childrenLoading,
    accountStep, selectedManagerId,
    selectingKey, accountsError,
    openAccountModal, onManagerOrAccountClick, onChildClick, backToManagers,
  }
}
