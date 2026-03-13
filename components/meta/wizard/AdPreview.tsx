'use client'

import { useState } from 'react'
import type { WizardState } from './types'
import { getLocaleFromCookie, getWizardTranslations } from '@/lib/i18n/wizardTranslations'

interface PlacementOption {
  id: string
  label: string
  group: string
  aspectClass: string
  isStory: boolean
}

function getPlacementOptions(locale: string): PlacementOption[] {
  const isEn = locale === 'en'
  return [
    { id: 'facebook_feed',        label: isEn ? 'Facebook Feed'           : 'Facebook Akışı',                group: 'Facebook',  aspectClass: 'aspect-square', isStory: false },
    { id: 'facebook_reels',       label: isEn ? 'Facebook Reels Ads'      : "Facebook Reels'daki Reklamlar", group: 'Facebook',  aspectClass: 'aspect-[9/16]', isStory: true  },
    { id: 'facebook_marketplace', label: isEn ? 'Facebook Marketplace'    : 'Facebook Marketplace',          group: 'Facebook',  aspectClass: 'aspect-square', isStory: false },
    { id: 'facebook_stories',     label: isEn ? 'Facebook Stories'        : 'Facebook Hikayeleri',           group: 'Facebook',  aspectClass: 'aspect-[9/16]', isStory: true  },
    { id: 'facebook_profile',     label: isEn ? 'Facebook Profile Feed'   : 'Facebook Profil Akışı',         group: 'Facebook',  aspectClass: 'aspect-square', isStory: false },
    { id: 'instagram_feed',       label: isEn ? 'Instagram Feed'          : 'Instagram Akışı',               group: 'Instagram', aspectClass: 'aspect-square', isStory: false },
    { id: 'instagram_story',      label: isEn ? 'Instagram Story'         : 'Instagram Story',               group: 'Instagram', aspectClass: 'aspect-[9/16]', isStory: true  },
    { id: 'instagram_reels',      label: isEn ? 'Instagram Reels'         : 'Instagram Reels',               group: 'Instagram', aspectClass: 'aspect-[9/16]', isStory: true  },
    { id: 'instagram_explore',    label: isEn ? 'Instagram Explore Home'  : 'Instagram Keşfet Ana Sayfası',  group: 'Instagram', aspectClass: 'aspect-square', isStory: false },
    { id: 'instagram_profile',    label: isEn ? 'Instagram Profile Feed'  : 'Instagram Profil Akışı',        group: 'Instagram', aspectClass: 'aspect-square', isStory: false },
  ]
}

const GROUPS = ['Facebook', 'Instagram']

interface AdPreviewProps {
  state: WizardState['ad']
  placement?: string
  onPlacementChange?: (id: string) => void
}

