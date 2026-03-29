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

export default function KpiDashboard({ kpis, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-[90px] bg-white rounded-2xl border border-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!kpis) return null

  const metrics = [
    {
      label: 'Toplam Harcama',
      value: `₺${fmt(kpis.totalSpend)}`,
      icon: DollarSign,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
    },
    {
      label: 'Gösterim',
      value: fmt(kpis.totalImpressions),
      icon: Eye,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
    },
    {
      label: 'Tıklama',
      value: fmt(kpis.totalClicks),
      icon: MousePointer,
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-50',
    },
    {
      label: 'Ort. CTR',
      value: `%${fmt(kpis.weightedCtr, 2)}`,
      icon: TrendingUp,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
    },
    {
      label: 'Ort. CPC',
      value: `₺${fmt(kpis.weightedCpc, 2)}`,
      icon: BarChart3,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-50',
    },
    {
      label: 'Dönüşüm',
      value: fmt(kpis.totalConversions),
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

      {/* Platform breakdown */}
      {kpis.platformBreakdown.length > 1 && (
        <div className="flex items-center gap-4 mt-3">
          {kpis.platformBreakdown.map(pb => (
            <div key={pb.platform} className="flex items-center gap-2 text-[11px] text-gray-500">
              <span className={`w-2 h-2 rounded-full ${pb.platform === 'Meta' ? 'bg-blue-500' : 'bg-red-500'}`} />
              <span>{pb.platform}: ₺{fmt(pb.spend)} · {pb.campaignCount} kampanya</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
