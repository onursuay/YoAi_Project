'use client'

import { useTranslations } from 'next-intl'
import type { KpiMetricDef, NormalizedInsights } from '@/lib/meta/optimization/types'
import { resolveMetricValue } from '@/lib/meta/optimization/kpiRegistry'

interface KpiDisplayProps {
  title: string
  metrics: KpiMetricDef[]
  insights: NormalizedInsights
  currency?: string
}

function formatValue(value: number, format: KpiMetricDef['format'], currency: string): string {
  if (format === 'currency') {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  }
  if (format === 'percentage') {
    return `${value.toFixed(2)}%`
  }
  if (format === 'ratio') {
    return value.toFixed(2)
  }
  if (format === 'ranking') {
    return String(value) || '—'
  }
  // number
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return value.toLocaleString('tr-TR')
}

function formatRanking(insights: NormalizedInsights, key: string, tRankings: (k: string) => string): string {
  const val = (insights as any)[key]
  if (!val || typeof val !== 'string') return tRankings('notAvailable')
  const upper = val.toUpperCase()
  if (upper === 'UNKNOWN' || upper === '') return tRankings('notAvailable')
  if (upper.includes('ABOVE_AVERAGE')) return tRankings('ABOVE_AVERAGE')
  if (upper === 'AVERAGE') return tRankings('AVERAGE')
  if (upper.includes('BELOW_AVERAGE_10')) return tRankings('BELOW_AVERAGE_10')
  if (upper.includes('BELOW_AVERAGE_20')) return tRankings('BELOW_AVERAGE_20')
  if (upper.includes('BELOW_AVERAGE_35')) return tRankings('BELOW_AVERAGE_35')
  if (upper.includes('BELOW_AVERAGE')) return tRankings('BELOW_AVERAGE')
  return val
}

export default function KpiDisplay({ title, metrics, insights, currency = 'TRY' }: KpiDisplayProps) {
  const t = useTranslations('dashboard.optimizasyon.metrics')
  const tRankings = useTranslations('dashboard.optimizasyon.rankings')

  if (metrics.length === 0) return null

  return (
    <div>
      <h4 className="text-ui font-medium text-gray-500 uppercase tracking-wider mb-2">{title}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map((metric, i) => {
          const isRanking = metric.format === 'ranking'
          const value = isRanking ? 0 : resolveMetricValue(metric, insights)
          const display = isRanking
            ? formatRanking(insights, metric.key, tRankings)
            : formatValue(value, metric.format, currency)

          // Color ranking values
          let valueColor = 'text-gray-900'
          if (isRanking) {
            const raw = (insights as any)[metric.key] as string
            if (raw?.includes('ABOVE_AVERAGE')) valueColor = 'text-green-600'
            else if (raw === 'AVERAGE') valueColor = 'text-yellow-600'
            else if (raw?.includes('BELOW_AVERAGE')) valueColor = 'text-red-600'
            else valueColor = 'text-gray-400'
          }

          // Extract label key suffix for translation
          const labelParts = metric.labelKey.split('.')
          const labelKey = labelParts[labelParts.length - 1]

          return (
            <div key={`${metric.key}-${metric.actionType || ''}-${i}`} className="bg-gray-50 rounded-lg p-3">
              <p className="text-ui text-gray-500 truncate">{t(labelKey)}</p>
              <p className={`text-sm font-semibold mt-1 ${valueColor}`}>{display}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