export default function AdPreview({ state, placement = 'facebook_feed', onPlacementChange }: AdPreviewProps) {
  const t = getWizardTranslations(getLocaleFromCookie())
  const PLACEMENT_OPTIONS = getPlacementOptions(getLocaleFromCookie())
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(0)

  const current = PLACEMENT_OPTIONS.find(p => p.id === placement) ?? PLACEMENT_OPTIONS[0]

  // Check for existing post preview
  const existingPostPreview = state.adCreationMode === 'existing' && state.existingPostData
  const existingMediaUrl = existingPostPreview
    ? (state.existingPostData?.media_url || state.existingPostData?.full_picture || state.existingPostData?.thumbnail_url)
    : null
  const existingPostText = existingPostPreview
    ? (state.existingPostData?.message || state.existingPostData?.caption || '')
    : ''

  const hasMedia = existingPostPreview
    ? !!existingMediaUrl
    : (state.media.preview || (state.format === 'carousel' && state.carouselCards.length > 0))
  const cards = state.carouselCards ?? []
  const activeCard = cards[Math.min(carouselIndex, cards.length - 1)]

  const handlePlacementSelect = (id: string) => {
    onPlacementChange?.(id)
    setDropdownOpen(false)
    setCarouselIndex(0)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden sticky top-4">

      {/* Placement Dropdown */}
      <div className="p-3 border-b border-gray-200 relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            <span className="truncate">{current.label}</span>
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {dropdownOpen && (
          <>
            {/* backdrop */}
            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
            <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden max-h-72 overflow-y-auto">
              {GROUPS.map(group => (
                <div key={group}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100 sticky top-0">
                    {group}
                  </div>
                  {PLACEMENT_OPTIONS.filter(p => p.group === group).map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePlacementSelect(p.id)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        placement === p.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Preview */}
      <div className="p-3 bg-gray-100 min-h-[280px] flex flex-col items-center justify-center gap-2">
        {hasMedia ? (
          existingPostPreview ? (
            /* ── Existing Post Preview ── */
            <div className="w-full max-w-[260px] rounded-lg overflow-hidden bg-white border border-gray-200">
              <div className={`${current.aspectClass} bg-gray-200 flex items-center justify-center overflow-hidden`}>
                {existingMediaUrl ? (
                  // Check if it's a video post (Instagram media_type or Facebook type)
                  state.existingPostData?.media_type === 'VIDEO' || state.existingPostData?.type === 'video' ? (
                    <video src={existingMediaUrl} className="w-full h-full object-cover" controls muted playsInline />
                  ) : (
                    <img src={existingMediaUrl} alt="Existing Post" className="w-full h-full object-cover" />
                  )
                ) : (
                  <span className="text-gray-400 text-xs">{t.previewHint}</span>
                )}
              </div>
              {!current.isStory && (
                <div className="p-2">
                  <p className="text-caption text-gray-700 line-clamp-2">{existingPostText || t.primaryTextDefault}</p>
                  {state.callToAction && (
                    <div className="mt-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded inline-block">
                      {state.callToAction.replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : state.format === 'carousel' && cards.length > 0 ? (
            /* ── Carousel Preview ── */
            <div className="w-full max-w-[260px] flex flex-col gap-2">
              <div className="rounded-lg overflow-hidden bg-white border border-gray-200">
                <div className={`${current.aspectClass} bg-gray-200 flex items-center justify-center overflow-hidden relative`}>
                  {activeCard?.preview ? (
                    <img src={activeCard.preview} alt={t.previewAlt} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-400 text-xs text-center px-3">{t.carouselFirstCard}</span>
                  )}
                  {/* Kart numarası badge */}
                  <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {carouselIndex + 1}/{cards.length}
                  </div>
                </div>
                {!current.isStory && (
                  <div className="p-2">
                    <p className="text-caption font-semibold truncate">{activeCard?.headline || t.headlineDefault}</p>
                    <p className="text-caption text-gray-500 truncate text-xs">{activeCard?.link || state.primaryText?.slice(0, 40) || ''}</p>
                  </div>
                )}
              </div>

              {/* Navigation */}
              {cards.length > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCarouselIndex(i => Math.max(0, i - 1))}
                    disabled={carouselIndex === 0}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="flex gap-1">
                    {cards.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCarouselIndex(i)}
                        className={`rounded-full transition-all ${
                          i === carouselIndex ? 'w-3 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCarouselIndex(i => Math.min(cards.length - 1, i + 1))}
                    disabled={carouselIndex === cards.length - 1}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── Single Image / Video Preview ── */
            <div className="w-full max-w-[260px] rounded-lg overflow-hidden bg-white border border-gray-200">
              <div className={`${current.aspectClass} bg-gray-200 flex items-center justify-center overflow-hidden`}>
                {state.media.preview ? (
                  state.format === 'single_video' ? (
                    <video src={state.media.preview} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img src={state.media.preview} alt={t.previewAlt} className="w-full h-full object-cover" />
                  )
                ) : (
                  <span className="text-gray-400 text-xs">{t.previewHint}</span>
                )}
              </div>
              {!current.isStory && (
                <div className="p-2">
                  <p className="text-caption font-medium truncate">{state.headline || t.headlineDefault}</p>
                  <p className="text-caption text-gray-500 line-clamp-2">{state.primaryText || t.primaryTextDefault}</p>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-2 text-center px-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <p className="text-sm text-gray-400">{t.previewHint}</p>
          </div>
        )}
      </div>

      <div className="p-2 text-center text-caption text-gray-400 border-t border-gray-200 flex items-center justify-center gap-1">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
        {current.label}
      </div>
    </div>
  )
}
