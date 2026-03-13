'use client'

import { Monitor, Instagram, FileText, Video, ClipboardList, Package, Smartphone, Wifi, Users } from 'lucide-react'
import type { AudienceSource, CustomAudienceState } from '../types'
import { SOURCE_LABELS } from '../types'

interface StepSourceProps {
  state: CustomAudienceState
  onChange: (updates: Partial<CustomAudienceState>) => void
  assets: {
    pixels: { id: string; name: string }[]
    instagramAccounts: { id: string; username: string }[]
    pages: { id: string; name: string }[]
  }
}

const SOURCE_OPTIONS: { id: AudienceSource; icon: React.ComponentType<{ className?: string }>; disabled?: boolean }[] = [
  { id: 'PIXEL', icon: Monitor },
  { id: 'IG', icon: Instagram },
  { id: 'PAGE', icon: FileText },
  { id: 'VIDEO', icon: Video },
  { id: 'LEADFORM', icon: ClipboardList },
  { id: 'CATALOG', icon: Package },
  { id: 'APP', icon: Smartphone },
  { id: 'OFFLINE', icon: Wifi },
  { id: 'CUSTOMER_LIST', icon: Users },
]

function isSourceAvailable(source: AudienceSource, assets: StepSourceProps['assets']): { available: boolean; reason?: string } {
  switch (source) {
    case 'PIXEL':
      return assets.pixels.length > 0
        ? { available: true }
        : { available: false, reason: 'Pixel bulunamadı. Entegrasyon sayfasından bağlayın.' }
    case 'IG':
      return assets.instagramAccounts.length > 0
        ? { available: true }
        : { available: false, reason: 'Instagram hesabı bağlı değil.' }
    case 'PAGE':
      return assets.pages.length > 0
        ? { available: true }
        : { available: false, reason: 'Facebook sayfası bulunamadı.' }
    default:
      return { available: true }
  }
}

export default function StepSource({ state, onChange, assets }: StepSourceProps) {
  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">Kaynak Seçimi</h3>
      <p className="text-sm text-gray-500 mb-6">Retargeting kitleniz için veri kaynağını seçin.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SOURCE_OPTIONS.map(({ id, icon: Icon }) => {
          const { available, reason } = isSourceAvailable(id, assets)
          const isSelected = state.source === id

          return (
            <button
              key={id}
              type="button"
              disabled={!available}
              onClick={() => onChange({ source: id, rule: { retention: 30 } })}
              className={`relative flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : available
                  ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isSelected ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                  {SOURCE_LABELS[id].tr}
                </p>
                {!available && reason && (
                  <p className="text-caption text-amber-600 mt-0.5">{reason}</p>
                )}
              </div>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-white text-xs">{'\u2713'}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
