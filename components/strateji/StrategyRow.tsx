'use client'

import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { ChevronRight, RotateCcw, AlertTriangle, Eye, Play, Trash2 } from 'lucide-react'
import type { StrategyInstance } from '@/lib/strategy/types'
import { GOAL_TYPES } from '@/lib/strategy/constants'
import StatusBadge from './StatusBadge'
import PhaseIndicator from './PhaseIndicator'

interface StrategyRowProps {
  instance: StrategyInstance
  onRetry: (id: string) => void
  onDelete: (id: string) => void
}

export default function StrategyRow({ instance, onRetry, onDelete }: StrategyRowProps) {
  const router = useRouter()
  const locale = useLocale() as 'tr' | 'en'

  const goalLabel = GOAL_TYPES.find(g => g.value === instance.goal_type)?.label[locale] || instance.goal_type
  const subtitle = [instance.brand, goalLabel, instance.time_horizon_days ? `${instance.time_horizon_days} gün` : null]
    .filter(Boolean)
    .join(' / ')

  const canRetry = instance.status === 'FAILED' || instance.status === 'NEEDS_ACTION'
  const canContinue = ['DRAFT', 'COLLECTING'].includes(instance.status)
  const canViewPlan = ['READY_FOR_REVIEW', 'APPLYING', 'RUNNING', 'NEEDS_ACTION'].includes(instance.status)

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
      onClick={() => router.push(`/strateji/${instance.id}`)}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Sol: Bilgi */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{instance.title}</h3>
            <StatusBadge status={instance.status} size="sm" />
          </div>
          {subtitle && (
            <p className="text-sm text-gray-500 truncate">{subtitle}</p>
          )}
          {instance.monthly_budget_try && (
            <p className="text-sm text-gray-500 mt-0.5">
              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(instance.monthly_budget_try)} / ay
            </p>
          )}
        </div>

        {/* Orta: Aşama göstergesi */}
        <div className="hidden md:flex">
          <PhaseIndicator status={instance.status} />
        </div>

        {/* Sağ: Aksiyonlar */}
        <div className="flex items-center gap-2">
          {canRetry && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry(instance.id) }}
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              title="Tekrar dene"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {instance.status === 'FAILED' && instance.last_error && (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/strateji/${instance.id}?tab=jobs`) }}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Hata detayı"
            >
              <AlertTriangle className="w-4 h-4" />
            </button>
          )}
          {canViewPlan && (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/strateji/${instance.id}?tab=plan`) }}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Planı gör"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          {canContinue && (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/strateji/${instance.id}`) }}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Devam et"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          <button
              onClick={(e) => { e.stopPropagation(); onDelete(instance.id) }}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Sil"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
      </div>

      {/* Veri kalitesi barı (varsa) */}
      {instance.data_quality_score > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Veri Kalitesi</span>
            <span>{instance.data_quality_score}/100</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                instance.data_quality_score >= 70 ? 'bg-green-500' : instance.data_quality_score >= 40 ? 'bg-amber-500' : 'bg-red-400'
              }`}
              style={{ width: `${instance.data_quality_score}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
