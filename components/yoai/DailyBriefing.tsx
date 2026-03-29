'use client'

import { Sun, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Target, Zap } from 'lucide-react'
import type { DeepAnalysisResult } from '@/lib/yoai/analysisTypes'

interface Props {
  data: DeepAnalysisResult | null
  loading: boolean
}

export default function DailyBriefing({ data, loading }: Props) {
  if (loading || !data) return null

  const { campaigns, kpis } = data
  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED')
  const criticalCampaigns = campaigns.filter(c => c.riskLevel === 'critical' || c.riskLevel === 'high')
  const lowRoasCampaigns = campaigns.filter(c => c.metrics.roas != null && c.metrics.roas < 1 && c.metrics.spend > 100)
  const highPerformers = campaigns.filter(c => c.score >= 80).length
  const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })

  // Build briefing items
  const items: { icon: React.ElementType; color: string; text: string; type: 'info' | 'warning' | 'success' }[] = []

  // Spending summary
  items.push({
    icon: DollarSign,
    color: 'text-emerald-600',
    text: `Son 7 günde toplam ₺${kpis.totalSpend.toFixed(0)} harcandı, ${kpis.totalConversions} dönüşüm elde edildi.`,
    type: 'info',
  })

  // Critical alerts
  if (criticalCampaigns.length > 0) {
    items.push({
      icon: AlertTriangle,
      color: 'text-red-600',
      text: `${criticalCampaigns.length} kampanya kritik durumda — acil müdahale önerilir.`,
      type: 'warning',
    })
  }

  // Low ROAS warning
  if (lowRoasCampaigns.length > 0) {
    items.push({
      icon: TrendingDown,
      color: 'text-orange-600',
      text: `${lowRoasCampaigns.length} kampanyada ROAS 1x altında — reklam harcaması geri dönmüyor.`,
      type: 'warning',
    })
  }

  // High performers
  if (highPerformers > 0) {
    items.push({
      icon: TrendingUp,
      color: 'text-emerald-600',
      text: `${highPerformers} kampanya yüksek performans gösteriyor (80+ puan).`,
      type: 'success',
    })
  }

  // Conversion rate
  if (kpis.totalClicks > 0) {
    const convRate = (kpis.totalConversions / kpis.totalClicks) * 100
    if (convRate < 1) {
      items.push({
        icon: Target,
        color: 'text-amber-600',
        text: `Dönüşüm oranı %${convRate.toFixed(2)} — sektör ortalamasının altında. Landing page optimizasyonu değerlendirin.`,
        type: 'warning',
      })
    }
  }

  // Action count
  const actionCount = data.actions.length
  if (actionCount > 0) {
    items.push({
      icon: Zap,
      color: 'text-primary',
      text: `Bugün yapmanız önerilen ${actionCount} aksiyon var.`,
      type: 'info',
    })
  }

  if (items.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sun className="w-5 h-5 text-amber-500" />
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Günlük AI Brifing</h2>
          <p className="text-[10px] text-gray-400">{today}</p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => {
          const Icon = item.icon
          return (
            <div key={i} className={`flex items-start gap-2.5 rounded-lg px-3 py-2 ${
              item.type === 'warning' ? 'bg-amber-50' : item.type === 'success' ? 'bg-emerald-50' : 'bg-gray-50'
            }`}>
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${item.color}`} />
              <p className="text-xs text-gray-700 leading-relaxed">{item.text}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
