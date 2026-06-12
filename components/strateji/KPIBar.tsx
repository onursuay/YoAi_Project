'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { DollarSign, MousePointerClick, TrendingUp, Wallet, PiggyBank } from 'lucide-react'
import type { KPIData } from '@/lib/strategy/types'
import WizardSelect from '@/components/meta/wizard/WizardSelect'

const RANGE_VALUES = [7, 14, 30]

function formatCurrency(val: number, locale: string): string {
  if (val === 0) return '—'
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val)
}

function formatNumber(val: number, locale: string): string {
  if (val === 0) return '—'
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'tr-TR').format(val)
}

export default function KPIBar() {
  const t = useTranslations('dashboard.strateji.kpi')
  const locale = useLocale()
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

  const rangeLabel = t('days', { count: range })
  const cards = [
    { label: t('monthlyBudget'), value: formatCurrency(kpi?.total_budget ?? 0, locale), icon: Wallet, color: 'text-blue-600' },
    { label: t('remaining'), value: formatCurrency(kpi?.remaining_budget ?? 0, locale), icon: PiggyBank, color: 'text-emerald-600' },
    { label: t('spent', { range: rangeLabel }), value: formatCurrency(kpi?.spend ?? 0, locale), icon: DollarSign, color: 'text-primary', hasFilter: true },
    { label: t('clicks', { range: rangeLabel }), value: formatNumber(kpi?.clicks ?? 0, locale), icon: MousePointerClick, color: 'text-primary', hasFilter: true },
    { label: t('roas', { range: rangeLabel }), value: kpi?.roas ? `${kpi.roas}x` : '—', icon: TrendingUp, color: 'text-emerald-600' },
  ]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500">{t('overview')}</h3>
        <WizardSelect
          value={String(range)}
          onChange={(v) => setRange(Number(v))}
          options={RANGE_VALUES.map((v) => ({ value: String(v), label: t('days', { count: v }) }))}
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
