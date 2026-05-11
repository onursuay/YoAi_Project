'use client'

import { useState } from 'react'
import { DollarSign, Eye, MousePointer, Target, TrendingUp, BarChart3, Layers } from 'lucide-react'
import type { AggregatedKpis } from '@/lib/yoai/analysisTypes'

interface Props {
  kpis: AggregatedKpis | null
  loading: boolean
}

type PlatformTab = 'all' | 'meta' | 'google'

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function derivePlatformMetrics(kpis: AggregatedKpis, platformKey: 'Meta' | 'Google') {
  const bd = kpis.platformBreakdown.find(p => p.platform === platformKey)
  if (!bd) return null
  const ctr = bd.impressions > 0 ? (bd.clicks / bd.impressions) * 100 : 0
  const cpc = bd.clicks > 0 ? bd.spend / bd.clicks : 0
  return { ...bd, ctr, cpc }
}

export default function KpiDashboard({ kpis }: Props) {
  const [tab, setTab] = useState<PlatformTab>('all')

  const tabs: { key: PlatformTab; label: string }[] = [
    { key: 'all', label: 'Tümü' },
    { key: 'meta', label: 'Meta' },
    { key: 'google', label: 'Google' },
  ]

  const allMetrics = kpis
    ? [
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
          label: 'Toplam Dönüşüm',
          value: fmt(kpis.totalConversions),
          icon: Target,
          iconColor: 'text-primary',
          iconBg: 'bg-emerald-50',
        },
        {
          label: 'Aktif Kampanya',
          value: fmt(kpis.activeCampaigns),
          icon: Layers,
          iconColor: 'text-gray-600',
          iconBg: 'bg-gray-50',
        },
      ]
    : []

  function buildPlatformMetrics(label: 'Meta' | 'Google') {
    if (!kpis) return []
    const pd = derivePlatformMetrics(kpis, label)
    if (!pd) return []
    return [
      {
        label: `${label} Harcama`,
        value: `₺${fmt(pd.spend)}`,
        icon: DollarSign,
        iconColor: 'text-emerald-600',
        iconBg: 'bg-emerald-50',
      },
      {
        label: `${label} Gösterim`,
        value: fmt(pd.impressions),
        icon: Eye,
        iconColor: 'text-blue-600',
        iconBg: 'bg-blue-50',
      },
      {
        label: `${label} Tıklama`,
        value: fmt(pd.clicks),
        icon: MousePointer,
        iconColor: 'text-violet-600',
        iconBg: 'bg-violet-50',
      },
      {
        label: `${label} CTR`,
        value: `%${fmt(pd.ctr, 2)}`,
        icon: TrendingUp,
        iconColor: 'text-gray-600',
        iconBg: 'bg-gray-50',
      },
      {
        label: `${label} CPC`,
        value: `₺${fmt(pd.cpc, 2)}`,
        icon: BarChart3,
        iconColor: 'text-red-600',
        iconBg: 'bg-red-50',
      },
      {
        label: `${label} Dönüşüm`,
        value: fmt(pd.conversions),
        icon: Target,
        iconColor: 'text-primary',
        iconBg: 'bg-emerald-50',
      },
    ]
  }

  const metrics =
    tab === 'all'
      ? allMetrics
      : tab === 'meta'
      ? buildPlatformMetrics('Meta')
      : buildPlatformMetrics('Google')

  const colClass =
    metrics.length <= 3
      ? 'grid-cols-2 md:grid-cols-3'
      : metrics.length === 5
      ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
      : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start">
      {/* Platform Selector — vertical left rail on desktop, horizontal on mobile */}
      <div className="flex sm:flex-col gap-1 w-full sm:w-24 shrink-0">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'flex-1 sm:flex-none w-full px-3 py-2 rounded-xl border text-[13px] font-medium transition-all text-left whitespace-nowrap',
              tab === t.key
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-primary/20 hover:text-gray-700',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="flex-1 min-w-0">
        {metrics.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center text-[13px] text-gray-400">
            {tab === 'meta' ? 'Meta kampanya verisi bulunamadı.' : 'Google kampanya verisi bulunamadı.'}
          </div>
        ) : (
          <div className={`grid ${colClass} gap-3`}>
            {metrics.map(m => {
              const Icon = m.icon
              return (
                <div
                  key={m.label}
                  className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 ${m.iconBg} rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${m.iconColor}`} />
                    </div>
                    <span className="text-[13px] text-gray-500 font-medium">{m.label}</span>
                  </div>
                  <p className="text-base font-bold text-gray-900">{m.value}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
