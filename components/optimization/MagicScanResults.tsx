'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, X, AlertTriangle, CheckCircle } from 'lucide-react'
import ScanHeroBanner from './scan/ScanHeroBanner'
import CategoryFilterPills from './scan/CategoryFilterPills'
import RecommendationCard from './scan/RecommendationCard'
import DetailPanel from './scan/DetailPanel'
import AuditTimeline from './scan/AuditTimeline'
import type { MagicScanResult, Recommendation, ChangeSet } from '@/lib/meta/optimization/types'
import { executeChangeSet, rollbackChangeSet } from '@/lib/meta/optimization/changeSetManager'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface MagicScanResultsProps {
  result: MagicScanResult
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
  onClose: () => void
}

const RISK_COLORS = {
  low: 'bg-green-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export default function MagicScanResults({ result, onSuccess, onError, onClose }: MagicScanResultsProps) {
  const t = useTranslations('dashboard.optimizasyon.magicScan')

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailRec, setDetailRec] = useState<Recommendation | null>(null)
  const [applying, setApplying] = useState(false)
  const [auditLog, setAuditLog] = useState<ChangeSet[]>([])
  const [showDiff, setShowDiff] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set())
  const [errorMap, setErrorMap] = useState<Map<string, string>>(new Map())
  const [confirmRec, setConfirmRec] = useState<Recommendation | null>(null)

  // Group recommendations by category
  const grouped = useMemo(() => {
    const groups: Record<string, Recommendation[]> = {
      AUTO_APPLY_SAFE: [],
      REVIEW_REQUIRED: [],
      TASK: [],
    }
    for (const rec of result.recommendations) {
      groups[rec.category]?.push(rec)
    }
    return groups
  }, [result.recommendations])

  // Category counts for filter pills
  const counts = useMemo(() => ({
    AUTO_APPLY_SAFE: grouped.AUTO_APPLY_SAFE.length,
    REVIEW_REQUIRED: grouped.REVIEW_REQUIRED.length,
    TASK: grouped.TASK.length,
  }), [grouped])

  // Filtered recommendations
  const filteredRecs = useMemo(() => {
    if (!activeFilter) return result.recommendations
    return result.recommendations.filter(r => r.category === activeFilter)
  }, [result.recommendations, activeFilter])

  // Selected recommendations that have changeSets
  const selectedRecs = useMemo(() =>
    result.recommendations.filter(r => selected.has(r.id) && r.changeSet),
    [result.recommendations, selected],
  )

  // ── Handlers ─────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openDetail = (rec: Recommendation) => setDetailRec(rec)
  const closeDetail = () => setDetailRec(null)

  const handleApply = async () => {
    if (selectedRecs.length === 0) return
    setApplying(true)

    const results: ChangeSet[] = []

    for (const rec of selectedRecs) {
      if (!rec.changeSet) continue

      // Per-card loading indicator
      setApplyingIds(prev => new Set(prev).add(rec.id))

      const cs = { ...rec.changeSet }
      const res = await executeChangeSet(cs)
      cs.status = res.ok ? 'applied' : 'failed'
      results.push(cs)

      if (res.ok) {
        setAppliedIds(prev => new Set(prev).add(rec.id))
      } else {
        const errMsg = res.error || t('failed')
        setErrorMap(prev => new Map(prev).set(rec.id, errMsg))
        onError?.(errMsg)
      }

      // Clear per-card loading
      setApplyingIds(prev => { const s = new Set(prev); s.delete(rec.id); return s })
    }

    setAuditLog(prev => [...prev, ...results])
    setSelected(new Set())
    setShowDiff(false)
    setApplying(false)

    const successCount = results.filter(r => r.status === 'applied').length
    if (successCount > 0) {
      onSuccess?.(t('applied'))
    }
  }

  const handleRollback = async (cs: ChangeSet) => {
    const res = await rollbackChangeSet(cs)
    if (res.ok) {
      setAuditLog(prev => prev.map(item =>
        item.id === cs.id ? { ...item, status: 'rolled_back' as const } : item,
      ))
      onSuccess?.(t('rolledBack'))
    } else {
      onError?.(res.error || t('failed'))
    }
  }

  // ── Single Apply (one-click per card) ─────────────────────────────────
  const handleApplySingle = async (rec: Recommendation) => {
    // If no changeSet, just mark as acknowledged/done
    if (!rec.changeSet) {
      setAppliedIds(prev => new Set(prev).add(rec.id))
      onSuccess?.(t('applied'))
      return
    }

    // Show confirmation dialog for API changes
    setConfirmRec(rec)
  }

  const executeApplySingle = async (rec: Recommendation) => {
    if (!rec.changeSet) return
    setConfirmRec(null)

    // Set per-card loading state
    setApplyingIds(prev => new Set(prev).add(rec.id))
    // Clear previous error
    setErrorMap(prev => { const m = new Map(prev); m.delete(rec.id); return m })

    const cs = { ...rec.changeSet }
    const res = await executeChangeSet(cs)
    cs.status = res.ok ? 'applied' : 'failed'
    setAuditLog(prev => [...prev, cs])

    if (res.ok) {
      setAppliedIds(prev => new Set(prev).add(rec.id))
      onSuccess?.(t('applied'))
    } else {
      const errMsg = res.error || t('failed')
      setErrorMap(prev => new Map(prev).set(rec.id, errMsg))
      onError?.(errMsg)
    }

    // Clear loading state
    setApplyingIds(prev => { const s = new Set(prev); s.delete(rec.id); return s })
  }

  // ── No Issues State ──────────────────────────────────────────────────

  if (result.recommendations.length === 0) {
    return (
      <div className="border border-gray-200 border-t-0 rounded-b-2xl overflow-hidden">
        <ScanHeroBanner result={result} grouped={grouped} onClose={onClose} />
        <div className="bg-white p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-50 flex items-center justify-center animate-stat-pop">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <p className="text-sm text-gray-600 font-medium">{t('noIssues')}</p>
          <button onClick={onClose} className="mt-3 text-xs text-gray-400 hover:text-gray-600 transition">
            {t('close')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 border-t-0 rounded-b-2xl overflow-hidden">
      {/* Dark Gradient Hero */}
      <ScanHeroBanner result={result} grouped={grouped} onClose={onClose} />

      {/* Category Filter Pills */}
      <CategoryFilterPills
        counts={counts}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {/* Card Grid */}
      <div className="bg-gradient-to-b from-gray-50 to-white p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRecs.map((rec, i) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              index={i}
              currency={result.currency}
              isApplying={applyingIds.has(rec.id)}
              errorMessage={errorMap.get(rec.id)}
              onOpenDetail={openDetail}
              onApplySingle={handleApplySingle}
              appliedIds={appliedIds}
            />
          ))}
        </div>
      </div>

      {/* Audit Timeline */}
      <AuditTimeline items={auditLog} onRollback={handleRollback} />

      {/* Sticky Bottom Bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 bg-white/90 backdrop-blur-md border-t border-gray-200 px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">
            {t('selected', { count: selectedRecs.length })}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDiff(true)}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              {t('reviewChanges')}
            </button>
            <button
              onClick={handleApply}
              disabled={applying}
              className="px-4 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-green-600 to-green-500 rounded-lg hover:from-green-700 hover:to-green-600 disabled:opacity-50 flex items-center gap-1.5 transition shadow-sm"
            >
              {applying && <Loader2 className="w-3 h-3 animate-spin" />}
              {t('applySelected')}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmRec && (
        <ConfirmDialog
          rec={confirmRec}
          currency={result.currency}
          onConfirm={() => executeApplySingle(confirmRec)}
          onCancel={() => setConfirmRec(null)}
          t={t}
        />
      )}

      {/* Diff Panel (dark theme modal) */}
      {showDiff && (
        <DiffPanel
          recommendations={selectedRecs}
          applying={applying}
          onApply={handleApply}
          onCancel={() => setShowDiff(false)}
          t={t}
          currency={result.currency}
        />
      )}

      {/* Detail Panel (slide-in from right) */}
      {detailRec && (
        <DetailPanel
          rec={detailRec}
          currency={result.currency}
          isApplying={applyingIds.has(detailRec.id)}
          isApplied={appliedIds.has(detailRec.id)}
          errorMessage={errorMap.get(detailRec.id)}
          onClose={closeDetail}
          onApplySingle={handleApplySingle}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DiffPanel — Dark Theme Modal
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// ConfirmDialog — Single Change Confirmation
// ═══════════════════════════════════════════════════════════════════════════

function ConfirmDialog({
  rec,
  currency,
  onConfirm,
  onCancel,
  t,
}: {
  rec: Recommendation
  currency: string
  onConfirm: () => void
  onCancel: () => void
  t: ReturnType<typeof useTranslations>
}) {
  const cs = rec.changeSet!
  const isBudget = cs.changeType === 'budget'
  const isDuplicate = cs.changeType === 'duplicate_adset'

  const formatVal = (val: string | number) =>
    isBudget ? `${Number(val).toLocaleString()} ${currency}` : String(val)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-gray-200 mx-4">
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2.5 h-2.5 rounded-full ${RISK_COLORS[rec.risk]}`} />
            <h4 className="text-sm font-bold text-gray-900">{t('confirmTitle')}</h4>
          </div>
          <p className="text-xs text-gray-600 mb-4">{t('confirmDesc')}</p>

          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 mb-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{cs.entityName}</p>
            {isDuplicate ? (
              <p className="text-xs text-blue-700 font-medium">{t('willBeCopied')}</p>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded font-mono">{formatVal(cs.oldValue)}</span>
                <span className="text-gray-400">→</span>
                <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded font-mono">{formatVal(cs.newValue)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-4">
            <AlertTriangle className="w-3 h-3" />
            <span>{t(`riskLevels.${rec.risk}`)} {t('risk').toLowerCase()} — {t('confirmWarning')}</span>
          </div>
        </div>

        <div className="border-t border-gray-200 px-5 py-3 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            {t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-green-600 to-green-500 rounded-lg hover:from-green-700 hover:to-green-600 transition shadow-sm"
          >
            {t('confirmApply')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DiffPanel — Dark Theme Modal
// ═══════════════════════════════════════════════════════════════════════════

function DiffPanel({
  recommendations,
  applying,
  onApply,
  onCancel,
  t,
  currency,
}: {
  recommendations: Recommendation[]
  applying: boolean
  onApply: () => void
  onCancel: () => void
  t: ReturnType<typeof useTranslations>
  currency: string
}) {
  const formatVal = (val: string | number, isBudget: boolean) =>
    isBudget ? `${Number(val).toLocaleString()} ${currency}` : String(val)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[80vh] overflow-auto shadow-2xl border border-gray-700/50">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700/50 px-5 py-4 flex items-center justify-between">
          <h4 className="text-sm font-bold text-white">{t('diffTitle')}</h4>
          <button onClick={onCancel} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Change list */}
        <div className="p-5 space-y-3">
          {recommendations.map(rec => {
            const cs = rec.changeSet!
            const isBudget = cs.changeType === 'budget'
            return (
              <div key={rec.id} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/40">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${RISK_COLORS[rec.risk]}`} />
                  <span className="text-xs font-semibold text-white">{cs.entityName}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-gray-700 text-gray-300 rounded-full font-medium">
                    {t(`changeTypes.${cs.changeType}`)}
                  </span>
                </div>
                {cs.changeType === 'duplicate_adset' ? (
                  <div className="text-sm text-blue-400 font-medium">
                    {cs.entityName} → {t('willBeCopied')}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 font-mono text-sm">
                    <span className="px-3 py-1 bg-red-900/30 text-red-400 rounded-lg">{formatVal(cs.oldValue, isBudget)}</span>
                    <span className="text-gray-500">→</span>
                    <span className="px-3 py-1 bg-green-900/30 text-green-400 rounded-lg">{formatVal(cs.newValue, isBudget)}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Risk summary */}
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>
              {recommendations.filter(r => r.risk === 'high').length > 0
                ? t('riskLevels.high')
                : recommendations.filter(r => r.risk === 'medium').length > 0
                  ? t('riskLevels.medium')
                  : t('riskLevels.low')
              } {t('risk').toLowerCase()}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700/50 px-5 py-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-gray-300 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 transition"
          >
            {t('cancel')}
          </button>
          <button
            onClick={onApply}
            disabled={applying}
            className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-green-600 to-green-500 rounded-lg hover:from-green-700 hover:to-green-600 disabled:opacity-50 flex items-center gap-1.5 transition shadow-sm"
          >
            {applying && <Loader2 className="w-3 h-3 animate-spin" />}
            {t('confirmApply')}
          </button>
        </div>
      </div>
    </div>
  )
}
