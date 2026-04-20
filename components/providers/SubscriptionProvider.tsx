'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { type SubscriptionState, SUBSCRIPTION_DEFAULTS } from '@/lib/subscription/types'
import { getAiScanUsage, incrementAiScanUsage, getStrategyUsage, incrementStrategyUsage } from '@/lib/subscription/storage'
import { isPaidSubscription, isTrialActive, getTrialDaysRemaining, canUseOptimization, getAiScanDailyLimit, getStrategyMonthlyLimit, hasActiveSubscription } from '@/lib/subscription/helpers'

interface SubscriptionContextValue {
  subscription: SubscriptionState
  loading: boolean
  refresh: () => Promise<void>
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
  canUseStrategy: boolean
  needsCreditsForStrategy: boolean
  recordStrategyUsage: () => boolean
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null)

const FREE_DEFAULT: SubscriptionState = {
  planId: 'free',
  status: 'expired',
  billingCycle: 'monthly',
  startDate: new Date().toISOString(),
  trialEndDate: null,
  currentPeriodEnd: new Date().toISOString(),
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [sub, setSub] = useState<SubscriptionState>(SUBSCRIPTION_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [aiScanUsedToday, setAiScanUsedToday] = useState(0)
  const [strategyUsedThisMonth, setStrategyUsedThisMonth] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/current', { cache: 'no-store' })
      if (!res.ok) { setSub(FREE_DEFAULT); return }
      const data = await res.json()
      if (data?.ok && data.subscription) {
        setSub({
          planId: data.subscription.planId,
          status: data.subscription.status,
          billingCycle: data.subscription.billingCycle,
          startDate: data.subscription.startDate,
          trialEndDate: data.subscription.trialEndDate,
          currentPeriodEnd: data.subscription.currentPeriodEnd,
        })
      } else {
        setSub(FREE_DEFAULT)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    setAiScanUsedToday(getAiScanUsage().count)
    setStrategyUsedThisMonth(getStrategyUsage().count)
  }, [refresh])

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
      loading,
      refresh,
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
