'use client'

import { useState } from 'react'
import { X, AlertTriangle, Loader2, CheckCircle, XCircle } from 'lucide-react'
import type { ExecutableAction, ActionResult } from '@/lib/yoai/actionTypes'
import { ACTION_LABELS } from '@/lib/yoai/actionTypes'

interface Props {
  action: ExecutableAction
  onClose: () => void
  onSuccess: (result: ActionResult) => void
}

export default function ActionConfirmDialog({ action, onClose, onSuccess }: Props) {
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<ActionResult | null>(null)

  const label = ACTION_LABELS[action.actionType] || action.actionType
  const isRisky = ['pause_campaign', 'decrease_budget'].includes(action.actionType)

  const handleExecute = async () => {
    setExecuting(true)
    try {
      const res = await fetch('/api/yoai/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      const actionResult: ActionResult = json.data || { ok: false, actionType: action.actionType, entityId: action.entityId, message: json.message || 'Hata', error: json.error }
      setResult(actionResult)
      if (actionResult.ok) {
        onSuccess(actionResult)
      }
    } catch {
      setResult({ ok: false, actionType: action.actionType, entityId: action.entityId, message: 'Bağlantı hatası', error: 'network_error' })
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-popup-scale">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>

        {/* Result state */}
        {result ? (
          <div className="text-center py-4">
            {result.ok ? (
              <>
                <CheckCircle className="w-12 h-12 text-primary mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Başarılı</h3>
                <p className="text-sm text-gray-600">{result.message}</p>
              </>
            ) : (
              <>
                <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Hata</h3>
                <p className="text-sm text-gray-600">{result.message}</p>
                {result.error && <p className="text-xs text-gray-400 mt-1">{result.error}</p>}
              </>
            )}
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors">
              Kapat
            </button>
          </div>
        ) : (
          <>
            {/* Confirm state */}
            <div className="flex items-center gap-3 mb-4">
              {isRisky && <AlertTriangle className="w-6 h-6 text-gray-500 shrink-0" />}
              <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Platform</span>
                <span className="font-medium text-gray-900">{action.platform}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tür</span>
                <span className="font-medium text-gray-900">
                  {action.entityType === 'campaign' ? 'Kampanya' : action.entityType === 'adset' || action.entityType === 'ad_group' ? 'Reklam Seti' : 'Reklam'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Hedef</span>
                <span className="font-medium text-gray-900 truncate max-w-[60%] text-right">{action.entityName}</span>
              </div>
              {action.campaignName && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Kampanya</span>
                  <span className="font-medium text-gray-900 truncate max-w-[60%] text-right">{action.campaignName}</span>
                </div>
              )}
              {action.params?.newBudget && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Yeni Bütçe</span>
                  <span className="font-medium text-primary">₺{action.params.newBudget.toFixed(2)}</span>
                </div>
              )}
            </div>

            {isRisky && (
              <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 mb-4">
                Bu aksiyon kampanya performansını etkileyebilir. Devam etmek istediğinizden emin misiniz?
              </p>
            )}

            <div className="flex items-center gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
                Vazgeç
              </button>
              <button
                onClick={handleExecute}
                disabled={executing}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {executing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Uygulanıyor...</>
                ) : (
                  'Onayla ve Uygula'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
