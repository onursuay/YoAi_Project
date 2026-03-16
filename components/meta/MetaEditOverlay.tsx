'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import CampaignTreeSidebar from './CampaignTreeSidebar'
import type { TreeCampaign, TreeAdset, TreeAd } from './CampaignTreeSidebar'

interface MetaEditOverlayProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  saving: boolean
  saveDisabled: boolean
  title: string
  subtitle: string
  campaigns: TreeCampaign[]
  adsets: TreeAdset[]
  ads: TreeAd[]
  editingEntity: { type: 'campaign' | 'adset' | 'ad'; id: string }
  relatedCampaignId?: string
  onEntitySelect: (type: 'campaign' | 'adset' | 'ad', id: string, name: string) => void
  highlightedIds?: string[]
  children: React.ReactNode
}

export default function MetaEditOverlay({
  open,
  onClose,
  onSave,
  saving,
  saveDisabled,
  title,
  subtitle,
  campaigns,
  adsets,
  ads,
  editingEntity,
  relatedCampaignId,
  onEntitySelect,
  highlightedIds,
  children,
}: MetaEditOverlayProps) {
  // Lock body scroll & handle Escape key
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
          {/* Meta logo */}
          <img src="/meta-logo.png" alt="Meta" width={28} height={28} className="shrink-0" />
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
            className="px-5 py-2 text-sm font-medium text-white bg-[#2BB673] rounded-lg hover:bg-[#249E63] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Kaydet
          </button>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <CampaignTreeSidebar
          campaigns={campaigns}
          adsets={adsets}
          ads={ads}
          editingEntity={editingEntity}
          relatedCampaignId={relatedCampaignId}
          onEntitySelect={onEntitySelect}
          highlightedIds={highlightedIds}
        />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
