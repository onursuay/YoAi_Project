'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { X, Zap, CheckCircle, Loader2, AlertCircle, AlertTriangle } from 'lucide-react'
import ConfidenceGauge from './ConfidenceGauge'
import EvidenceChart from './EvidenceChart'
import RiskBadge from './RiskBadge'
import type { Recommendation } from '@/lib/meta/optimization/types'

interface DetailPanelProps {
  rec: Recommendation
  currency: string
  isApplying: boolean
  isApplied: boolean
  errorMessage?: string
  onClose: () => void
  onApplySingle?: (rec: Recommendation) => void
}

const GLOW_COLOR = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#EF4444',
}

export default function DetailPanel({
  rec,
  currency,
  isApplying,
  isApplied,
  errorMessage,
  onClose,
  onApplySingle,
}: DetailPanelProps) {
  const t = useTranslations('dashboard.optimizasyon.magicScan')
  const hasChangeSet = !!rec.changeSet
  const glowColor = GLOW_COLOR[rec.risk]

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Centered Popup */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        {/* Glow border wrapper */}
        <div
          className="relative rounded-3xl p-[2px] animate-popup-scale pointer-events-auto animate-glow-border"
          style={{ '--glow-color': glowColor } as React.CSSProperties}
        >
          {/* Rotating glow border */}
          <div className="absolute inset-0 rounded-3xl overflow-hidden">
            <div
              className="absolute inset-[-50%] animate-glow-spin"
              style={{
                background: `conic-gradient(from 0deg, transparent, ${glowColor}, transparent, transparent, ${glowColor}40, transparent)`,
              }}
            />
          </div>

          {/* Inner content */}
          <div className="relative bg-white rounded-[22px] w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-start gap-3 p-5 border-b border-gray-100">
              <ConfidenceGauge confidence={rec.confidence} size={48} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 leading-tight">{rec.title}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">
                    {t(`problemTags.${rec.problemTag}`)}
                  </span>
                  <RiskBadge risk={rec.risk} />
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Root Cause */}
              <section>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{t('rootCause')}</p>
                <p className="text-sm text-gray-700 leading-relaxed">{rec.rootCause}</p>
              </section>

              {/* Evidence Chart */}
              {rec.evidence.length > 0 && (
                <section>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('evidence')}</p>
                  <EvidenceChart evidence={rec.evidence} currency={currency} />
                </section>
              )}

              {/* Action */}
              <section>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{t('action')}</p>
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                  <p className="text-sm text-blue-800 leading-relaxed">{rec.action}</p>
                </div>
              </section>

              {/* Expected Impact */}
              <section>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{t('expectedImpact')}</p>
                <p className="text-sm text-gray-700 leading-relaxed">{rec.expectedImpact}</p>
              </section>

              {/* ChangeSet detail */}
              {hasChangeSet && !isApplied && rec.changeSet && (
                <section>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{t('changeDetail')}</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    {rec.changeSet.changeType === 'duplicate_adset' ? (
                      <p className="text-sm text-gray-700">{rec.changeSet.entityName} → {t('willBeCopied')}</p>
                    ) : rec.changeSet.changeType === 'status' ? (
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="font-medium text-gray-900">{rec.changeSet.entityName}</span>
                        <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs font-mono">{String(rec.changeSet.oldValue)}</span>
                        <span className="text-gray-400">→</span>
                        <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-xs font-mono">{String(rec.changeSet.newValue)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="font-medium text-gray-900">{rec.changeSet.entityName}</span>
                        <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs font-mono">{Number(rec.changeSet.oldValue).toLocaleString()} {currency}</span>
                        <span className="text-gray-400">→</span>
                        <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-xs font-mono">{Number(rec.changeSet.newValue).toLocaleString()} {currency}</span>
                      </div>
                    )}
                  </div>

                  {/* Risk warning */}
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-2">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{t(`riskLevels.${rec.risk}`)} {t('risk').toLowerCase()}</span>
                  </div>
                </section>
              )}

              {/* Error */}
              {errorMessage && !isApplied && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="text-xs">{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Bottom Action Bar */}
            <div className="border-t border-gray-100 p-4">
              {isApplied ? (
                <div className="flex items-center justify-center gap-2 py-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('applied')}</span>
                </div>
              ) : isApplying ? (
                <div className="flex items-center justify-center gap-2 py-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">{t('applying')}</span>
                </div>
              ) : (
                <button
                  onClick={() => onApplySingle?.(rec)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-500 rounded-xl hover:from-green-700 hover:to-green-600 transition shadow-sm"
                >
                  <Zap className="w-4 h-4" />
                  {hasChangeSet ? t('applyNow') : t('markDone')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
