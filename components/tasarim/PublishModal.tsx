'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { X, Send, Loader2, Facebook, Instagram, AlertCircle, Link2 } from 'lucide-react'
import type { ToastType } from '@/components/Toast'

interface GeneratedItem {
  id: string
  url: string
  type: 'gorsel' | 'video'
  prompt: string
  ratio: string
  createdAt: Date
}

interface PublishTarget {
  pageId: string
  pageName: string
  pageImageUrl: string | null
  instagram: {
    igUserId: string
    username: string
    profilePictureUrl: string | null
  } | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  item: GeneratedItem | null
  onToast: (message: string, type: ToastType) => void
}

const IG_CAPTION_MAX = 2200

export default function PublishModal({ isOpen, onClose, item, onToast }: Props) {
  const t = useTranslations('dashboard.tasarim.publishModal')

  const [targets, setTargets] = useState<PublishTarget[]>([])
  const [isLoadingTargets, setIsLoadingTargets] = useState(true)
  const [notConnected, setNotConnected] = useState(false)
  const [selectedPageId, setSelectedPageId] = useState('')
  const [publishToFacebook, setPublishToFacebook] = useState(true)
  const [publishToInstagram, setPublishToInstagram] = useState(false)
  const [caption, setCaption] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch targets when modal opens
  useEffect(() => {
    if (!isOpen) return

    setIsLoadingTargets(true)
    setNotConnected(false)
    setError(null)
    setCaption('')
    setPublishToFacebook(true)
    setPublishToInstagram(false)

    fetch('/api/meta/publish/targets')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.data?.length > 0) {
          setTargets(data.data)
          setSelectedPageId(data.data[0].pageId)
        } else if (data.error === 'missing_token') {
          setNotConnected(true)
        } else {
          setTargets([])
        }
      })
      .catch(() => {
        setNotConnected(true)
      })
      .finally(() => setIsLoadingTargets(false))
  }, [isOpen])

  if (!isOpen || !item) return null

  const selectedTarget = targets.find((t) => t.pageId === selectedPageId)
  const hasInstagram = !!selectedTarget?.instagram

  const handlePublish = async () => {
    if (!publishToFacebook && !publishToInstagram) return

    setIsPublishing(true)
    setError(null)

    const mediaType = item.type === 'gorsel' ? 'image' : 'video'
    const results: string[] = []
    const errors: string[] = []

    // Publish to Facebook
    if (publishToFacebook) {
      try {
        const res = await fetch('/api/meta/publish/facebook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId: selectedPageId, mediaUrl: item.url, mediaType, caption }),
        })
        const data = await res.json()
        if (data.ok) {
          results.push('Facebook')
        } else {
          errors.push(`Facebook: ${data.message}`)
        }
      } catch {
        errors.push('Facebook: Bağlantı hatası')
      }
    }

    // Publish to Instagram
    if (publishToInstagram && selectedTarget?.instagram) {
      try {
        const res = await fetch('/api/meta/publish/instagram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageId: selectedPageId,
            igUserId: selectedTarget.instagram.igUserId,
            mediaUrl: item.url,
            mediaType,
            caption,
          }),
        })
        const data = await res.json()
        if (data.ok) {
          results.push('Instagram')
        } else {
          errors.push(`Instagram: ${data.message}`)
        }
      } catch {
        errors.push('Instagram: Bağlantı hatası')
      }
    }

    if (results.length > 0) {
      onToast(t('publishSuccess', { platforms: results.join(' & ') }), 'success')
    }

    if (errors.length > 0) {
      setError(errors.join('\n'))
    } else {
      onClose()
    }

    setIsPublishing(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{t('title')}</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Loading */}
          {isLoadingTargets && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          )}

          {/* Not connected */}
          {!isLoadingTargets && notConnected && (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Link2 className="w-7 h-7 text-blue-500" />
              </div>
              <p className="text-sm text-gray-600 mb-4">{t('notConnected')}</p>
              <a
                href="/api/meta/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1877F2] text-white text-sm font-medium rounded-xl hover:bg-[#166FE5] transition-colors"
              >
                <Facebook className="w-4 h-4" />
                {t('connectMeta')}
              </a>
            </div>
          )}

          {/* No pages */}
          {!isLoadingTargets && !notConnected && targets.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-gray-600 mb-2">{t('noPages')}</p>
              <p className="text-xs text-gray-400">{t('reconnectHint')}</p>
            </div>
          )}

          {/* Main form */}
          {!isLoadingTargets && !notConnected && targets.length > 0 && (
            <>
              {/* Media preview */}
              <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                  {item.type === 'video' ? (
                    <video src={item.url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-800 truncate">{item.prompt}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {item.type === 'gorsel' ? 'Görsel' : 'Video'} • {item.ratio}
                  </p>
                </div>
              </div>

              {/* Page selector */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  {t('selectPage')}
                </label>
                <select
                  value={selectedPageId}
                  onChange={(e) => {
                    setSelectedPageId(e.target.value)
                    setPublishToInstagram(false)
                  }}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2BB673]/30 focus:border-[#2BB673]"
                >
                  {targets.map((target) => (
                    <option key={target.pageId} value={target.pageId}>
                      {target.pageName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Platform selection */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  {t('platforms')}
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={publishToFacebook}
                      onChange={(e) => setPublishToFacebook(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-[#1877F2] focus:ring-[#1877F2]/30"
                    />
                    <Facebook className="w-4 h-4 text-[#1877F2]" />
                    <span className="text-sm text-gray-800">{t('publishToFacebook')}</span>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-3 border rounded-xl transition-colors ${
                      hasInstagram
                        ? 'border-gray-200 cursor-pointer hover:bg-gray-50'
                        : 'border-gray-100 bg-gray-50 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={publishToInstagram}
                      onChange={(e) => setPublishToInstagram(e.target.checked)}
                      disabled={!hasInstagram}
                      className="w-4 h-4 rounded border-gray-300 text-[#E4405F] focus:ring-[#E4405F]/30 disabled:opacity-40"
                    />
                    <Instagram className="w-4 h-4 text-[#E4405F]" />
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${hasInstagram ? 'text-gray-800' : 'text-gray-400'}`}>
                        {t('publishToInstagram')}
                      </span>
                      {hasInstagram && selectedTarget?.instagram && (
                        <span className="text-xs text-gray-400 ml-1.5">
                          @{selectedTarget.instagram.username}
                        </span>
                      )}
                      {!hasInstagram && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{t('noInstagram')}</p>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Caption */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  {t('caption')}
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={t('captionPlaceholder')}
                  rows={3}
                  maxLength={IG_CAPTION_MAX}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2BB673]/30 focus:border-[#2BB673]"
                />
                {publishToInstagram && (
                  <p className="text-right text-[10px] text-gray-400 mt-1">
                    {t('captionCount', { count: caption.length, max: IG_CAPTION_MAX })}
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700 whitespace-pre-line">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isLoadingTargets && !notConnected && targets.length > 0 && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
            <button
              onClick={onClose}
              disabled={isPublishing}
              className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handlePublish}
              disabled={isPublishing || (!publishToFacebook && !publishToInstagram)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2BB673] text-white text-sm font-medium rounded-xl hover:bg-[#25A366] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('publishing')}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {t('publishButton')}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
