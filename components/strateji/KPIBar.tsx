'use client'

import { useState, useEffect, useCallback } from 'react'
import { DollarSign, MousePointerClick, TrendingUp, Wallet, PiggyBank } from 'lucide-react'
import type { KPIData } from '@/lib/strategy/types'
import WizardSelect from '@/components/meta/wizard/WizardSelect'

const RANGE_OPTIONS = [
  { value: 7, label: '7 gün' },
  { value: 14, label: '14 gün' },
  { value: 30, label: '30 gün' },
]

function formatCurrency(val: number): string {
  if (val === 0) return '—'
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val)
}

function formatNumber(val: number): string {
  if (val === 0) return '—'
  return new Intl.NumberFormat('tr-TR').format(val)
}

export default function KPIBar() {
  const [range, setRange] = useState(7)
  const [kpi, setKpi] = useState<KPIData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchKPI = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/strategy/metrics?range=${range}`)
      if (!res.ok) { setKpi(null); return }
      const json = await res.json()
      if (json.ok) setKpi(json.kpi)
    } catch {
      setKpi(null)
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => { fetchKPI() }, [fetchKPI])

  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label ?? `${range} gün`
  const cards = [
    { label: 'Aylık Bütçe', value: formatCurrency(kpi?.total_budget ?? 0), icon: Wallet, color: 'text-blue-600' },
    { label: 'Kalan (Bu Ay)', value: formatCurrency(kpi?.remaining_budget ?? 0), icon: PiggyBank, color: 'text-emerald-600' },
    { label: `Harcanan (${rangeLabel})`, value: formatCurrency(kpi?.spend ?? 0), icon: DollarSign, color: 'text-primary', hasFilter: true },
    { label: `Tıklama (${rangeLabel})`, value: formatNumber(kpi?.clicks ?? 0), icon: MousePointerClick, color: 'text-primary', hasFilter: true },
    { label: `ROAS (${rangeLabel})`, value: kpi?.roas ? `${kpi.roas}x` : '—', icon: TrendingUp, color: 'text-emerald-600' },
  ]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500">Genel Bakış</h3>
        <WizardSelect
          value={String(range)}
          onChange={(v) => setRange(Number(v))}
          options={RANGE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
          className="w-28"
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1"
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${card.color}`} />
                <span className="text-caption text-gray-600">{card.label}</span>
              </div>
              {loading ? (
                <div className="h-6 bg-gray-100 rounded animate-pulse w-20 mt-1" />
              ) : (
                <span className="text-lg font-semibold text-gray-900">{card.value}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
