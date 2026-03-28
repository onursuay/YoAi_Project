'use client'

import { X, Loader2 } from 'lucide-react'

interface TikTokAdvertiser {
  advertiserId: string
  name: string
}

interface TikTokAccountModalProps {
  advertisers: TikTokAdvertiser[]
  advertisersLoading: boolean
  selectingKey: string | null
  accountsError: string | null
  onSelect: (adv: TikTokAdvertiser) => void
  onClose: () => void
}

export default function TikTokAccountModal({
  advertisers,
  advertisersLoading,
  selectingKey,
  accountsError,
  onSelect,
  onClose,
}: TikTokAccountModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">TikTok Ads Hesabı Seçin</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          {advertisersLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
              <span className="ml-2 text-sm text-gray-500">Hesaplar yükleniyor...</span>
            </div>
          )}

          {accountsError && (
            <div className="py-4 text-center">
              <p className="text-sm text-red-600">{accountsError}</p>
            </div>
          )}

          {!advertisersLoading && !accountsError && advertisers.length === 0 && (
            <div className="py-8 text-center text-gray-400 text-sm">
              Hesap bulunamadı
            </div>
          )}

          {!advertisersLoading && advertisers.map((adv) => (
            <button
              key={adv.advertiserId}
              onClick={() => onSelect(adv)}
              disabled={selectingKey === adv.advertiserId}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-rose-50 transition-colors text-left mb-1 disabled:opacity-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{adv.name}</p>
                <p className="text-xs text-gray-400">ID: {adv.advertiserId}</p>
              </div>
              {selectingKey === adv.advertiserId && (
                <Loader2 className="w-4 h-4 text-rose-500 animate-spin" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
