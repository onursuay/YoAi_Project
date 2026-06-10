'use client'

/* Google Ads Optimizasyon — tarama sonuçları + tek-tık canlı apply (Faz 2).
   changeSet taşıyan öneriler (kampanya duraklatma / bütçe değişimi) açık
   onayla canlıya uygulanır; uygulanınca "Geri Al" ile rollback edilir.
   changeSet'siz öneriler advisory kalır. Renk paleti proje kuralına uyar. */

import { useState, useEffect, useRef } from 'react'
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

const RISK_LABEL: Record<Recommendation['risk'], string> = {
  low: 'Düşük risk',
  medium: 'Orta risk',
  high: 'Yüksek risk',
}

function fmtBudget(v: number): string {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(v)
}

function changeLabel(rec: Recommendation): string | null {
  const cs = rec.changeSet
  if (!cs) return null
  if (cs.changeType === 'status') return cs.newValue === 'PAUSED' ? 'Kampanyayı Duraklat' : 'Kampanyayı Aç'
  if (cs.changeType === 'budget') return `Günlük bütçe: ${fmtBudget(Number(cs.oldValue))}₺ → ${fmtBudget(Number(cs.newValue))}₺`
  return null
}

export default function GoogleScanResults({ result, onClose, onSuccess, onError, applyEndpoint, accountId, platform }: Props) {
  const recs = result.recommendations ?? []
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
        onSuccess?.('Değişiklik Google Ads hesabına uygulandı.')
      } else {
        onError?.('Uygulama başarısız oldu.')
      }
    } catch {
      onError?.('Uygulama başarısız oldu.')
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
        onSuccess?.('Değişiklik geri alındı.')
      } else {
        onError?.('Geri alma başarısız oldu.')
      }
    } catch {
      onError?.('Geri alma başarısız oldu.')
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
            {result.aiGenerated ? 'AI önerileri' : 'Öneriler'}
            <span className="text-gray-400 font-normal"> · {recs.length}</span>
          </p>
          {result.aiFallbackUsed && (
            <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">AI yerine kural motoru</span>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Kapat">
          <X className="w-4 h-4" />
        </button>
      </div>

      {recs.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-emerald-700">Bu kampanya için öneri üretilmedi — belirgin bir sorun yok.</p>
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
                    {RISK_LABEL[r.risk]}
                  </span>
                </div>
                {r.rootCause && <p className="text-xs text-gray-500 mt-1">{r.rootCause}</p>}
                <p className="text-sm text-gray-700 mt-1.5"><span className="font-medium text-gray-900">Aksiyon:</span> {r.action}</p>
                {r.expectedImpact && <p className="text-xs text-emerald-700 mt-1">Beklenen etki: {r.expectedImpact}</p>}

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
                          <Check className="w-3.5 h-3.5" /> Uygulandı
                        </span>
                        <button
                          onClick={() => rollback(r)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                          Geri Al
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
