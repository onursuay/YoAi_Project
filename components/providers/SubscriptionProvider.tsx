'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { type SubscriptionState, SUBSCRIPTION_DEFAULTS } from '@/lib/subscription/types'
import { getStoredSubscription, setStoredSubscription, getAiScanUsage, incrementAiScanUsage, getStrategyUsage, incrementStrategyUsage } from '@/lib/subscription/storage'
import { isPaidSubscription, isTrialActive, getTrialDaysRemaining, canUseOptimization, getAiScanDailyLimit, getStrategyMonthlyLimit, hasActiveSubscription } from '@/lib/subscription/helpers'

interface SubscriptionContextValue {
  subscription: SubscriptionState
  updateSubscription: (partial: Partial<SubscriptionState>) => void
  isPaid: boolean
  isTrialActive: boolean
  trialDaysRemaining: number
  canUseOptimizationAI: boolean
  hasSubscription: boolean
  aiScanUsedToday: number
  aiScanDailyLimit: number
  canDoAiScan: boolean
  recordAiScan: () => boolean
  strategyUsedThisMonth: number
  strategyMonthlyLimit: number
  canUseStrategy: boolean       // Plan limiti dahilinde mi?
  needsCreditsForStrategy: boolean // Limit aşıldı, kredi gerekiyor mu?
  recordStrategyUsage: () => boolean
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [sub, setSub] = useState<SubscriptionState>(SUBSCRIPTION_DEFAULTS)
  const [loaded, setLoaded] = useState(false)
  const [aiScanUsedToday, setAiScanUsedToday] = useState(0)
  const [strategyUsedThisMonth, setStrategyUsedThisMonth] = useState(0)

  useEffect(() => {
    setSub(getStoredSubscription())
    setAiScanUsedToday(getAiScanUsage().count)
    setStrategyUsedThisMonth(getStrategyUsage().count)
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) setStoredSubscription(sub)
  }, [sub, loaded])

  const updateSubscription = useCallback((partial: Partial<SubscriptionState>) => {
    setSub(prev => ({ ...prev, ...partial }))
  }, [])

  const paid = isPaidSubscription(sub)
  const trial = isTrialActive(sub)
  const trialDays = getTrialDaysRemaining(sub)
  const canOptimize = canUseOptimization(sub)
  const active = hasActiveSubscription(sub)
  const dailyLimit = getAiScanDailyLimit(sub)
  const canScan = canOptimize && (dailyLimit === -1 || aiScanUsedToday < dailyLimit)

  const recordAiScan = useCallback(() => {
    if (!canScan) return false
    const updated = incrementAiScanUsage()
    setAiScanUsedToday(updated.count)
    return true
  }, [canScan])

  const strategyLimit = getStrategyMonthlyLimit(sub)
  const withinFreeLimit = strategyLimit === -1 || strategyUsedThisMonth < strategyLimit
  const needsCredits = !withinFreeLimit

  const recordStrategyUsage = useCallback(() => {
    const updated = incrementStrategyUsage()
    setStrategyUsedThisMonth(updated.count)
    return true
  }, [])

  return (
    <SubscriptionContext.Provider value={{
      subscription: sub,
      updateSubscription,
      isPaid: paid,
      isTrialActive: trial,
      trialDaysRemaining: trialDays,
      canUseOptimizationAI: canOptimize,
      hasSubscription: active,
      aiScanUsedToday,
      aiScanDailyLimit: dailyLimit,
      canDoAiScan: canScan,
      recordAiScan,
      strategyUsedThisMonth,
      strategyMonthlyLimit: strategyLimit,
      canUseStrategy: withinFreeLimit,
      needsCreditsForStrategy: needsCredits,
      recordStrategyUsage,
    }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider')
  return ctx
}
