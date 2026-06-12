'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { COST_PER_GENERATION } from '@/lib/subscription/types'

interface CreditContextValue {
  credits: number
  totalSpent: number
  totalEarned: number
  loading: boolean
  /** Owner / süper admin hesabı — kredi bariyerleri bu kullanıcıya uygulanmaz. */
  isOwner: boolean
  refresh: () => Promise<void>
  spendCredits: (amount?: number) => Promise<boolean>
  refundCredits: (amount?: number) => Promise<void>
  hasEnoughCredits: (amount?: number) => boolean
}

const CreditContext = createContext<CreditContextValue | null>(null)

interface State {
  balance: number
  totalEarned: number
  totalSpent: number
  isOwner: boolean
}

const INITIAL: State = { balance: 0, totalEarned: 0, totalSpent: 0, isOwner: false }

export function CreditProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(INITIAL)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/current', { cache: 'no-store' })
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      if (data?.ok && data.credits) {
        setState({
          balance: data.credits.balance,
          totalEarned: data.credits.totalEarned,
          totalSpent: data.credits.totalSpent,
          isOwner: Boolean(data.isOwner),
        })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const spendCredits = useCallback(async (amount = COST_PER_GENERATION) => {
    const res = await fetch('/api/credits/spend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    })
    if (!res.ok) return false
    const data = await res.json()
    if (!data?.ok) return false
    setState((prev) => ({
      balance: data.credits.balance,
      totalEarned: data.credits.totalEarned,
      totalSpent: data.credits.totalSpent,
      isOwner: prev.isOwner,
    }))
    return true
  }, [])

  // Kredi iadesi artık SUNUCUDA (üretim guard'ı başarısızlıkta otomatik iade eder).
  // İstemci yalnız gerçek bakiyeyi yeniden çeker — public refund endpoint'i kaldırıldı
  // (keyfi 'amount' ile sınırsız kredi basma açığını kapatmak için).
  const refundCredits = useCallback(async (_amount = COST_PER_GENERATION) => {
    await refresh()
  }, [refresh])

  // Owner / süper admin allowlist'i kredi bakiyesinden bağımsız olarak
  // her aksiyonu geçer — UI bariyeri kullanıcı deneyimi içindir, gerçek
  // koruma backend guard'ında kalır.
  const hasEnoughCredits = useCallback((amount = COST_PER_GENERATION) => {
    if (state.isOwner) return true
    return state.balance >= amount
  }, [state.balance, state.isOwner])

  return (
    <CreditContext.Provider value={{
      credits: state.balance,
      totalSpent: state.totalSpent,
      totalEarned: state.totalEarned,
      loading,
      isOwner: state.isOwner,
      refresh,
      spendCredits,
      refundCredits,
      hasEnoughCredits,
    }}>
      {children}
    </CreditContext.Provider>
  )
}

export function useCredits() {
  const ctx = useContext(CreditContext)
  if (!ctx) throw new Error('useCredits must be used within CreditProvider')
  return ctx
}
