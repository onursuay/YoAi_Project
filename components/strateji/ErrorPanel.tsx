'use client'

import { AlertTriangle, RotateCcw } from 'lucide-react'
import type { ErrorDetail } from '@/lib/strategy/types'

interface ErrorPanelProps {
  error: ErrorDetail | null
  onRetry?: () => void
  retrying?: boolean
}

export default function ErrorPanel({ error, onRetry, retrying }: ErrorPanelProps) {
  if (!error) return null

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-red-800">Hata Oluştu</h4>
          <p className="text-sm text-red-700 mt-1">{error.message}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-red-500">
            <span>Kod: {error.code}</span>
            {error.timestamp && (
              <span>{new Date(error.timestamp).toLocaleString('tr-TR')}</span>
            )}
          </div>
          {error.details && (
            <details className="mt-2">
              <summary className="text-xs text-red-500 cursor-pointer hover:text-red-700">Teknik Detay</summary>
              <pre className="mt-1 text-[10px] text-red-600 bg-red-100 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(error.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
            Tekrar Dene
          </button>
        )}
      </div>
    </div>
  )
}
