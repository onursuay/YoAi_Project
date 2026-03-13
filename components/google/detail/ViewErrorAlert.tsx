'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface ViewErrorInfo {
  userMessage: string
  technicalDetail?: string
}

export default function ViewErrorAlert({ error }: { error: ViewErrorInfo }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="p-6 space-y-3">
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="w-5 h-5 text-red-500 mt-0.5 shrink-0">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800">{error.userMessage}</p>
          {error.technicalDetail && (
            <button
              onClick={() => setOpen(v => !v)}
              className="mt-2 flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
              Teknik detay
            </button>
          )}
          {open && error.technicalDetail && (
            <pre className="mt-2 p-3 bg-red-100 rounded text-xs text-red-900 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
              {error.technicalDetail}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
