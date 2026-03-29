'use client'

import { Monitor, Megaphone, AlertOctagon, Lightbulb, ClipboardCheck, Layers } from 'lucide-react'
import type { DeepHealthOverview } from '@/lib/yoai/analysisTypes'

interface Props {
  health: DeepHealthOverview | null
  loading: boolean
}

export default function HealthOverviewCards({ health, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-[120px] bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
      </div>
    )
  }

  if (!health) return null

  const cards = [
    { label: 'Bağlı Platformlar', value: health.connectedAccounts.count, subtitle: health.connectedAccounts.platforms.join(', ') || 'Bağlı platform yok', icon: Monitor, iconColor: 'text-blue-600', iconBg: 'bg-blue-50' },
    { label: 'Aktif Kampanyalar', value: health.activeCampaigns, subtitle: `${health.totalAdsets} adset · ${health.totalAds} reklam`, icon: Megaphone, iconColor: 'text-violet-600', iconBg: 'bg-violet-50' },
    { label: 'Kritik Uyarılar', value: health.criticalAlerts, subtitle: health.criticalAlerts > 0 ? 'Müdahale önerilir' : 'Kritik sorun yok', icon: AlertOctagon, iconColor: 'text-red-600', iconBg: 'bg-red-50', highlight: health.criticalAlerts > 0 },
    { label: 'İyileştirme Fırsatları', value: health.opportunities, subtitle: 'Yüksek öncelikli aksiyonlar', icon: Lightbulb, iconColor: 'text-amber-600', iconBg: 'bg-amber-50' },
    { label: 'Bekleyen Onaylar', value: health.pendingApprovals, subtitle: health.pendingApprovals > 0 ? 'AI taslakları hazır' : 'Bekleyen yok', icon: ClipboardCheck, iconColor: 'text-primary', iconBg: 'bg-emerald-50' },
    { label: 'Önerilen Aksiyonlar', value: health.draftActions, subtitle: 'AI tarafından önerildi', icon: Layers, iconColor: 'text-indigo-600', iconBg: 'bg-indigo-50' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map(card => {
        const Icon = card.icon
        return (
          <div key={card.label} className={`bg-white rounded-2xl border p-5 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 ${card.highlight ? 'border-red-200 hover:border-red-300' : 'border-gray-100 hover:border-gray-200'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 ${card.iconBg} rounded-xl flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 mb-0.5">{card.value}</p>
            <p className="text-sm font-medium text-gray-700 mb-0.5">{card.label}</p>
            <p className="text-xs text-gray-400">{card.subtitle}</p>
          </div>
        )
      })}
    </div>
  )
}
