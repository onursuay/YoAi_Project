'use client'

/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Diagnosis Panel

   Standalone bileşen. Mevcut kampanya insights'larını alır,
   /api/yoai/diagnose'a gönderir, root cause + önerilen
   aksiyonları listeler.

   Kullanım (parent'tan):
     <DiagnosisPanel campaigns={deepAnalysis.campaigns} />

   Bu bileşen hiçbir mevcut sayfayı / akışı otomatik değiştirmez.
   Drop-in olarak kullanılır.
   ────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react'
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { DeepCampaignInsight } from '@/lib/yoai/analysisTypes'
import type { DiagnosisResult, RootCauseId } from '@/lib/yoai/meta/diagnosis'
import type { Decision, DecisionActionType } from '@/lib/yoai/meta/decision'

interface Props {
  campaigns: DeepCampaignInsight[]
  /** Kullanıcı bir aksiyonu "uygula" dediğinde (v1'de opsiyonel logging) */
  onApplyAction?: (decision: Decision, actionIndex: number) => void
}

interface DiagnoseResponse {
  ok: boolean
  diagnoses: DiagnosisResult[]
  decisions: Decision[]
  summary: { total: number; byRootCause: Record<string, number> }
}

const ROOT_CAUSE_LABEL: Record<RootCauseId, string> = {
  hook_problem: 'Hook Sorunu',
  landing_page_problem: 'Landing Page Sorunu',
  creative_fatigue: 'Kreatif Yorgunluğu',
  audience_mismatch: 'Hedefleme Uyumsuzluğu',
  event_quality_problem: 'Event Kalitesi',
  insufficient_data: 'Veri Yetersiz',
  budget_starvation: 'Bütçe Kısıtı',
  wrong_optimization_goal: 'Yanlış Optimizasyon Hedefi',
  pixel_misfire: 'Pixel / Tracking Sorunu',
  healthy: 'Sağlıklı',
}

const ACTION_LABEL: Record<DecisionActionType, string> = {
  monitor: 'İzle',
  tweak: 'Küçük Düzelt',
  revise: 'Revize Et',
  recreate: 'Yeniden Kur',
  change_objective: 'Objective Değiştir',
}

function rootCauseColor(id: RootCauseId): string {
  if (id === 'healthy') return 'bg-emerald-50 border-emerald-200 text-emerald-800'
  if (id === 'insufficient_data') return 'bg-gray-50 border-gray-200 text-gray-700'
  if (id === 'pixel_misfire' || id === 'budget_starvation') {
    return 'bg-red-50 border-red-200 text-red-700'
  }
  return 'bg-amber-50 border-amber-200 text-amber-800'
}

export default function DiagnosisPanel({ campaigns, onApplyAction }: Props) {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [data, setData] = useState<DiagnoseResponse | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const metaCampaigns = campaigns.filter((c) => c.platform === 'Meta')
    if (metaCampaigns.length === 0) {
      setLoading(false)
      setData({ ok: true, diagnoses: [], decisions: [], summary: { total: 0, byRootCause: {} } })
      return
    }
    ;(async () => {
      try {
        setLoading(true)
        setErr(null)
        const res = await fetch('/api/yoai/diagnose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaigns: metaCampaigns }),
        })
        const json = (await res.json()) as DiagnoseResponse
        if (!json.ok) throw new Error('Teşhis alınamadı.')
        setData(json)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Teşhis sırasında hata.')
      } finally {
        setLoading(false)
      }
    })()
  }, [campaigns])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Teşhis hazırlanıyor…
      </div>
    )
  }

  if (err) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
        {err}
      </div>
    )
  }

  if (!data || data.diagnoses.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4">
        Teşhis edilecek Meta kampanyası bulunamadı.
      </div>
    )
  }

  const total = data.summary.total
  const healthy = data.summary.byRootCause['healthy'] || 0
  const issueCount = total - healthy

  return (
    <div className="space-y-4">
      {/* Özet */}
      <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
        <Activity className="w-4 h-4 text-gray-500" />
        <div className="text-xs text-gray-600">
          <strong className="text-gray-900">{total}</strong> kampanya teşhis edildi —{' '}
          <span className="text-emerald-700">{healthy} sağlıklı</span>,{' '}
          <span className="text-amber-700">{issueCount} sorunlu</span>.
        </div>
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {data.diagnoses.map((d, idx) => {
          const decision = data.decisions[idx]
          const isOpen = !!expanded[d.campaignId]
          const color = rootCauseColor(d.primary.id)
          return (
            <div key={d.campaignId} className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [d.campaignId]: !prev[d.campaignId] }))
                }
                className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50"
              >
                <div className="flex items-center gap-3 text-left">
                  {d.primary.id === 'healthy' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{d.campaignName}</p>
                    <p className="text-[11px] text-gray-500">
                      {ROOT_CAUSE_LABEL[d.primary.id]} · güven: {d.primary.confidence}
                    </p>
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-3">
                  {/* Primary root cause */}
                  <div className={`rounded-lg border px-3 py-2 ${color}`}>
                    <p className="text-xs font-semibold mb-1">
                      {ROOT_CAUSE_LABEL[d.primary.id]}
                    </p>
                    <p className="text-xs">{d.primary.summary}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {d.primary.evidence.map((e, i) => (
                        <span
                          key={i}
                          className="inline-block text-[10px] bg-white/70 border border-current/20 rounded-full px-2 py-0.5"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Ek teşhisler */}
                  {d.rootCauses.length > 1 && (
                    <div className="text-[11px] text-gray-600">
                      <p className="font-semibold mb-1">Yan bulgular:</p>
                      <ul className="space-y-0.5">
                        {d.rootCauses.slice(1).map((rc) => (
                          <li key={rc.id}>
                            • <strong>{ROOT_CAUSE_LABEL[rc.id]}</strong> ({rc.confidence}) — {rc.summary}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Önerilen aksiyonlar */}
                  {decision && decision.actions.length > 0 && (
                    <div className="border-t border-gray-200 pt-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2">
                        Önerilen Aksiyon
                      </p>
                      {decision.actions.map((action, i) => (
                        <div
                          key={i}
                          className="bg-white border border-gray-200 rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900">{action.title}</p>
                            <span className="text-[10px] uppercase tracking-wider text-gray-400">
                              {ACTION_LABEL[action.actionType]} · {action.priority}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">{action.rationale}</p>
                          {onApplyAction && action.requiresApproval && (
                            <button
                              onClick={() => onApplyAction(decision, i)}
                              className="mt-1 text-xs px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90"
                            >
                              Uygulamayı başlat (onay gerekli)
                            </button>
                          )}
                        </div>
                      ))}
                      <p className="text-[10px] text-gray-500 mt-2 flex items-start gap-1">
                        <Info className="w-3 h-3 mt-0.5" />
                        {decision.reasoning}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
