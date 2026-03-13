'use client'

import { useTranslations } from 'next-intl'
import type { NormalizedInsights } from '@/lib/meta/optimization/types'

interface FunnelChartProps {
  insights: NormalizedInsights
}

interface FunnelStage {
  key: string
  actionType: string
  color: string
}

const STAGES: FunnelStage[] = [
  { key: 'viewContent', actionType: 'offsite_conversion.fb_pixel_view_content', color: '#3B82F6' },
  { key: 'addToCart', actionType: 'offsite_conversion.fb_pixel_add_to_cart', color: '#8B5CF6' },
  { key: 'initiateCheckout', actionType: 'offsite_conversion.fb_pixel_initiate_checkout', color: '#F59E0B' },
  { key: 'purchase', actionType: 'offsite_conversion.fb_pixel_purchase', color: '#10B981' },
]

export default function FunnelChart({ insights }: FunnelChartProps) {
  const t = useTranslations('dashboard.optimizasyon.funnel')

  const values = STAGES.map(s => insights.actions[s.actionType] ?? 0)
  const maxValue = Math.max(...values, 1)
  const hasData = values.some(v => v > 0)

  if (!hasData) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        {t('title')} — No data
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700">{t('title')}</h4>
      <div className="space-y-2">
        {STAGES.map((stage, i) => {
          const value = values[i]
          const widthPercent = maxValue > 0 ? Math.max((value / maxValue) * 100, 4) : 4
          const prevValue = i > 0 ? values[i - 1] : 0
          const dropOff = prevValue > 0 ? (((prevValue - value) / prevValue) * 100).toFixed(1) : null

          return (
            <div key={stage.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-caption font-medium text-gray-600">{t(stage.key)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-caption font-semibold text-gray-900">{value.toLocaleString('tr-TR')}</span>
                  {dropOff && (
                    <span className="text-caption text-red-500">-{dropOff}%</span>
                  )}
                </div>
              </div>
              <div className="h-6 bg-gray-100 rounded-md overflow-hidden">
                <div
                  className="h-full rounded-md transition-all duration-500"
                  style={{ width: `${widthPercent}%`, backgroundColor: stage.color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
