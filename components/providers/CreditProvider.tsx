'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { type CreditState, CREDIT_DEFAULTS, COST_PER_GENERATION } from '@/lib/subscription/types'
import { getStoredCredits, setStoredCredits } from '@/lib/subscription/storage'

interface CreditContextValue {
  credits: number
  totalSpent: number
  totalEarned: number
  spendCredits: (amount?: number) => boolean
  refundCredits: (amount?: number) => void
  addCredits: (amount: number) => void
  resetCredits: () => void
  hasEnoughCredits: (amount?: number) => boolean
}

const CreditContext = createContext<CreditContextValue | null>(null)

export function CreditProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CreditState>(CREDIT_DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    setState(getStoredCredits())
    setLoaded(true)
  }, [])

  // Persist to localStorage on change
  useEffect(() => {
    if (loaded) setStoredCredits(state)
  }, [state, loaded])

  // Cross-tab sync: listen for localStorage changes from other tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'yoai-credits' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as CreditState
          setState(parsed)
        } catch { /* ignore parse errors */ }
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const spendCredits = useCallback((amount = COST_PER_GENERATION) => {
    if (state.balance < amount) return false
    setState(prev => ({
      ...prev,
      balance: prev.balance - amount,
      totalSpent: prev.totalSpent + amount,
      lastUpdated: new Date().toISOString(),
    }))
    return true
  }, [state.balance])

  const refundCredits = useCallback((amount = COST_PER_GENERATION) => {
    setState(prev => ({
      ...prev,
      balance: prev.balance + amount,
      totalSpent: prev.totalSpent - amount,
      lastUpdated: new Date().toISOString(),
    }))
  }, [])

  const addCredits = useCallback((amount: number) => {
    setState(prev => ({
      ...prev,
      balance: prev.balance + amount,
      totalEarned: prev.totalEarned + amount,
      lastUpdated: new Date().toISOString(),
    }))
  }, [])

  const resetCredits = useCallback(() => {
    setState(CREDIT_DEFAULTS)
  }, [])

  const hasEnoughCredits = useCallback((amount = COST_PER_GENERATION) => {
    return state.balance >= amount
  }, [state.balance])

  return (
    <CreditContext.Provider value={{
      credits: state.balance,
      totalSpent: state.totalSpent,
      totalEarned: state.totalEarned,
      spendCredits,
      refundCredits,
      addCredits,
      resetCredits,
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
