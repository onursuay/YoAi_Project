'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'

export interface KpiSparkCardProps {
  title: string
  periodLabel: string
  value: string
  deltaPct: number | null
  spark: number[]
  available?: boolean
  /** Tooltip when card is disabled (e.g. reach unavailable) */
  disabledTitle?: string
}

const PLACEHOLDER_POINTS = '0,40 100,40'

function normalizeSpark(arr: number[]): string {
  if (arr.length < 2) return PLACEHOLDER_POINTS
  const max = Math.max(...arr, 1)
  const w = 100
  const h = 40
  const points = arr.map((v, i) => {
    const x = (i / (arr.length - 1)) * w
    const y = max === 0 ? h : h - (v / max) * (h - 4)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return points.join(' ')
}

export default function KpiSparkCard({ title, periodLabel, value, deltaPct, spark, available = true, disabledTitle }: KpiSparkCardProps) {
  const usePlaceholder = spark.length < 2
  const points = usePlaceholder ? PLACEHOLDER_POINTS : normalizeSpark(spark)
  const hasDelta = available && deltaPct !== null
  const trend = hasDelta && deltaPct !== null ? (deltaPct >= 0 ? 'up' : 'down') : 'up'
  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown
  const deltaColor = trend === 'up' ? 'text-green-600' : 'text-red-600'
  const disabled = available === false

  return (
    <div
      title={disabled ? disabledTitle : undefined}
      className={`rounded-xl border p-5 ${
        disabled
          ? 'bg-gray-50 border-gray-100 opacity-75'
          : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>{title}</span>
        <span className="text-caption text-gray-400">{periodLabel}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className={`text-2xl font-semibold truncate ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>{value}</div>
        {hasDelta && (
          <div className={`flex items-center gap-0.5 text-sm font-medium shrink-0 ${deltaColor}`}>
            <TrendIcon className="w-4 h-4" />
            <span>{deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%</span>
          </div>
        )}
      </div>
      <div className="mt-3 h-10 flex items-end">
        <svg width="100%" height="40" className="overflow-visible" preserveAspectRatio="none">
          <polyline
            points={points}
            fill="none"
            stroke={disabled ? '#d1d5db' : trend === 'up' ? '#22c55e' : '#ef4444'}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  )
}
