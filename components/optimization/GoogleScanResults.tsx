'use client'

/* Google Ads Optimizasyon — tarama sonuçları + tek-tık canlı apply (Faz 2).
   changeSet taşıyan öneriler (kampanya duraklatma / bütçe değişimi) açık
   onayla canlıya uygulanır; uygulanınca "Geri Al" ile rollback edilir.
   changeSet'siz öneriler advisory kalır. Renk paleti proje kuralına uyar. */

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { X, Sparkles, Zap, Loader2, Check, Undo2 } from 'lucide-react'
import type { MagicScanResult, Recommendation } from '@/lib/meta/optimization/types'

interface Props {
  result: MagicScanResult
  onClose: () => void
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
  /** Canlı apply endpoint'i (platforma göre). Verilmezse öneriler advisory kalır (apply butonu yok). */
  applyEndpoint?: string
  /** Aktif/seçili reklam hesabı (Google müşteri kimliği) — hesap-scope persist için. */
  accountId?: string | null
  /** Platform etiketi (google | tiktok) — outcome kaydında by_account kırılımı için. */
  platform?: string
}

function fmtBudget(v: number): string {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(v)
}

export default function GoogleScanResults({ result, onClose, onSuccess, onError, applyEndpoint, accountId, platform }: Props) {
  const t = useTranslations('dashboard.optimizasyon.magicScan')
  const tg = useTranslations('dashboard.optimizasyon.googleScan')
  const recs = result.recommendations ?? []

  const riskLabel = (risk: Recommendation['risk']): string =>
    `${t(`riskLevels.${risk}`)} ${t('risk').toLowerCase()}`

  function changeLabel(rec: Recommendation): string | null {
    const cs = rec.changeSet
    if (!cs) return null
    if (cs.changeType === 'status') return cs.newValue === 'PAUSED' ? tg('pauseCampaign') : tg('resumeCampaign')
    if (cs.changeType === 'budget') return tg('dailyBudgetChange', { from: fmtBudget(Number(cs.oldValue)), to: fmtBudget(Number(cs.newValue)) })
    return null
  }
  const [busyId, setBusyId] = useState<string | null>(null)
  const [applied, setApplied] = useState<Record<string, boolean>>({})
  const persistedRef = useRef<number | null>(null)

  // ── Tarama sonucunu DB'ye kaydet (fire-and-forget; bloklamaz) ──────────
  // Meta tarafıyla (MagicScanResults) aynı kalıp; hesap-scope için accountId + platform taşır.
  useEffect(() => {
    if (!result?.timestamp || persistedRef.current === result.timestamp) return
    persistedRef.current = result.timestamp
    void fetch('/api/yoai/optimization/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: result.campaignId,
        campaignName: result.campaignName,
        accountId: accountId ?? undefined,
        platform: platform ?? 'google',
        currency: result.currency,
        timestamp: result.timestamp,
        problemTags: result.problemTags,
        recommendations: result.recommendations,
        aiGenerated: result.aiGenerated,
        aiRequested: result.aiRequested ?? false,
        aiFallbackUsed: result.aiFallbackUsed ?? false,
      }),
    }).catch(() => {
      // Kayıt bloklamaz; hatalar sunucu tarafında loglanır.
    })
  }, [result, accountId, platform])

  async function callApply(rec: Recommendation, newValue: string | number): Promise<boolean> {
    const cs = rec.changeSet
    if (!cs || !applyEndpoint) return false
    const res = await fetch(applyEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: result.campaignId, changeType: cs.changeType, newValue }),
    })
    const data = await res.json().catch(() => ({}))
    return res.ok && data.ok
  }

  async function apply(rec: Recommendation) {
    if (!rec.changeSet) return
    setBusyId(rec.id)
    try {
      const ok = await callApply(rec, rec.changeSet.newValue)
      if (ok) {
        setApplied((p) => ({ ...p, [rec.id]: true }))
        onSuccess?.(tg('appliedToGoogle'))
      } else {
        onError?.(tg('applyFailed'))
      }
    } catch {
      onError?.(tg('applyFailed'))
    } finally {
      setBusyId(null)
    }
  }

  async function rollback(rec: Recommendation) {
    if (!rec.changeSet) return
    setBusyId(rec.id)
    try {
      const ok = await callApply(rec, rec.changeSet.oldValue)
      if (ok) {
        setApplied((p) => ({ ...p, [rec.id]: false }))
        onSuccess?.(tg('changeRolledBack'))
      } else {
        onError?.(tg('rollbackFailed'))
      }
    } catch {
      onError?.(tg('rollbackFailed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mt-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {result.aiGenerated ? <Zap className="w-4 h-4 text-primary" /> : <Sparkles className="w-4 h-4 text-gray-500" />}
          <p className="text-sm font-semibold text-gray-800">
            {result.aiGenerated ? tg('aiRecommendations') : tg('recommendations')}
            <span className="text-gray-400 font-normal"> · {recs.length}</span>
          </p>
          {result.aiFallbackUsed && (
            <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{tg('fallbackEngine')}</span>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label={t('close')}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {recs.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-emerald-700">{tg('noRecommendations')}</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {recs.map((r) => {
            const action = changeLabel(r)
            const isApplied = applied[r.id]
            const busy = busyId === r.id
            return (
              <div key={r.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-900">{r.title}</p>
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    r.risk === 'high' ? 'bg-red-50 text-red-700' : r.risk === 'medium' ? 'bg-primary/5 text-primary' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {riskLabel(r.risk)}
                  </span>
                </div>
                {r.rootCause && <p className="text-xs text-gray-500 mt-1">{r.rootCause}</p>}
                <p className="text-sm text-gray-700 mt-1.5"><span className="font-medium text-gray-900">{t('action')}:</span> {r.action}</p>
                {r.expectedImpact && <p className="text-xs text-emerald-700 mt-1">{t('expectedImpact')}: {r.expectedImpact}</p>}

                {/* Tek-tık canlı apply (yalnız changeSet'li öneriler + apply endpoint varsa) */}
                {action && applyEndpoint && (
                  <div className="mt-2.5 flex items-center gap-2">
                    {!isApplied ? (
                      <button
                        onClick={() => apply(r)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {action}
                      </button>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                          <Check className="w-3.5 h-3.5" /> {t('applied')}
                        </span>
                        <button
                          onClick={() => rollback(r)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                          {t('rollback')}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
