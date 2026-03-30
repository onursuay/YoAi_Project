'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, TrendingUp, TrendingDown, DollarSign, Target, Zap, Newspaper } from 'lucide-react'
import type { DeepAnalysisResult } from '@/lib/yoai/analysisTypes'

interface Props {
  data: DeepAnalysisResult | null
  loading: boolean
}

export default function DailyBriefing({ data, loading }: Props) {
  const [revealed, setRevealed] = useState(false)
  const [imageReady, setImageReady] = useState(false)

  // Trigger reveal animation only after image is loaded
  useEffect(() => {
    if (!loading && data && imageReady) {
      const timer = setTimeout(() => setRevealed(true), 400)
      return () => clearTimeout(timer)
    }
  }, [loading, data, imageReady])

  // Fallback: if image takes too long (>3s), reveal anyway
  useEffect(() => {
    if (!loading && data && !imageReady) {
      const fallback = setTimeout(() => setImageReady(true), 3000)
      return () => clearTimeout(fallback)
    }
  }, [loading, data, imageReady])

  if (loading || !data) return null

  const { campaigns, kpis } = data
  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED')
  const criticalCampaigns = campaigns.filter(c => c.riskLevel === 'critical' || c.riskLevel === 'high')
  const lowRoasCampaigns = campaigns.filter(c => c.metrics.roas != null && c.metrics.roas < 1 && c.metrics.spend > 100)
  const highPerformers = campaigns.filter(c => c.score >= 80).length
  const actionCount = data.actions.length
  const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })

  // Build prioritized items
  const priorities: { icon: React.ElementType; text: string; type: 'critical' | 'warning' | 'success' | 'info' }[] = []

  if (criticalCampaigns.length > 0) {
    priorities.push({ icon: AlertTriangle, text: `${criticalCampaigns.length} kampanya kritik durumda, acil müdahale önerilir.`, type: 'critical' })
  }
  if (lowRoasCampaigns.length > 0) {
    priorities.push({ icon: TrendingDown, text: `${lowRoasCampaigns.length} kampanyada ROAS 1x altında, harcama geri dönmüyor.`, type: 'warning' })
  }
  if (highPerformers > 0) {
    priorities.push({ icon: TrendingUp, text: `${highPerformers} kampanya yüksek performans gösteriyor.`, type: 'success' })
  }
  if (kpis.totalClicks > 0) {
    const convRate = (kpis.totalConversions / kpis.totalClicks) * 100
    if (convRate < 1) {
      priorities.push({ icon: Target, text: `Dönüşüm oranı %${convRate.toFixed(2)}, landing page optimizasyonu değerlendirin.`, type: 'warning' })
    }
  }
  if (actionCount > 0) {
    priorities.push({ icon: Zap, text: `${actionCount} aksiyon önerisi mevcut.`, type: 'info' })
  }

  if (priorities.length === 0) return null

  const typeStyles = {
    critical: 'border-l-red-500 bg-red-50/50',
    warning: 'border-l-amber-500 bg-amber-50/50',
    success: 'border-l-emerald-500 bg-emerald-50/50',
    info: 'border-l-blue-500 bg-blue-50/50',
  }
  const iconStyles = {
    critical: 'text-red-600',
    warning: 'text-amber-600',
    success: 'text-emerald-600',
    info: 'text-blue-600',
  }

  return (
    <div className="relative bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Bottom layer: actual content */}
      <div className="p-6">
        {/* Header */}
        <div className="mb-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{today}</p>
          <h2 className="text-base font-semibold text-gray-900 mt-0.5 flex items-center gap-1.5"><Newspaper className="w-4 h-4 text-primary" />Günlük Brifing</h2>
        </div>

        {/* Executive summary */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            Son 7 günde <strong className="text-gray-900">₺{kpis.totalSpend.toFixed(0)}</strong> harcanarak{' '}
            <strong className="text-gray-900">{kpis.totalConversions}</strong> dönüşüm elde edildi.{' '}
            {criticalCampaigns.length > 0 ? `${criticalCampaigns.length} kampanya dikkat gerektiriyor.` : 'Genel durum stabil.'}
          </p>
        </div>

        {/* Priority items */}
        <div className="space-y-2">
          {priorities.map((item, i) => {
            const Icon = item.icon
            return (
              <div key={i} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border-l-[3px] ${typeStyles[item.type]}`}>
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconStyles[item.type]}`} />
                <p className="text-[13px] text-gray-700 leading-relaxed">{item.text}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top layer: image overlay — slides up to reveal content */}
      <div
        className="absolute inset-0 z-10 bg-white transition-transform ease-linear pointer-events-none"
        style={{
          transform: revealed ? 'translateY(-100%)' : 'translateY(0)',
          transitionDuration: '600ms',
        }}
      >
        <img
          src="/ai-birf.jpg"
          alt=""
          className="w-full h-full object-cover rounded-2xl"
          onLoad={() => setImageReady(true)}
          onError={() => setImageReady(true)}
        />
      </div>
    </div>
  )
}
