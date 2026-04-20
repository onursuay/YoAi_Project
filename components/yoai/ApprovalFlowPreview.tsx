'use client'

import { useState } from 'react'
import { CheckCircle, Eye, X, Clock, Zap, Inbox, Loader2 } from 'lucide-react'
import type { DeepActionDraft } from '@/lib/yoai/analysisTypes'
import type { ExecutableAction } from '@/lib/yoai/actionTypes'

const TYPE_COLORS: Record<string, string> = {
  budget: 'bg-emerald-50 text-emerald-700',
  creative: 'bg-violet-50 text-violet-700',
  targeting: 'bg-blue-50 text-blue-700',
  bid: 'bg-gray-50 text-gray-700',
  status: 'bg-gray-100 text-gray-700',
}

const TYPE_LABELS: Record<string, string> = {
  budget: 'Bütçe',
  creative: 'Kreatif',
  targeting: 'Hedefleme',
  bid: 'Teklif',
  status: 'Durum',
}

interface Props {
  drafts: DeepActionDraft[]
  loading: boolean
  onExecuteAction?: (action: ExecutableAction) => void
}

export default function ApprovalFlowPreview({ drafts, loading, onExecuteAction }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [executing, setExecuting] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({})

  const visibleDrafts = drafts.filter(d => !dismissed.has(d.id))

  const handleApprove = async (draft: DeepActionDraft) => {
    if (onExecuteAction) {
      // Use the action dialog
      const actionTypeMap: Record<string, string> = {
        budget: 'increase_budget',
        creative: 'refresh_creative',
        targeting: 'duplicate_adset',
        bid: 'increase_budget',
        status: 'pause_campaign',
      }
      const executable: ExecutableAction = {
        actionType: (actionTypeMap[draft.type] || 'pause_campaign') as ExecutableAction['actionType'],
        platform: draft.platform as ExecutableAction['platform'],
        entityType: (draft.targetEntityType || 'campaign') as ExecutableAction['entityType'],
        entityId: draft.targetEntityId || draft.campaignId,
        entityName: draft.campaign,
        campaignId: draft.campaignId,
        campaignName: draft.campaign,
      }
      onExecuteAction(executable)
      return
    }

    // Direct execution
    setExecuting(draft.id)
    try {
      const action: ExecutableAction = {
        actionType: 'pause_campaign',
        platform: draft.platform as ExecutableAction['platform'],
        entityType: (draft.targetEntityType || 'campaign') as ExecutableAction['entityType'],
        entityId: draft.targetEntityId || draft.campaignId,
        entityName: draft.campaign,
      }
      const res = await fetch('/api/yoai/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      setResults(prev => ({ ...prev, [draft.id]: { ok: json.ok, msg: json.data?.message || json.error || '' } }))
    } catch {
      setResults(prev => ({ ...prev, [draft.id]: { ok: false, msg: 'Bağlantı hatası' } }))
    } finally {
      setExecuting(null)
    }
  }

  const handleDismiss = (draftId: string) => {
    setDismissed(prev => new Set([...prev, draftId]))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Onay Akışı</h2>
          <p className="text-xs text-gray-400 mt-0.5">AI tarafından hazırlanan aksiyon taslakları</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map(i => <div key={i} className="h-[200px] bg-white rounded-2xl border border-gray-100 border-dashed animate-pulse" />)}
        </div>
      ) : visibleDrafts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 border-dashed p-6 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{drafts.length > 0 ? 'Tüm taslaklar işlendi.' : 'Henüz aksiyon taslağı oluşturulmadı.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleDrafts.map(draft => {
            const result = results[draft.id]
            const isExecuting = executing === draft.id

            return (
              <div key={draft.id} className={`bg-white rounded-2xl border p-5 transition-all flex flex-col ${result?.ok ? 'border-primary/30 bg-primary/5' : result?.ok === false ? 'border-red-200 bg-red-50/30' : 'border-gray-100 border-dashed hover:border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[draft.type] || 'bg-gray-100 text-gray-600'}`}>
                      {TYPE_LABELS[draft.type] || draft.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <Clock className="w-3 h-3" />
                    {draft.createdAt}
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{draft.title}</h3>
                <p className="text-[10px] text-gray-400 mb-2">{draft.platform} · {draft.campaign}</p>
                <p className="text-xs text-gray-600 mb-4 leading-relaxed flex-1 line-clamp-3">{draft.description}</p>

                {/* Result message */}
                {result && (
                  <p className={`text-[11px] mb-3 ${result.ok ? 'text-primary' : 'text-red-600'}`}>
                    {result.ok ? '✓ Başarıyla uygulandı' : `✗ ${result.msg}`}
                  </p>
                )}

                {/* Action buttons — FUNCTIONAL */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
                  {!result && (
                    <>
                      <button
                        onClick={() => handleApprove(draft)}
                        disabled={isExecuting}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary text-white rounded-lg text-[11px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {isExecuting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        Onayla
                      </button>
                      <button
                        onClick={() => handleApprove(draft)}
                        disabled={isExecuting}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[11px] font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        <Eye className="w-3 h-3" />İncele
                      </button>
                      <button
                        onClick={() => handleDismiss(draft.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-400 rounded-lg text-[11px] font-medium hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />Reddet
                      </button>
                    </>
                  )}
                  {result?.ok && (
                    <span className="text-[10px] text-primary font-medium">Uygulandı</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
