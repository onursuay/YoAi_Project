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
  /** Owner / süper admin hesabı — abonelik bariyerleri bu kullanıcıya uygulanmaz. */
  isOwner: boolean
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
  const [isOwner, setIsOwner] = useState(false)

  const refresh = useCallback(async () => {
    // Billing durumunu güvenilir biçimde çöz. Yalnızca 200 yanıt durumu
    // "çözülmüş" sayar; geçici ağ/5xx/erken-401 (oturum cookie'si henüz
    // hazır değil) hatalarında birkaç kez dener.
    //
    // KRİTİK — FAIL-OPEN: Hiçbir denemede çözülemezse durumu kilitleyici
    // FREE_DEFAULT'a DÜŞÜRME; mevcut (iyi huylu) durumu KORU. Aksi halde
    // tek bir geçici billing hatası owner'ı ve ödeme yapan kullanıcıyı
    // CRM/Email/Marketing gibi tam-sayfa gate'li modüllerden kilitler.
    // Gerçek erişim kontrolü backend guard'larında kalır (modal yalnız UX).
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch('/api/billing/current', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setIsOwner(Boolean(data?.isOwner))
          if (data?.ok && data.subscription) {
            setSub({
              planId: data.subscription.planId,
              status: data.subscription.status,
              billingCycle: data.subscription.billingCycle,
              startDate: data.subscription.startDate,
              trialEndDate: data.subscription.trialEndDate,
              currentPeriodEnd: data.subscription.currentPeriodEnd,
              cancelAtPeriodEnd: data.subscription.cancelAtPeriodEnd ?? false,
            })
          } else {
            // 200 + abonelik yok → gerçekten ücretsiz/expired kullanıcı.
            setSub(FREE_DEFAULT)
          }
          setLoading(false)
          return
        }
        // non-ok (401/5xx) → geçici olabilir, tekrar dene
      } catch {
        // ağ hatası → tekrar dene
      }
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }
    // Tüm denemeler başarısız: FAIL-OPEN — durumu düşürme, sadece yüklemeyi bitir.
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    setAiScanUsedToday(getAiScanUsage().count)
    setStrategyUsedThisMonth(getStrategyUsage().count)

    // Bayat provider durumunu otomatik iyileştir: sekme tekrar odaklanınca
    // veya görünür olunca billing'i sessizce yeniden çek — böylece kullanıcı
    // manuel hard refresh yapmak zorunda kalmaz.
    const onFocus = () => { void refresh() }
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
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
      isOwner,
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
