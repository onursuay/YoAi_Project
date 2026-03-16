'use client'

import { useState } from 'react'
import type { WizardState } from './types'
import { getLocaleFromCookie, getWizardTranslations } from '@/lib/i18n/wizardTranslations'
import { getCtaLabel } from '@/lib/meta/ctaLabels'

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
  conversionLocation?: string
}

export default function AdPreview({ state, placement = 'facebook_feed', onPlacementChange, conversionLocation = 'WEBSITE' }: AdPreviewProps) {
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
                  {(state.callToAction || ['MESSENGER','WHATSAPP','INSTAGRAM_DIRECT'].includes(conversionLocation)) && (
                    <div className="mt-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded inline-flex items-center gap-1">
                      {conversionLocation === 'WHATSAPP' && (
                        <svg className="h-3 w-3 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.115.553 4.103 1.523 5.827L.057 23.928l6.266-1.443A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.667-.5-5.207-1.377l-.373-.221-3.861.889.924-3.768-.243-.389A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                        </svg>
                      )}
                      {conversionLocation === 'MESSENGER' && (
                        <svg className="h-3 w-3 shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.733 8l3.13 3.259L19.752 8l-6.559 6.963z"/>
                        </svg>
                      )}
                      {conversionLocation === 'INSTAGRAM_DIRECT' && (
                        <svg className="h-3 w-3 shrink-0 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                      )}
                      <span>
                        {['MESSENGER','WHATSAPP','INSTAGRAM_DIRECT'].includes(conversionLocation)
                          ? 'Mesaj Gönder'
                          : getCtaLabel(state.callToAction)}
                      </span>
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
                  {(state.callToAction || ['MESSENGER', 'WHATSAPP', 'INSTAGRAM_DIRECT'].includes(conversionLocation)) && (
                    <div className="mt-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded inline-flex items-center gap-1">
                      {conversionLocation === 'WHATSAPP' && (
                        <svg className="h-3 w-3 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.115.553 4.103 1.523 5.827L.057 23.928l6.266-1.443A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.667-.5-5.207-1.377l-.373-.221-3.861.889.924-3.768-.243-.389A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                        </svg>
                      )}
                      {conversionLocation === 'MESSENGER' && (
                        <svg className="h-3 w-3 shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.733 8l3.13 3.259L19.752 8l-6.559 6.963z"/>
                        </svg>
                      )}
                      {conversionLocation === 'INSTAGRAM_DIRECT' && (
                        <svg className="h-3 w-3 shrink-0 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                      )}
                      <span>
                        {['MESSENGER', 'WHATSAPP', 'INSTAGRAM_DIRECT'].includes(conversionLocation)
                          ? 'Mesaj Gönder'
                          : getCtaLabel(state.callToAction)}
                      </span>
                    </div>
                  )}
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
