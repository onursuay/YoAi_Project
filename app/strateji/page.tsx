'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import { ToastContainer } from '@/components/Toast'
import type { Toast } from '@/components/Toast'
import type { StrategyInstance } from '@/lib/strategy/types'
import { strategyPath } from '@/lib/strategy/url'
import { COST_PER_STRATEGY } from '@/lib/subscription/types'
import { useSubscription } from '@/components/providers/SubscriptionProvider'
import { useCredits } from '@/components/providers/CreditProvider'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'
import KPIBar from '@/components/strateji/KPIBar'
import StrategyList from '@/components/strateji/StrategyList'

export default function StratejiPage() {
  const router = useRouter()
  const t = useTranslations('dashboard.strateji')
  const locale = useLocale()
  const [instances, setInstances] = useState<StrategyInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [gateAccessType, setGateAccessType] = useState<'credit' | 'subscription' | null>(null)
  const [gateFeatureKey, setGateFeatureKey] = useState<string>('strategy')
  // Aktif Meta hesabı — Topbar'da hesap seçici göstermek için (Optimizasyon ile aynı desen)
  const [adAccountName, setAdAccountName] = useState<string | null>(null)

  const { needsCreditsForStrategy, strategyUsedThisMonth, strategyMonthlyLimit, recordStrategyUsage, hasSubscription } = useSubscription()
  const { hasEnoughCredits, refresh: refreshCredits } = useCredits()

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const fetchInstances = useCallback(async () => {
    try {
      const res = await fetch('/api/strategy/instances')
      if (!res.ok) { setInstances([]); return }
      const json = await res.json()
      if (json.ok) setInstances(json.instances ?? [])
    } catch {
      setInstances([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchInstances() }, [fetchInstances])

  // Aktif Meta hesabını çek (Topbar hesap seçici için). Geçişte sayfa reload olur,
  // /api/strategy/instances resolveMetaContext ile yeni hesabın verisini döner.
  useEffect(() => {
    fetch('/api/meta/status', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.connected && d?.adAccountName) setAdAccountName(d.adAccountName) })
      .catch(() => {})
  }, [])

  const handleCreate = async () => {
    // Önce abonelik kontrolü — Strateji modülü subscription tier
    if (!hasSubscription) {
      setGateAccessType('subscription')
      setGateFeatureKey('strategy')
      return
    }
    // Limit kontrolü: Plan limiti aşıldıysa kredi gerekir (overage).
    // Kredi düşümü TEK NOKTADAN backend RPC'sinde (deduct_strategy_credit) yapılır;
    // çift düşmeyi önlemek için client tarafında spendCredits ÇAĞRILMAZ.
    if (needsCreditsForStrategy && !hasEnoughCredits(COST_PER_STRATEGY)) {
      setGateAccessType('credit')
      setGateFeatureKey('strategy_overage')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/strategy/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t('newStrategyTitle', { date: new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'tr-TR') }) }),
      })
      const json = await res.json()
      if (json.ok && json.instance) {
        recordStrategyUsage()
        // Backend RPC'sinin düştüğü gerçek kredi bakiyesini UI'a yansıt
        await refreshCredits()
        if (needsCreditsForStrategy) {
          addToast(t('toast.creditUsed', { count: COST_PER_STRATEGY }), 'info')
        }
        router.push(strategyPath(json.instance))
      } else {
        addToast(json.message || t('toast.createFailed'), 'error')
      }
    } catch {
      addToast(t('toast.genericError'), 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (instanceId: string) => {
    if (!confirm(t('confirmDelete'))) return
    try {
      const res = await fetch(`/api/strategy/instances/${instanceId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.ok) {
        addToast(t('toast.deleted'), 'success')
        fetchInstances()
      } else {
        addToast(json.message || t('toast.deleteFailed'), 'error')
      }
    } catch {
      addToast(t('toast.genericError'), 'error')
    }
  }

  const handleRetry = async (instanceId: string) => {
    try {
      const res = await fetch(`/api/strategy/instances/${instanceId}/retry`, { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        addToast(t('toast.retrying'), 'info')
        fetchInstances()
      } else {
        addToast(json.message || t('toast.retryFailed'), 'error')
      }
    } catch {
      addToast(t('toast.genericError'), 'error')
    }
  }

  // Limit bilgisi metni
  const limitText = strategyMonthlyLimit === -1
    ? t('unlimited')
    : t('usedCount', { used: strategyUsedThisMonth, limit: strategyMonthlyLimit })

  return (
    <>
      <Topbar
        title={t('title')}
        description={t('pageDescription')}
        adAccountName={adAccountName || undefined}
        actionButton={{
          label: creating ? t('creating') : t('newStrategy'),
          onClick: handleCreate,
          disabled: creating,
        }}
      />
      <div className="flex-1 overflow-y-auto app-content-surface p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* KPI Bar */}
          <KPIBar />

          {/* Modül açıklaması + kullanım bilgisi */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 animate-card-enter">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🎯</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">{t('engineTitle')}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    needsCreditsForStrategy
                      ? 'bg-primary/10 text-primary'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {t('aiStrategyLimit', { limit: limitText })}
                    {needsCreditsForStrategy && t('creditsPerPlan', { count: COST_PER_STRATEGY })}
                  </span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  <li className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-0.5 flex-shrink-0">💡</span>
                    {t('benefit1')}
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-0.5 flex-shrink-0">💡</span>
                    {t('benefit2')}
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-0.5 flex-shrink-0">💡</span>
                    {t('benefit3')}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Strateji Listesi */}
          <div className="animate-card-enter" style={{ ['--card-index' as string]: 1 }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-medium text-gray-700">{t('plansTitle')}</h3>
              <span className="text-xs text-gray-500">{t('recordCount', { count: instances.length })}</span>
            </div>
            <StrategyList
              instances={instances}
              loading={loading}
              scanning={false}
              onRetry={handleRetry}
              onDelete={handleDelete}
            />
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      {gateAccessType && (
        <AccessRequiredModal
          type={gateAccessType}
          featureKey={gateFeatureKey}
          reason={`strategy_gate_${gateAccessType}_${gateFeatureKey}`}
        />
      )}
    </>
  )
}
