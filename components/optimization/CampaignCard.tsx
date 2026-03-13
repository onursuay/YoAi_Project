'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Loader2, Sparkles, Zap } from 'lucide-react'
import ScoreBadge from './ScoreBadge'
import ScanOverlay from './ScanOverlay'
import type { OptimizationCampaign } from '@/lib/meta/optimization/types'
import { resolveMetricValue } from '@/lib/meta/optimization/kpiRegistry'

interface CampaignCardProps {
  campaign: OptimizationCampaign
  expanded: boolean
  onToggle: () => void
  onMagicScan?: (useAI: boolean) => void
  scanning?: boolean
  scanPhase?: number
}

function formatMetric(value: number, format: string, currency: string): string {
  if (format === 'currency') {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  }
  if (format === 'percentage') return `${value.toFixed(2)}%`
  if (format === 'ratio') return value.toFixed(2)
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return value.toLocaleString('tr-TR')
}

/** Safe translation helper — returns translated label or humanized fallback */
function safeT(t: ReturnType<typeof useTranslations>, key: string, rawEnum: string): string {
  try {
    const result = t(key)
    if (result.includes('.') && result.includes('dashboard.')) {
      const humanized = rawEnum.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      return humanized
    }
    return result
  } catch {
    const humanized = rawEnum.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    return humanized
  }
}

export default function CampaignCard({ campaign, expanded, onToggle, onMagicScan, scanning, scanPhase = 0 }: CampaignCardProps) {
  const t = useTranslations('dashboard.optimizasyon')
  const { scoreResult, kpiTemplate, insights, triple } = campaign

  const [showScanMenu, setShowScanMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showScanMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowScanMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showScanMenu])

  const northStarValue = resolveMetricValue(kpiTemplate.northStar, insights)
  const northStarLabel = kpiTemplate.northStar.labelKey.split('.').pop() || ''

  const firstEfficiency = kpiTemplate.efficiency[0]
  const efficiencyValue = firstEfficiency ? resolveMetricValue(firstEfficiency, insights) : 0
  const efficiencyLabel = firstEfficiency?.labelKey.split('.').pop() || ''

  const isActive = campaign.effectiveStatus === 'ACTIVE'
  const scanDisabled = scanning || scoreResult.status === 'insufficient_data'

  const handleScan = (useAI: boolean) => {
    setShowScanMenu(false)
    onMagicScan?.(useAI)
  }

  return (
    <div className="relative bg-white rounded-2xl border border-gray-200 transition-shadow hover:shadow-md">
      {scanning && <ScanOverlay phase={scanPhase} />}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 text-left"
      >
        {/* Score Badge */}
        <ScoreBadge score={scoreResult.score} status={scoreResult.status} />

        {/* Campaign Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{campaign.name}</h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 text-caption font-medium rounded-full ${
                isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {safeT(t, `status.${campaign.effectiveStatus}`, campaign.effectiveStatus)}
            </span>
          </div>

          {/* Triple badges */}
          <div className="flex items-center gap-1.5 mt-1">
            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 rounded">
              {safeT(t, `objectives.${triple.objective}`, triple.objective.replace(/_/g, ' '))}
            </span>
            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-600 rounded">
              {safeT(t, `optimizationGoals.${triple.optimizationGoal}`, triple.optimizationGoal)}
            </span>
            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded">
              {safeT(t, `destinations.${triple.destination}`, triple.destination.replace(/_/g, ' '))}
            </span>
          </div>
        </div>

        {/* Quick KPI preview */}
        <div className="hidden sm:flex items-center gap-6 shrink-0">
          <div className="text-right">
            <p className="text-caption text-gray-500">{t(`metrics.${northStarLabel}`)}</p>
            <p className="text-sm font-bold text-gray-900">
              {formatMetric(northStarValue, kpiTemplate.northStar.format, campaign.currency)}
            </p>
          </div>
          {firstEfficiency && (
            <div className="text-right">
              <p className="text-caption text-gray-500">{t(`metrics.${efficiencyLabel}`)}</p>
              <p className="text-sm font-bold text-gray-900">
                {formatMetric(efficiencyValue, firstEfficiency.format, campaign.currency)}
              </p>
            </div>
          )}
          <div className="text-right">
            <p className="text-caption text-gray-500">{t('metrics.spend')}</p>
            <p className="text-sm font-bold text-gray-900">
              {formatMetric(insights.spend, 'currency', campaign.currency)}
            </p>
          </div>
        </div>

        {/* Alert count */}
        {scoreResult.alerts.length > 0 && (
          <span className="flex items-center justify-center w-5 h-5 text-caption font-bold text-white bg-red-500 rounded-full shrink-0">
            {scoreResult.alerts.length}
          </span>
        )}

        {/* Magic Scan button with dropdown */}
        {onMagicScan && (
          <div ref={menuRef} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => !scanDisabled && setShowScanMenu(!showScanMenu)}
              disabled={scanDisabled}
              className="flex items-center gap-1 px-2.5 py-1 text-caption font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition disabled:opacity-50"
              title={t('magicScan.button')}
            >
              {scanning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span className="text-sm leading-none">{'\u{1FA84}'}</span>
              )}
              <span className="hidden sm:inline">{t('magicScan.button')}</span>
              {!scanning && <ChevronDown className="w-3 h-3 ml-0.5" />}
            </button>

            {/* Dropdown menu */}
            {showScanMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-30">
                <button
                  onClick={() => handleScan(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition"
                >
                  <Zap className="w-4 h-4 text-green-600 shrink-0" />
                  <div>
                    <p className="text-caption font-medium text-gray-900">{t('magicScan.quickScan')}</p>
                    <p className="text-[10px] text-gray-400">{t('magicScan.quickScanDesc')}</p>
                  </div>
                </button>
                <button
                  onClick={() => handleScan(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-purple-50 transition"
                >
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                    <p className="text-caption font-medium text-gray-900">
                      {t('magicScan.aiScan')}
                      <span className="ml-1 px-1 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-700 rounded">PRO</span>
                    </p>
                    <p className="text-caption text-gray-400">{t('magicScan.aiScanDesc')}</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Expand chevron */}
        <ChevronDown
          className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
    </div>
  )
}
