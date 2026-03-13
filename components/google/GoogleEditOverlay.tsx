'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

interface GoogleEditOverlayProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  saving: boolean
  saveDisabled: boolean
  title: string
  subtitle: string
  children: React.ReactNode
}

export default function GoogleEditOverlay({
  open,
  onClose,
  onSave,
  saving,
  saveDisabled,
  title,
  subtitle,
  children,
}: GoogleEditOverlayProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)

    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-5 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 via-red-500 to-yellow-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">G</span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 leading-tight">{title}</h2>
            <p className="text-xs text-gray-500 truncate max-w-[400px]">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Kapat
          </button>
          <button
            onClick={onSave}
            disabled={saving || saveDisabled}
            className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Kaydet
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
