'use client'

import { useTranslations } from 'next-intl'
import type { MetricEvidence } from '@/lib/meta/optimization/types'

interface EvidenceChartProps {
  evidence: MetricEvidence[]
  currency?: string
}

function formatValue(value: number, format: string, currency: string): string {
  if (format === 'currency') {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  }
  if (format === 'percentage') return `${value.toFixed(2)}%`
  if (format === 'ratio') return value.toFixed(2)
  return value.toLocaleString('tr-TR')
}

export default function EvidenceChart({ evidence, currency = 'TRY' }: EvidenceChartProps) {
  const t = useTranslations('dashboard.optimizasyon.magicScan')

  if (evidence.length === 0) return null

  return (
    <div className="space-y-2">
      {evidence.map((e, i) => {
        const maxVal = e.benchmark ? Math.max(e.value, e.benchmark) * 1.2 : e.value * 1.2
        const barPercent = maxVal > 0 ? Math.min((e.value / maxVal) * 100, 100) : 0
        const barColor = e.direction === 'above' ? 'bg-red-400' : e.direction === 'below' ? 'bg-amber-400' : 'bg-green-400'

        // Translate metric name — fallback to raw key if no translation
        const metricLabel = t.has(`metricLabels.${e.metric}`) ? t(`metricLabels.${e.metric}`) : e.metric

        return (
          <div key={i}>
            {/* Label + value row */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400 font-medium">{metricLabel}</span>
              <span className="text-[11px] text-gray-800 font-semibold">{formatValue(e.value, e.format, currency)}</span>
            </div>
            {/* Bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor} transition-all duration-700 ease-out`}
                style={{ width: `${Math.max(barPercent, 3)}%` }}
              />
            </div>
            {/* Benchmark label */}
            {e.benchmark !== null && e.benchmark !== undefined && (
              <p className={`text-[9px] mt-0.5 ${e.direction === 'above' ? 'text-red-400' : 'text-gray-400'}`}>
                Ref: {formatValue(e.benchmark, e.format, currency)}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
