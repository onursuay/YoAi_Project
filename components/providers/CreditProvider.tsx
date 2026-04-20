'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { COST_PER_GENERATION } from '@/lib/subscription/types'

interface CreditContextValue {
  credits: number
  totalSpent: number
  totalEarned: number
  loading: boolean
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
}

const INITIAL: State = { balance: 0, totalEarned: 0, totalSpent: 0 }

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
    setState({
      balance: data.credits.balance,
      totalEarned: data.credits.totalEarned,
      totalSpent: data.credits.totalSpent,
    })
    return true
  }, [])

  const refundCredits = useCallback(async (amount = COST_PER_GENERATION) => {
    const res = await fetch('/api/credits/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    })
    if (!res.ok) return
    const data = await res.json()
    if (data?.ok) {
      setState({
        balance: data.credits.balance,
        totalEarned: data.credits.totalEarned,
        totalSpent: data.credits.totalSpent,
      })
    }
  }, [])

  const hasEnoughCredits = useCallback((amount = COST_PER_GENERATION) => {
    return state.balance >= amount
  }, [state.balance])

  return (
    <CreditContext.Provider value={{
      credits: state.balance,
      totalSpent: state.totalSpent,
      totalEarned: state.totalEarned,
      loading,
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
