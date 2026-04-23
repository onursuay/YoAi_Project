'use client'

import { useState } from 'react'
import { X, Loader2, Search, FolderOpen, Youtube, ChevronLeft, ChevronRight } from 'lucide-react'
import type { DisplayAsset } from '../../shared/WizardTypes'
import { inputCls } from '../../shared/WizardTypes'

type TabId = 'library' | 'youtube'

interface LibraryVideo {
  resourceName: string
  name: string
  videoId: string
  title: string
  previewUrl: string
}

interface YoutubeVideo {
  videoId: string
  title: string
  channelTitle: string
  publishedAt?: string
  thumbnailUrl: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  existing: DisplayAsset[]
  onAdd: (asset: DisplayAsset) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
}

function isYoutubeUrlOrId(v: string): boolean {
  const s = v.trim()
  if (!s) return false
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return true
  return /(youtu\.be\/|v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/.test(s)
}

export default function DisplayVideoPicker({ isOpen, onClose, existing, onAdd, t }: Props) {
  const [tab, setTab] = useState<TabId>('library')

  // Library
  const [libLoading, setLibLoading] = useState(false)
  const [libError, setLibError] = useState<string | null>(null)
  const [libVideos, setLibVideos] = useState<LibraryVideo[]>([])
  const [libLoaded, setLibLoaded] = useState(false)

  // YouTube
  const [ytQuery, setYtQuery] = useState('')
  const [ytLoading, setYtLoading] = useState(false)
  const [ytError, setYtError] = useState<string | null>(null)
  const [ytNotConfigured, setYtNotConfigured] = useState(false)
  const [ytVideos, setYtVideos] = useState<YoutubeVideo[]>([])
  const [ytNextToken, setYtNextToken] = useState<string | null>(null)
  const [ytPrevToken, setYtPrevToken] = useState<string | null>(null)

  // Import
  const [importingId, setImportingId] = useState<string | null>(null)
  const [importErr, setImportErr] = useState<string | null>(null)

  const loadLibrary = async () => {
    if (libLoaded || libLoading) return
    setLibLoading(true)
    setLibError(null)
    try {
      const res = await fetch('/api/integrations/google-ads/assets/library?type=YOUTUBE_VIDEO')
      const json = await res.json()
      if (!res.ok) {
        setLibError(json.error ?? t('display.videoPicker.libraryError'))
        return
      }
      setLibVideos(json.assets ?? [])
      setLibLoaded(true)
    } catch {
      setLibError(t('display.videoPicker.libraryError'))
    } finally {
      setLibLoading(false)
    }
  }

  const runYoutube = async (pageToken?: string) => {
    const raw = ytQuery.trim()
    if (!raw) return
    setYtLoading(true)
    setYtError(null)
    setYtNotConfigured(false)
    try {
      const params = new URLSearchParams()
      if (isYoutubeUrlOrId(raw)) {
        params.set('lookup', raw)
      } else {
        params.set('q', raw)
        if (pageToken) params.set('pageToken', pageToken)
      }
      const res = await fetch(`/api/integrations/google-ads/assets/youtube?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 503) setYtNotConfigured(true)
        else setYtError(json.error ?? t('display.videoPicker.searchError'))
        setYtVideos([])
        setYtNextToken(null)
        setYtPrevToken(null)
        return
      }
      setYtVideos(json.videos ?? [])
      setYtNextToken(json.nextPageToken ?? null)
      setYtPrevToken(json.prevPageToken ?? null)
    } catch {
      setYtError(t('display.videoPicker.searchError'))
    } finally {
      setYtLoading(false)
    }
  }

  const addFromLibrary = (v: LibraryVideo) => {
    onAdd({
      resourceName: v.resourceName,
      kind: 'YOUTUBE_VIDEO',
      previewUrl: v.previewUrl,
      name: v.name || v.title || v.videoId,
    })
  }

  const addFromYoutube = async (v: YoutubeVideo) => {
    setImportingId(v.videoId)
    setImportErr(null)
    try {
      const res = await fetch('/api/integrations/google-ads/assets/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: v.videoId, name: v.title || v.videoId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setImportErr(json.error ?? t('display.videoPicker.importError'))
        return
      }
      onAdd({
        resourceName: json.resourceName,
        kind: 'YOUTUBE_VIDEO',
        previewUrl: v.thumbnailUrl,
        name: v.title || v.videoId,
      })
    } catch {
      setImportErr(t('display.videoPicker.importError'))
    } finally {
      setImportingId(null)
    }
  }

  if (!isOpen) return null
  const videosCount = existing.filter(a => a.kind === 'YOUTUBE_VIDEO').length
  const remaining = Math.max(0, 5 - videosCount)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t('display.videoPicker.title')}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t('display.videoPicker.subtitle', { remaining })}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => { setTab('library'); void loadLibrary() }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'library' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
            >
              <FolderOpen className="w-4 h-4" />
              {t('display.videoPicker.tabLibrary')}
            </button>
            <button
              type="button"
              onClick={() => setTab('youtube')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'youtube' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
            >
              <Youtube className="w-4 h-4" />
              {t('display.videoPicker.tabYoutube')}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'library' && (
            <>
              {libLoading ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : libError ? (
                <p className="text-sm text-red-500">{libError}</p>
              ) : libVideos.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-16">{t('display.videoPicker.libraryEmpty')}</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {libVideos.map(v => (
                    <button
                      key={v.resourceName}
                      type="button"
                      onClick={() => addFromLibrary(v)}
                      className="group relative rounded-lg overflow-hidden border border-gray-200 hover:border-blue-500 bg-white transition-colors text-left"
                    >
                      <div className="relative w-full h-32 bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={v.previewUrl} alt={v.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Youtube className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      <div className="px-2 py-1.5 border-t border-gray-100">
                        <p className="text-xs text-gray-800 font-medium line-clamp-2">{v.title || v.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'youtube' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    className={`${inputCls} pl-9`}
                    value={ytQuery}
                    onChange={e => setYtQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void runYoutube() }}
                    placeholder={t('display.videoPicker.ytPlaceholder')}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void runYoutube()}
                  disabled={ytLoading || !ytQuery.trim()}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {ytLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('display.videoPicker.ytSearch')}
                </button>
              </div>
              {ytError && <p className="text-xs text-red-500">{ytError}</p>}
              {ytNotConfigured && <p className="text-xs text-red-500">{t('display.videoPicker.ytNoApiKey')}</p>}
              {importErr && <p className="text-xs text-red-500">{importErr}</p>}
              {!ytLoading && ytVideos.length === 0 && ytQuery && !ytError && !ytNotConfigured && (
                <p className="text-xs text-gray-500 italic">{t('display.videoPicker.ytNoResults')}</p>
              )}
              {ytVideos.length > 0 && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {ytVideos.map(v => {
                      const busy = importingId === v.videoId
                      return (
                        <button
                          key={v.videoId}
                          type="button"
                          onClick={() => void addFromYoutube(v)}
                          disabled={busy}
                          className="group relative rounded-lg overflow-hidden border border-gray-200 hover:border-blue-500 bg-white transition-colors text-left disabled:opacity-60"
                        >
                          <div className="relative w-full h-32 bg-gray-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              {busy ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <Youtube className="w-8 h-8 text-white" />}
                            </div>
                          </div>
                          <div className="px-2 py-1.5 border-t border-gray-100">
                            <p className="text-xs text-gray-800 font-medium line-clamp-2">{v.title}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5 truncate">{v.channelTitle}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {(ytNextToken || ytPrevToken) && (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => ytPrevToken && void runYoutube(ytPrevToken)}
                        disabled={!ytPrevToken || ytLoading}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => ytNextToken && void runYoutube(ytNextToken)}
                        disabled={!ytNextToken || ytLoading}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
