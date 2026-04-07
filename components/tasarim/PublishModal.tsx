'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  X, Send, Loader2, Facebook, Instagram, AlertCircle, Link2,
  Film, BookImage, LayoutGrid, Monitor, Smartphone, Clock, Calendar,
} from 'lucide-react'
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

type IgPublishType = 'feed' | 'reels' | 'stories'
type FbPublishType = 'feed' | 'reels'
type PreviewFormat = 'fb_feed' | 'ig_feed' | 'ig_stories' | 'ig_reels'
type DeviceType = 'desktop' | 'mobile'

export default function PublishModal({ isOpen, onClose, item, onToast }: Props) {
  const t = useTranslations('dashboard.tasarim.publishModal')

  const [targets, setTargets] = useState<PublishTarget[]>([])
  const [isLoadingTargets, setIsLoadingTargets] = useState(true)
  const [notConnected, setNotConnected] = useState(false)

  // Multi-account selection: which pages/IG accounts are checked
  const [selectedPages, setSelectedPages] = useState<Record<string, boolean>>({})
  const [selectedIgs, setSelectedIgs] = useState<Record<string, boolean>>({})

  // Publish type per account
  const [fbPublishTypes, setFbPublishTypes] = useState<Record<string, FbPublishType>>({})
  const [igPublishTypes, setIgPublishTypes] = useState<Record<string, IgPublishType>>({})

  // Caption
  const [customizeCaption, setCustomizeCaption] = useState(false)
  const [captionCommon, setCaptionCommon] = useState('')
  const [captionFb, setCaptionFb] = useState('')
  const [captionIg, setCaptionIg] = useState('')
  const [captionTab, setCaptionTab] = useState<'facebook' | 'instagram'>('facebook')

  // Scheduling
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>('now')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')

  // Preview
  const [previewFormat, setPreviewFormat] = useState<PreviewFormat>('fb_feed')
  const [previewDevice, setPreviewDevice] = useState<DeviceType>('mobile')

  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isVideo = item?.type === 'video'
  const canReels = isVideo

  // Fetch targets when modal opens
  useEffect(() => {
    if (!isOpen) return

    setIsLoadingTargets(true)
    setNotConnected(false)
    setError(null)
    setCaptionCommon('')
    setCaptionFb('')
    setCaptionIg('')
    setCustomizeCaption(false)
    setCaptionTab('facebook')
    setScheduleMode('now')
    setScheduleDate('')
    setScheduleTime('')
    setPreviewFormat('fb_feed')
    setPreviewDevice('mobile')

    fetch('/api/meta/publish/targets')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.data?.length > 0) {
          const tgts: PublishTarget[] = data.data
          setTargets(tgts)

          // Default: first page selected, first IG selected
          const pages: Record<string, boolean> = {}
          const igs: Record<string, boolean> = {}
          const fbTypes: Record<string, FbPublishType> = {}
          const igTypes: Record<string, IgPublishType> = {}
          tgts.forEach((tgt, i) => {
            pages[tgt.pageId] = i === 0
            fbTypes[tgt.pageId] = 'feed'
            if (tgt.instagram) {
              igs[tgt.pageId] = i === 0
              igTypes[tgt.pageId] = 'feed'
            }
          })
          setSelectedPages(pages)
          setSelectedIgs(igs)
          setFbPublishTypes(fbTypes)
          setIgPublishTypes(igTypes)
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

  // Has any FB or IG selected
  const hasAnyFb = Object.values(selectedPages).some(Boolean)
  const hasAnyIg = Object.values(selectedIgs).some(Boolean)
  const hasAnySelected = hasAnyFb || hasAnyIg

  // Show caption only if not exclusively IG stories
  const onlyIgStories = useMemo(() => {
    if (hasAnyFb) return false
    return targets.every(
      (tgt) => !selectedIgs[tgt.pageId] || igPublishTypes[tgt.pageId] === 'stories',
    )
  }, [hasAnyFb, selectedIgs, igPublishTypes, targets])

  // First selected target for preview
  const firstSelectedTarget = useMemo(() => {
    return targets.find((tgt) => selectedPages[tgt.pageId] || selectedIgs[tgt.pageId])
  }, [targets, selectedPages, selectedIgs])

  if (!isOpen || !item) return null

  const handlePublish = async () => {
    if (!hasAnySelected) return

    setIsPublishing(true)
    setError(null)

    const mediaType = item.type === 'gorsel' ? 'image' : 'video'
    const results: string[] = []
    const errors: string[] = []

    for (const tgt of targets) {
      // Publish to Facebook
      if (selectedPages[tgt.pageId]) {
        try {
          const fbCaption = customizeCaption ? captionFb : captionCommon
          const res = await fetch('/api/meta/publish/facebook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pageId: tgt.pageId,
              mediaUrl: item.url,
              mediaType,
              publishType: fbPublishTypes[tgt.pageId] || 'feed',
              caption: fbCaption,
            }),
          })
          const data = await res.json()
          if (data.ok) {
            results.push(`Facebook (${tgt.pageName})`)
          } else {
            errors.push(`Facebook (${tgt.pageName}): ${data.message}`)
          }
        } catch {
          errors.push(`Facebook (${tgt.pageName}): ${t('connectionError')}`)
        }
      }

      // Publish to Instagram
      if (selectedIgs[tgt.pageId] && tgt.instagram) {
        try {
          const igType = igPublishTypes[tgt.pageId] || 'feed'
          const igCaption = igType === 'stories' ? undefined : (customizeCaption ? captionIg : captionCommon)
          const res = await fetch('/api/meta/publish/instagram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pageId: tgt.pageId,
              igUserId: tgt.instagram.igUserId,
              mediaUrl: item.url,
              mediaType,
              publishType: igType,
              caption: igCaption,
            }),
          })
          const data = await res.json()
          if (data.ok) {
            results.push(`Instagram (@${tgt.instagram.username})`)
          } else {
            errors.push(`Instagram (@${tgt.instagram.username}): ${data.message}`)
          }
        } catch {
          errors.push(`Instagram: ${t('connectionError')}`)
        }
      }
    }

    if (results.length > 0) {
      onToast(t('publishSuccess', { platforms: results.join(', ') }), 'success')
    }

    if (errors.length > 0) {
      setError(errors.join('\n'))
    } else {
      onClose()
    }

    setIsPublishing(false)
  }

  // Preview aspect ratio based on format
  const getPreviewStyle = (): { width: string; aspectRatio: string } => {
    switch (previewFormat) {
      case 'ig_stories':
      case 'ig_reels':
        return { width: '100%', aspectRatio: '9/16' }
      case 'ig_feed':
        return { width: '100%', aspectRatio: '1/1' }
      case 'fb_feed':
      default:
        return { width: '100%', aspectRatio: '16/9' }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal — two column */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[960px] mx-4 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{t('title')}</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loading */}
        {isLoadingTargets && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}

        {/* Not connected */}
        {!isLoadingTargets && notConnected && (
          <div className="text-center py-12 px-6">
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
          <div className="text-center py-12 px-6">
            <p className="text-sm text-gray-600 mb-2">{t('noPages')}</p>
            <p className="text-xs text-gray-500">{t('reconnectHint')}</p>
          </div>
        )}

        {/* Main content — two columns */}
        {!isLoadingTargets && !notConnected && targets.length > 0 && (
          <>
            <div className="flex flex-1 overflow-hidden">
              {/* Left: Form */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 border-r border-gray-100">

                {/* Post to — account selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    {t('postTo')}
                  </label>
                  <div className="space-y-2">
                    {targets.map((tgt) => (
                      <div key={tgt.pageId} className="border border-gray-200 rounded-xl overflow-hidden">
                        {/* Facebook page row */}
                        <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                          <input
                            type="checkbox"
                            checked={!!selectedPages[tgt.pageId]}
                            onChange={(e) =>
                              setSelectedPages((prev) => ({ ...prev, [tgt.pageId]: e.target.checked }))
                            }
                            className="w-4 h-4 rounded border-gray-300 text-[#1877F2] focus:ring-[#1877F2]/30"
                          />
                          {tgt.pageImageUrl ? (
                            <img src={tgt.pageImageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-[#1877F2]/10 flex items-center justify-center">
                              <Facebook className="w-3.5 h-3.5 text-[#1877F2]" />
                            </div>
                          )}
                          <span className="text-sm text-gray-800 font-medium flex-1">{tgt.pageName}</span>
                          <Facebook className="w-4 h-4 text-[#1877F2]" />
                        </label>

                        {/* FB type selector (inline) */}
                        {selectedPages[tgt.pageId] && (
                          <div className="flex gap-1.5 px-3 pb-2.5 ml-10">
                            <button
                              type="button"
                              onClick={() => setFbPublishTypes((p) => ({ ...p, [tgt.pageId]: 'feed' }))}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                                (fbPublishTypes[tgt.pageId] || 'feed') === 'feed'
                                  ? 'bg-[#1877F2]/10 text-[#1877F2] font-medium'
                                  : 'text-gray-500 hover:bg-gray-100'
                              }`}
                            >
                              <LayoutGrid className="w-3 h-3" />
                              Feed
                            </button>
                            <button
                              type="button"
                              onClick={() => canReels && setFbPublishTypes((p) => ({ ...p, [tgt.pageId]: 'reels' }))}
                              disabled={!canReels}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                                fbPublishTypes[tgt.pageId] === 'reels'
                                  ? 'bg-[#1877F2]/10 text-[#1877F2] font-medium'
                                  : !canReels
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-500 hover:bg-gray-100'
                              }`}
                            >
                              <Film className="w-3 h-3" />
                              Reels
                            </button>
                          </div>
                        )}

                        {/* Instagram row (linked to page) */}
                        {tgt.instagram && (
                          <>
                            <div className="border-t border-gray-100" />
                            <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                              <input
                                type="checkbox"
                                checked={!!selectedIgs[tgt.pageId]}
                                onChange={(e) =>
                                  setSelectedIgs((prev) => ({ ...prev, [tgt.pageId]: e.target.checked }))
                                }
                                className="w-4 h-4 rounded border-gray-300 text-[#E4405F] focus:ring-[#E4405F]/30"
                              />
                              {tgt.instagram.profilePictureUrl ? (
                                <img src={tgt.instagram.profilePictureUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-[#E4405F]/10 flex items-center justify-center">
                                  <Instagram className="w-3.5 h-3.5 text-[#E4405F]" />
                                </div>
                              )}
                              <span className="text-sm text-gray-700 flex-1">@{tgt.instagram.username}</span>
                              <Instagram className="w-4 h-4 text-[#E4405F]" />
                            </label>

                            {/* IG type selector (inline) */}
                            {selectedIgs[tgt.pageId] && (
                              <div className="flex gap-1.5 px-3 pb-2.5 ml-10">
                                <button
                                  type="button"
                                  onClick={() => setIgPublishTypes((p) => ({ ...p, [tgt.pageId]: 'feed' }))}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                                    (igPublishTypes[tgt.pageId] || 'feed') === 'feed'
                                      ? 'bg-[#E4405F]/10 text-[#E4405F] font-medium'
                                      : 'text-gray-500 hover:bg-gray-100'
                                  }`}
                                >
                                  <LayoutGrid className="w-3 h-3" />
                                  Feed
                                </button>
                                <button
                                  type="button"
                                  onClick={() => canReels && setIgPublishTypes((p) => ({ ...p, [tgt.pageId]: 'reels' }))}
                                  disabled={!canReels}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                                    igPublishTypes[tgt.pageId] === 'reels'
                                      ? 'bg-[#E4405F]/10 text-[#E4405F] font-medium'
                                      : !canReels
                                        ? 'text-gray-300 cursor-not-allowed'
                                        : 'text-gray-500 hover:bg-gray-100'
                                  }`}
                                >
                                  <Film className="w-3 h-3" />
                                  Reels
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIgPublishTypes((p) => ({ ...p, [tgt.pageId]: 'stories' }))}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                                    igPublishTypes[tgt.pageId] === 'stories'
                                      ? 'bg-[#E4405F]/10 text-[#E4405F] font-medium'
                                      : 'text-gray-500 hover:bg-gray-100'
                                  }`}
                                >
                                  <BookImage className="w-3 h-3" />
                                  Stories
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Caption section */}
                {!onlyIgStories && (
                  <div>
                    {/* Customize toggle — only when both FB and IG selected */}
                    {hasAnyFb && hasAnyIg && (
                      <div className="flex items-center gap-3 mb-3">
                        <button
                          type="button"
                          onClick={() => setCustomizeCaption(!customizeCaption)}
                          className={`relative w-9 h-5 rounded-full transition-colors ${
                            customizeCaption ? 'bg-[#2BB673]' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                              customizeCaption ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className="text-sm text-gray-700">{t('customizeCaption')}</span>
                      </div>
                    )}

                    {/* Single caption */}
                    {!customizeCaption && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {t('caption')}
                        </label>
                        <textarea
                          value={captionCommon}
                          onChange={(e) => setCaptionCommon(e.target.value)}
                          placeholder={t('captionPlaceholder')}
                          rows={3}
                          maxLength={IG_CAPTION_MAX}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2BB673]/30 focus:border-[#2BB673]"
                        />
                        {hasAnyIg && (
                          <p className="text-right text-xs text-gray-400 mt-1">
                            {captionCommon.length} / {IG_CAPTION_MAX}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Separate captions: FB tab / IG tab */}
                    {customizeCaption && (
                      <div>
                        <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setCaptionTab('facebook')}
                            className={`flex items-center gap-1.5 flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              captionTab === 'facebook'
                                ? 'bg-white text-[#1877F2] shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            <Facebook className="w-3.5 h-3.5" />
                            Facebook
                          </button>
                          <button
                            type="button"
                            onClick={() => setCaptionTab('instagram')}
                            className={`flex items-center gap-1.5 flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              captionTab === 'instagram'
                                ? 'bg-white text-[#E4405F] shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            <Instagram className="w-3.5 h-3.5" />
                            Instagram
                          </button>
                        </div>

                        {captionTab === 'facebook' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              {t('facebookText')}
                            </label>
                            <textarea
                              value={captionFb}
                              onChange={(e) => setCaptionFb(e.target.value)}
                              placeholder={t('captionPlaceholder')}
                              rows={3}
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2]"
                            />
                          </div>
                        )}

                        {captionTab === 'instagram' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              {t('instagramText')}
                            </label>
                            <textarea
                              value={captionIg}
                              onChange={(e) => setCaptionIg(e.target.value)}
                              placeholder={t('captionPlaceholder')}
                              rows={3}
                              maxLength={IG_CAPTION_MAX}
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#E4405F]/20 focus:border-[#E4405F]"
                            />
                            <p className="text-right text-xs text-gray-400 mt-1">
                              {captionIg.length} / {IG_CAPTION_MAX}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Scheduling */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    {t('scheduling')}
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setScheduleMode('now')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                        scheduleMode === 'now'
                          ? 'bg-[#2BB673]/10 text-[#2BB673] font-medium border border-[#2BB673]/30'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {t('publishNow')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleMode('schedule')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                        scheduleMode === 'schedule'
                          ? 'bg-[#2BB673]/10 text-[#2BB673] font-medium border border-[#2BB673]/30'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      {t('scheduleLater')}
                    </button>
                  </div>

                  {scheduleMode === 'schedule' && (
                    <div className="flex gap-2 mt-3">
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2BB673]/30 focus:border-[#2BB673]"
                      />
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-28 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2BB673]/30 focus:border-[#2BB673]"
                      />
                    </div>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
                  </div>
                )}
              </div>

              {/* Right: Preview */}
              <div className="w-[340px] flex-shrink-0 overflow-y-auto px-5 py-5 bg-gray-50/50">
                {/* Format selector */}
                <div className="flex items-center gap-2 mb-4">
                  <select
                    value={previewFormat}
                    onChange={(e) => setPreviewFormat(e.target.value as PreviewFormat)}
                    className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#2BB673]/30"
                  >
                    <option value="fb_feed">Facebook Feed</option>
                    <option value="ig_feed">Instagram Feed</option>
                    <option value="ig_stories">Instagram Stories</option>
                    {isVideo && <option value="ig_reels">Instagram Reels</option>}
                  </select>

                  {/* Device toggle (for FB feed) */}
                  {previewFormat === 'fb_feed' && (
                    <div className="flex gap-0.5 bg-white border border-gray-200 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('desktop')}
                        className={`p-1 rounded ${previewDevice === 'desktop' ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}
                      >
                        <Monitor className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('mobile')}
                        className={`p-1 rounded ${previewDevice === 'mobile' ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Preview card */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  {/* Preview header */}
                  {(previewFormat === 'fb_feed' || previewFormat === 'ig_feed') && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5">
                      {firstSelectedTarget?.pageImageUrl ? (
                        <img src={firstSelectedTarget.pageImageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                          {previewFormat === 'fb_feed' ? (
                            <Facebook className="w-4 h-4 text-[#1877F2]" />
                          ) : (
                            <Instagram className="w-4 h-4 text-[#E4405F]" />
                          )}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-gray-900">
                          {previewFormat === 'fb_feed'
                            ? firstSelectedTarget?.pageName || 'Page'
                            : firstSelectedTarget?.instagram?.username || 'username'}
                        </p>
                        {previewFormat === 'fb_feed' && (
                          <p className="text-[10px] text-gray-400">Just now</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Media preview */}
                  <div
                    className="relative bg-gray-100 overflow-hidden"
                    style={getPreviewStyle()}
                  >
                    {item.type === 'video' ? (
                      <video
                        src={item.url}
                        className="absolute inset-0 w-full h-full object-cover"
                        muted
                        loop
                        autoPlay
                        playsInline
                      />
                    ) : (
                      <img
                        src={item.url}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}

                    {/* Stories/Reels overlay */}
                    {(previewFormat === 'ig_stories' || previewFormat === 'ig_reels') && firstSelectedTarget?.instagram && (
                      <div className="absolute top-3 left-3 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full border-2 border-white overflow-hidden">
                          {firstSelectedTarget.instagram.profilePictureUrl ? (
                            <img src={firstSelectedTarget.instagram.profilePictureUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-[#E4405F]/20 flex items-center justify-center">
                              <Instagram className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-medium text-white drop-shadow">
                          {firstSelectedTarget.instagram.username}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Feed engagement bar */}
                  {previewFormat === 'ig_feed' && (
                    <div className="flex items-center gap-4 px-3 py-2">
                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </div>
                  )}

                  {previewFormat === 'fb_feed' && (
                    <div className="flex border-t border-gray-100">
                      <button type="button" className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500">
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                        </svg>
                        Like
                      </button>
                      <button type="button" className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500">
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Comment
                      </button>
                      <button type="button" className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500">
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                        Share
                      </button>
                    </div>
                  )}
                </div>

                {/* Caption preview */}
                {!onlyIgStories && (captionCommon || captionFb || captionIg) && (
                  <div className="mt-3 px-1">
                    <p className="text-xs text-gray-600 line-clamp-3">
                      {previewFormat.startsWith('fb')
                        ? (customizeCaption ? captionFb : captionCommon)
                        : (customizeCaption ? captionIg : captionCommon)}
                    </p>
                  </div>
                )}

                {/* Schedule info */}
                {scheduleMode === 'schedule' && scheduleDate && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    {scheduleDate} {scheduleTime || ''}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={onClose}
                disabled={isPublishing}
                className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing || !hasAnySelected}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2BB673] text-white text-sm font-medium rounded-xl hover:bg-[#25A366] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('publishing')}
                  </>
                ) : scheduleMode === 'schedule' ? (
                  <>
                    <Calendar className="w-4 h-4" />
                    {t('scheduleButton')}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t('publishButton')}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
