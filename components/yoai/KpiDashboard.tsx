'use client'

import { DollarSign, Eye, MousePointer, Target, TrendingUp, BarChart3 } from 'lucide-react'
import type { AggregatedKpis } from '@/lib/yoai/analysisTypes'

interface Props {
  kpis: AggregatedKpis | null
  loading: boolean
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export default function KpiDashboard({ kpis }: Props) {
  // Loading skeleton kaldırıldı — veri yoksa "—" placeholder göster
  const metrics = [
    {
      label: 'Toplam Harcama',
      value: kpis ? `₺${fmt(kpis.totalSpend)}` : '—',
      icon: DollarSign,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
    },
    {
      label: 'Gösterim',
      value: kpis ? fmt(kpis.totalImpressions) : '—',
      icon: Eye,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
    },
    {
      label: 'Tıklama',
      value: kpis ? fmt(kpis.totalClicks) : '—',
      icon: MousePointer,
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-50',
    },
    {
      label: 'Ort. CTR',
      value: kpis ? `%${fmt(kpis.weightedCtr, 2)}` : '—',
      icon: TrendingUp,
      iconColor: 'text-gray-600',
      iconBg: 'bg-gray-50',
    },
    {
      label: 'Ort. CPC',
      value: kpis ? `₺${fmt(kpis.weightedCpc, 2)}` : '—',
      icon: BarChart3,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-50',
    },
    {
      label: 'Dönüşüm',
      value: kpis ? fmt(kpis.totalConversions) : '—',
      icon: Target,
      iconColor: 'text-primary',
      iconBg: 'bg-emerald-50',
    },
  ]

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map(m => {
          const Icon = m.icon
          return (
            <div key={m.label} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 ${m.iconBg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-3.5 h-3.5 ${m.iconColor}`} />
                </div>
                <span className="text-[11px] text-gray-400 font-medium">{m.label}</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{m.value}</p>
            </div>
          )
        })}
      </div>

    </div>
  )
}
