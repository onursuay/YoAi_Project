'use client'

import MiniChart from '@/components/MiniChart'

const PLACEHOLDER_CHART: number[] = [0, 0]

export interface DashboardKpiCardProps {
  /** KPI label (e.g. "Harcanan tutar") */
  label: string
  /** Period label (e.g. "Son 30 Gün" or "02 - 08/Mar") */
  periodLabel: string
  /** Display value (e.g. "₺2.106,7" or "—") */
  value: string
  /** Delta display: "—" for empty, or "↗ %14,7" / "↘ -%27,6" */
  deltaDisplay: string
  /** Chart data; use [0, 0] or 2+ points for placeholder */
  chartData: number[]
  /** Chart color; use "gray" for empty/placeholder */
  chartColor: 'red' | 'green' | 'gray'
  /** When true, force empty state: value "—", delta "—", placeholder sparkline */
  empty?: boolean
  /** Date labels per chart data point (YYYY-MM-DD) for hover tooltip */
  chartLabels?: string[]
  /** Pre-formatted tooltip values per chart data point */
  chartTooltipValues?: string[]
  /** Locale for tooltip date formatting */
  locale?: string
}

export default function DashboardKpiCard({ label, periodLabel, value, deltaDisplay, chartData, chartColor, empty, chartLabels, chartTooltipValues, locale }: DashboardKpiCardProps) {
  const displayValue = empty ? '—' : value
  const displayDelta = empty ? '—' : deltaDisplay
  const displayChartData = empty ? PLACEHOLDER_CHART : (chartData.length >= 2 ? chartData : PLACEHOLDER_CHART)
  const displayColor = empty ? 'gray' as const : chartColor

  const deltaColorClass = displayColor === 'gray'
    ? 'text-gray-400'
    : displayColor === 'green'
      ? 'text-green-500'
      : 'text-red-500'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden relative">
      {/* Header: label left, date right */}
      <div className="flex items-start justify-between px-5 pt-4 pb-0">
        <span className="text-[13px] font-medium text-gray-500 leading-tight">{label}</span>
        <span className="text-[11px] text-gray-400 whitespace-nowrap ml-2">{periodLabel}</span>
      </div>

      {/* Delta + Value */}
      <div className="px-5 pt-2 pb-1 relative z-10">
        {displayDelta && (
          <span className={`text-[11px] font-medium ${deltaColorClass} block mb-0.5`}>
            {displayDelta}
          </span>
        )}
        <span className="kpiValue leading-none block">{displayValue}</span>
      </div>

      {/* Area chart — spans full width, grounded at bottom */}
      <div className="w-full h-[64px] mt-0">
        <MiniChart
          data={displayChartData}
          color={displayColor}
          labels={empty ? undefined : chartLabels}
          tooltipValues={empty ? undefined : chartTooltipValues}
          locale={locale}
        />
      </div>
    </div>
  )
}
