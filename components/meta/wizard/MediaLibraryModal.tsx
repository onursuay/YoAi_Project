'use client'

import { useState, useEffect } from 'react'
import { getLocaleFromCookie, getWizardTranslations } from '@/lib/i18n/wizardTranslations'

interface MediaItem {
  hash?: string
  videoId?: string
  url: string
  name: string
  width?: number
  height?: number
  createdTime?: string
  thumbnail?: string
}

interface MediaLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'image' | 'video'
  onSelect: (item: MediaItem) => void
  pageId?: string // For video library filtering
}

export default function MediaLibraryModal({ isOpen, onClose, type, onSelect, pageId }: MediaLibraryModalProps) {
  const t = getWizardTranslations(getLocaleFromCookie())
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const fetchMedia = async () => {
      setLoading(true)
      setError('')
      try {
        const endpoint = type === 'image'
          ? '/api/meta/media-library/images'
          : `/api/meta/videos${pageId ? `?pageId=${pageId}` : ''}`

        const res = await fetch(endpoint)
        const data = await res.json()

        if (data.ok) {
          if (type === 'image') {
            setItems(data.data || [])
          } else {
            // Map video data to MediaItem format
            setItems((data.data || []).map((v: any) => ({
              videoId: v.id,
              url: v.source || '', // Video might not have direct URL
              name: v.title || 'Untitled Video',
              thumbnail: v.picture || '',
              createdTime: v.created_time,
            })))
          }
        } else {
          setError(data.message || (type === 'image' ? t.imagesLoadFailed : t.videosLoadFailed))
        }
      } catch (err) {
        setError(t.connectionError)
      } finally {
        setLoading(false)
      }
    }

    fetchMedia()
  }, [isOpen, type, pageId, t])

  const handleSelect = () => {
    if (selectedItem) {
      onSelect(selectedItem)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {type === 'image' ? t.selectFromImageLibrary : t.selectFromVideoLibrary}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">{t.loading}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {type === 'image' ? t.noImagesInLibrary : t.noVideosInLibrary}
              </p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {items.map((item, index) => (
                <div
                  key={item.hash || item.videoId || index}
                  onClick={() => setSelectedItem(item)}
                  className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                    selectedItem === item
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    {type === 'image' ? (
                      <img
                        src={item.url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="relative w-full h-full">
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                  {selectedItem === item && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="p-2 bg-white">
                    <p className="text-xs text-gray-600 truncate" title={item.name}>
                      {item.name}
                    </p>
                    {item.width && item.height && (
                      <p className="text-xs text-gray-400">{item.width}×{item.height}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedItem}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t.select}
          </button>
        </div>
      </div>
    </div>
  )
}
