'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Topbar from '@/components/Topbar'
import { ToastContainer } from '@/components/Toast'
import type { Toast } from '@/components/Toast'
import type { StrategyInstance } from '@/lib/strategy/types'
import { COST_PER_STRATEGY } from '@/lib/subscription/types'
import { useSubscription } from '@/components/providers/SubscriptionProvider'
import { useCredits } from '@/components/providers/CreditProvider'
import SubscriptionGateModal from '@/components/subscription/SubscriptionGateModal'
import KPIBar from '@/components/strateji/KPIBar'
import StrategyList from '@/components/strateji/StrategyList'

export default function StratejiPage() {
  const router = useRouter()
  const [instances, setInstances] = useState<StrategyInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [showGate, setShowGate] = useState(false)

  const { canUseStrategy, needsCreditsForStrategy, strategyUsedThisMonth, strategyMonthlyLimit, recordStrategyUsage } = useSubscription()
  const { credits, hasEnoughCredits, spendCredits } = useCredits()

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

  const handleCreate = async () => {
    // Limit kontrolü: Plan limiti aşıldıysa kredi gerekir
    if (needsCreditsForStrategy) {
      if (!hasEnoughCredits(COST_PER_STRATEGY)) {
        setShowGate(true)
        return
      }
      // Kredi düş
      spendCredits(COST_PER_STRATEGY)
      addToast(`${COST_PER_STRATEGY} kredi kullanıldı (Kalan: ${credits - COST_PER_STRATEGY})`, 'info')
    }

    setCreating(true)
    try {
      const res = await fetch('/api/strategy/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Yeni Strateji — ${new Date().toLocaleDateString('tr-TR')}` }),
      })
      const json = await res.json()
      if (json.ok && json.instance) {
        recordStrategyUsage()
        router.push(`/strateji/${json.instance.id}`)
      } else {
        addToast(json.message || 'Strateji oluşturulamadı', 'error')
      }
    } catch {
      addToast('Bir hata oluştu', 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (instanceId: string) => {
    if (!confirm('Bu strateji planını silmek istediğinize emin misiniz?')) return
    try {
      const res = await fetch(`/api/strategy/instances/${instanceId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.ok) {
        addToast('Strateji silindi', 'success')
        fetchInstances()
      } else {
        addToast(json.message || 'Silinemedi', 'error')
      }
    } catch {
      addToast('Bir hata oluştu', 'error')
    }
  }

  const handleRetry = async (instanceId: string) => {
    try {
      const res = await fetch(`/api/strategy/instances/${instanceId}/retry`, { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        addToast('Tekrar deneniyor', 'info')
        fetchInstances()
      } else {
        addToast(json.message || 'Tekrar denenemedi', 'error')
      }
    } catch {
      addToast('Bir hata oluştu', 'error')
    }
  }

  // Limit bilgisi metni
  const limitText = strategyMonthlyLimit === -1
    ? 'Sınırsız'
    : `${strategyUsedThisMonth}/${strategyMonthlyLimit} kullanıldı`

  return (
    <>
      <Topbar
        title="Strateji"
        description="Pazarlama stratejilerinizi oluşturun, yönetin ve optimize edin"
        actionButton={{
          label: creating ? 'Oluşturuluyor...' : 'Yeni Strateji',
          onClick: handleCreate,
          disabled: creating,
        }}
      />
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* KPI Bar */}
          <KPIBar />

          {/* Modül açıklaması + kullanım bilgisi */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🎯</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Strateji Motoru</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    needsCreditsForStrategy
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    AI Strateji: {limitText}
                    {needsCreditsForStrategy && ` · ${COST_PER_STRATEGY} kredi/plan`}
                  </span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  <li className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="mt-0.5 flex-shrink-0">💡</span>
                    Markanız için AI destekli reklam stratejisi oluşturun. Hedef kitle, bütçe dağılımı ve kampanya planı otomatik hazırlanır.
                  </li>
                  <li className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="mt-0.5 flex-shrink-0">💡</span>
                    İşletme bilgilerinizi girin &gt; AI strateji planı üretsin &gt; Uygulayın, AI optimize etsin.
                  </li>
                  <li className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="mt-0.5 flex-shrink-0">💡</span>
                    Plan aktifken haftalık metrik analizi ve AI optimizasyon önerileri otomatik gelir.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Strateji Listesi */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Strateji Planları</h3>
              <span className="text-xs text-gray-400">{instances.length} kayıt</span>
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
      {showGate && (
        <SubscriptionGateModal
          type="strategyLimit"
          onClose={() => setShowGate(false)}
        />
      )}
    </>
  )
}
