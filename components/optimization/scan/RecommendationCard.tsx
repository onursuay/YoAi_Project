'use client'

import { useTranslations } from 'next-intl'
import { Zap, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import ConfidenceGauge from './ConfidenceGauge'
import RiskBadge from './RiskBadge'
import type { Recommendation } from '@/lib/meta/optimization/types'

interface RecommendationCardProps {
  rec: Recommendation
  index: number
  currency: string
  isApplying: boolean
  errorMessage?: string
  onOpenDetail: (rec: Recommendation) => void
  onApplySingle?: (rec: Recommendation) => void
  appliedIds?: Set<string>
}

const RISK_BORDER = {
  low: 'border-l-green-500',
  medium: 'border-l-amber-500',
  high: 'border-l-red-500',
}

export default function RecommendationCard({
  rec,
  index,
  currency,
  isApplying,
  errorMessage,
  onOpenDetail,
  onApplySingle,
  appliedIds,
}: RecommendationCardProps) {
  const t = useTranslations('dashboard.optimizasyon.magicScan')
  const hasChangeSet = !!rec.changeSet
  const isApplied = appliedIds?.has(rec.id)

  return (
    <div
      className={`animate-card-enter bg-white rounded-xl border-l-4 shadow-sm transition-all duration-200
        hover:shadow-lg hover:scale-[1.01] cursor-pointer
        ${RISK_BORDER[rec.risk]}
        ${isApplied ? 'opacity-60' : 'border border-gray-200/60'}
      `}
      style={{ '--card-index': index } as React.CSSProperties}
      onClick={() => onOpenDetail(rec)}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Confidence gauge */}
          <ConfidenceGauge confidence={rec.confidence} />

          {/* Title + tags */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{rec.title}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">
                {t(`problemTags.${rec.problemTag}`)}
              </span>
              <RiskBadge risk={rec.risk} />
            </div>
          </div>
        </div>

        {/* Action button area */}
        <div className="mt-3">
          {isApplied ? (
            <div className="flex items-center gap-1.5 text-green-600">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{t('applied')}</span>
            </div>
          ) : isApplying ? (
            <div className="flex items-center gap-1.5 text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs font-medium">{t('applying')}</span>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onApplySingle?.(rec) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-green-600 to-green-500 rounded-lg hover:from-green-700 hover:to-green-600 transition shadow-sm"
            >
              <Zap className="w-3 h-3" />
              {hasChangeSet ? t('applyNow') : t('markDone')}
            </button>
          )}

          {/* Error message */}
          {errorMessage && !isApplied && (
            <div className="flex items-center gap-1.5 mt-1.5 text-red-500">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span className="text-[10px] leading-tight">{errorMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
