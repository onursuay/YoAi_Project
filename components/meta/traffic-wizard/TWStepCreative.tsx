'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  UserCircle, Image as ImageIcon, Film, Layers,
  Upload, Type, Link2, Eye, MousePointerClick,
  Check, AlertCircle, Replace, Trash2,
} from 'lucide-react'
import { getTrafficI18n } from './i18n'
import { CTA_LABEL_TR } from '@/lib/meta/ctaLabels'
import type { TrafficWizardState } from './types'

interface TWStepCreativeProps {
  state: TrafficWizardState
  onChange: (updates: Partial<TrafficWizardState>) => void
}

// Traffic-relevant CTAs
const TRAFFIC_CTAS = [
  'LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'CONTACT_US',
  'APPLY_NOW', 'GET_OFFER', 'BOOK_NOW', 'DOWNLOAD',
  'SUBSCRIBE', 'GET_DIRECTIONS', 'NO_BUTTON',
] as const

export default function TWStepCreative({ state, onChange }: TWStepCreativeProps) {
  const t = getTrafficI18n()
  const ad = state.ad

  const updateAd = (updates: Partial<TrafficWizardState['ad']>) => {
    onChange({ ad: { ...ad, ...updates } })
  }

  // ── Pages / Identity ──
  const [pages, setPages] = useState<PageData[]>([])
  const [pagesLoading, setPagesLoading] = useState(true)
  const pagesFetched = useRef(false)

  useEffect(() => {
    if (pagesFetched.current) return
    pagesFetched.current = true
    fetch('/api/meta/pages')
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.data) {
          const parsed: PageData[] = data.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            picture: p.picture?.data?.url ?? '',
            igId: p.instagram_business_account?.id ?? '',
            igUsername: p.instagram_business_account?.username ?? '',
            igPicture: p.instagram_business_account?.profile_picture_url ?? '',
          }))
          setPages(parsed)
          // Auto-select first page if none selected
          if (parsed.length > 0 && !ad.pageId) {
            const first = parsed[0]
            updateAd({
              pageId: first.id,
              pageName: first.name,
              pageImage: first.picture,
              instagramAccountId: first.igId,
              instagramUsername: first.igUsername,
            })
          }
        }
      })
      .catch(() => {})
      .finally(() => setPagesLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Media upload ──
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback(async (file: File) => {
    setUploading(true)
    setUploadError('')

    const isVideo = file.type.startsWith('video/')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', isVideo ? 'video' : 'image')

    try {
      const res = await fetch('/api/meta/upload-media', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.ok) {
        if (isVideo) {
          updateAd({
            format: 'single_video',
            videoId: data.videoId || '',
            imageHash: '',
            imageUrl: '',
            mediaFileName: file.name,
          })
        } else {
          updateAd({
            format: 'single_image',
            imageHash: data.hash || '',
            imageUrl: data.url || '',
            videoId: '',
            mediaFileName: file.name,
          })
        }
      } else {
        setUploadError(data.message || t.mediaUploadError)
      }
    } catch {
      setUploadError(t.mediaUploadError)
    } finally {
      setUploading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad])

  const hasMedia = !!(ad.imageHash || ad.videoId)
  const isUrlValid = !ad.destinationUrl || ad.destinationUrl.startsWith('http://') || ad.destinationUrl.startsWith('https://')

  // ── Preview placement ──
  const [previewPlacement, setPreviewPlacement] = useState<'facebook' | 'instagram'>('facebook')

  return (
    <div className="space-y-8">

      {/* ═══════════════════════════════════════════════
          SECTION 1: Identity
          ═══════════════════════════════════════════════ */}
      <Section
        icon={<UserCircle className="w-[18px] h-[18px]" />}
        title={t.sectionIdentity}
        description={t.sectionIdentityDesc}
      >
        {/* Ad Name */}
        <div className="mb-5 pb-5 border-b border-gray-100">
          <label className="block text-sm font-medium text-gray-800 mb-1.5">
            {t.adNameLabel} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={ad.name}
            onChange={e => updateAd({ name: e.target.value })}
            placeholder={t.adNamePlaceholder}
            maxLength={256}
            className={`w-full px-4 py-3 border rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
              ad.name.trim() ? 'border-primary bg-primary/[0.02]' : 'border-gray-300'
            }`}
          />
        </div>

        {/* Facebook Page */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            {t.identityPage}
          </label>
          {pagesLoading ? (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <span className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
              <span className="text-xs text-gray-500">{t.identityPageLoading}</span>
            </div>
          ) : pages.length === 0 ? (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-xs text-amber-700">{t.identityPageNone}</span>
            </div>
          ) : (
            <div className="space-y-2">
              {pages.map(page => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => updateAd({
                    pageId: page.id,
                    pageName: page.name,
                    pageImage: page.picture,
                    instagramAccountId: page.igId,
                    instagramUsername: page.igUsername,
                  })}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    ad.pageId === page.id
                      ? 'border-primary bg-primary/[0.03] shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {page.picture ? (
                    <img src={page.picture} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <UserCircle className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-gray-900 block truncate">{page.name}</span>
                    {page.igUsername && (
                      <span className="text-[11px] text-gray-500">@{page.igUsername}</span>
                    )}
                  </div>
                  {ad.pageId === page.id && (
                    <Check className="w-4 h-4 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Instagram Account */}
        {ad.pageId && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              {t.identityInstagram}
            </label>
            {ad.instagramAccountId ? (
              <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-100 rounded-lg">
                <Check className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="text-sm text-purple-800 font-medium">@{ad.instagramUsername}</span>
                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded text-[10px] font-medium">
                  {t.identityInstagramLinked}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-100 rounded-lg">
                <span className="text-xs text-gray-500">{t.identityInstagramNone}</span>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ═══════════════════════════════════════════════
          SECTION 2: Format
          ═══════════════════════════════════════════════ */}
      <Section
        icon={<Layers className="w-[18px] h-[18px]" />}
        title={t.sectionFormat}
        description={t.sectionFormatDesc}
      >
        <div className="grid grid-cols-3 gap-3">
          <FormatCard
            selected={ad.format === 'single_image'}
            onClick={() => updateAd({ format: 'single_image' })}
            icon={<ImageIcon className="w-5 h-5" />}
            title={t.formatSingleImage}
            badge={t.formatActive}
            badgeColor="green"
          />
          <FormatCard
            selected={ad.format === 'single_video'}
            onClick={() => updateAd({ format: 'single_video' })}
            icon={<Film className="w-5 h-5" />}
            title={t.formatSingleVideo}
            badge={t.formatActive}
            badgeColor="green"
          />
          <FormatCard
            selected={false}
            onClick={() => {}}
            icon={<Layers className="w-5 h-5" />}
            title={t.formatCarousel}
            badge={t.formatComingSoon}
            badgeColor="gray"
            disabled
          />
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════
          SECTION 3: Media
          ═══════════════════════════════════════════════ */}
      <Section
        icon={<Upload className="w-[18px] h-[18px]" />}
        title={t.sectionMedia}
        description={t.sectionMediaDesc}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleFileChange(f)
            e.target.value = ''
          }}
        />

        {uploading ? (
          <div className="border-2 border-dashed border-primary/40 rounded-xl p-8 flex flex-col items-center gap-3 bg-primary/[0.02]">
            <span className="w-8 h-8 border-[3px] border-gray-200 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-gray-500 font-medium">{t.mediaUploading}</p>
          </div>
        ) : hasMedia ? (
          <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
            {/* Preview */}
            {ad.imageUrl ? (
              <div className="relative bg-gray-100">
                <img src={ad.imageUrl} alt="" className="w-full max-h-64 object-contain" />
              </div>
            ) : ad.videoId ? (
              <div className="bg-gray-900 flex items-center justify-center h-48">
                <Film className="w-12 h-12 text-white/40" />
              </div>
            ) : null}

            {/* File info + actions */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-t border-gray-100">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 font-medium truncate">{ad.mediaFileName}</p>
                <p className="text-[11px] text-gray-400">
                  {ad.format === 'single_video' ? 'Video' : 'Image'}
                  {ad.imageHash ? ` · #${ad.imageHash.slice(0, 8)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
              >
                <Replace className="w-3 h-3" />
                {t.mediaReplace}
              </button>
              <button
                type="button"
                onClick={() => updateAd({ imageHash: '', imageUrl: '', videoId: '', mediaFileName: '' })}
                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                {t.mediaRemove}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const f = e.dataTransfer.files?.[0]
              if (f) handleFileChange(f)
            }}
            className="w-full border-2 border-dashed border-gray-300 hover:border-primary/40 rounded-xl p-10 flex flex-col items-center gap-3 transition-colors group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
              <Upload className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm text-gray-500 font-medium">{t.mediaUploadArea}</p>
            <p className="text-xs text-gray-400">{t.mediaUploadHint}</p>
          </button>
        )}

        {uploadError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mt-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-xs text-red-600 flex-1">{uploadError}</span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              {t.mediaUploadRetry}
            </button>
          </div>
        )}
      </Section>

      {/* ═══════════════════════════════════════════════
          SECTION 4: Ad Text
          ═══════════════════════════════════════════════ */}
      <Section
        icon={<Type className="w-[18px] h-[18px]" />}
        title={t.sectionAdText}
        description={t.sectionAdTextDesc}
      >
        <div className="space-y-5">
          {/* Primary Text */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              {t.adTextPrimary}
            </label>
            <textarea
              value={ad.primaryText}
              onChange={e => updateAd({ primaryText: e.target.value })}
              placeholder={t.adTextPrimaryPlaceholder}
              rows={4}
              maxLength={3000}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <div className="flex justify-between mt-1">
              <p className="text-[11px] text-gray-400">{t.adTextPrimaryHint}</p>
              <p className={`text-[11px] ${ad.primaryText.length > 2500 ? 'text-amber-500' : 'text-gray-400'}`}>
                {ad.primaryText.length}/3000
              </p>
            </div>
          </div>

          {/* Headline */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              {t.adTextHeadline}
            </label>
            <input
              type="text"
              value={ad.headline}
              onChange={e => updateAd({ headline: e.target.value })}
              placeholder={t.adTextHeadlinePlaceholder}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <div className="flex justify-between mt-1">
              <p className="text-[11px] text-gray-400">{t.adTextHeadlineHint}</p>
              <p className={`text-[11px] ${ad.headline.length > 40 ? 'text-amber-500' : 'text-gray-400'}`}>
                {ad.headline.length}/40
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              {t.adTextDescription}
            </label>
            <input
              type="text"
              value={ad.description}
              onChange={e => updateAd({ description: e.target.value })}
              placeholder={t.adTextDescriptionPlaceholder}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <div className="flex justify-between mt-1">
              <p className="text-[11px] text-gray-400">{t.adTextDescriptionHint}</p>
              <p className={`text-[11px] ${ad.description.length > 30 ? 'text-amber-500' : 'text-gray-400'}`}>
                {ad.description.length}/30
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════
          SECTION 5: Destination & CTA
          ═══════════════════════════════════════════════ */}
      <Section
        icon={<Link2 className="w-[18px] h-[18px]" />}
        title={t.sectionAdDestination}
        description={t.sectionAdDestinationDesc}
      >
        <div className="space-y-5">
          {/* Destination URL */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              {t.adDestinationUrl}
            </label>
            <input
              type="url"
              value={ad.destinationUrl}
              onChange={e => updateAd({ destinationUrl: e.target.value })}
              placeholder={t.adDestinationUrlPlaceholder}
              className={`w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                ad.destinationUrl && !isUrlValid ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {ad.destinationUrl && !isUrlValid ? (
              <p className="mt-1 text-[11px] text-red-500">{t.adDestinationUrlInvalid}</p>
            ) : (
              <p className="mt-1 text-[11px] text-gray-400">{t.adDestinationUrlHint}</p>
            )}
          </div>

          {/* Display URL */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              {t.adDisplayUrl}
            </label>
            <input
              type="text"
              value={ad.displayUrl}
              onChange={e => updateAd({ displayUrl: e.target.value })}
              placeholder={t.adDisplayUrlPlaceholder}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p className="mt-1 text-[11px] text-gray-400">{t.adDisplayUrlHint}</p>
          </div>

          {/* CTA */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              <div className="flex items-center gap-1.5">
                <MousePointerClick className="w-3.5 h-3.5" />
                {t.adCtaLabel}
              </div>
            </label>
            <select
              value={ad.callToAction}
              onChange={e => updateAd({ callToAction: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {TRAFFIC_CTAS.map(cta => (
                <option key={cta} value={cta}>
                  {CTA_LABEL_TR[cta] ?? cta}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════
          SECTION 6: Preview
          ═══════════════════════════════════════════════ */}
      <Section
        icon={<Eye className="w-[18px] h-[18px]" />}
        title={t.sectionPreview}
        description={t.sectionPreviewDesc}
      >
        {/* Placement tabs */}
        <div className="flex gap-2 mb-4">
          <PlacementTab
            active={previewPlacement === 'facebook'}
            onClick={() => setPreviewPlacement('facebook')}
            label={t.previewFacebookFeed}
          />
          <PlacementTab
            active={previewPlacement === 'instagram'}
            onClick={() => setPreviewPlacement('instagram')}
            label={t.previewInstagramFeed}
          />
        </div>

        {/* Preview card */}
        {!hasMedia && !ad.primaryText && !ad.headline ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
            <Eye className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{t.previewEmpty}</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white max-w-sm mx-auto shadow-sm">
            {/* Header — page identity */}
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              {ad.pageImage ? (
                <img src={ad.pageImage} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <UserCircle className="w-4 h-4 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {ad.pageName || 'Page Name'}
                </p>
                <p className="text-[10px] text-gray-400">{t.previewSponsored}</p>
              </div>
            </div>

            {/* Primary text */}
            {ad.primaryText && (
              <div className="px-3 pb-2">
                <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">
                  {ad.primaryText}
                </p>
              </div>
            )}

            {/* Media */}
            {ad.imageUrl ? (
              <img src={ad.imageUrl} alt="" className="w-full aspect-square object-cover" />
            ) : ad.videoId ? (
              <div className="w-full aspect-video bg-gray-900 flex items-center justify-center">
                <Film className="w-10 h-10 text-white/30" />
              </div>
            ) : (
              <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
                <ImageIcon className="w-10 h-10 text-gray-300" />
              </div>
            )}

            {/* Bottom — headline, description, CTA */}
            <div className="px-3 py-3 bg-gray-50 border-t border-gray-100">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {ad.displayUrl && (
                    <p className="text-[10px] text-gray-400 uppercase truncate">{ad.displayUrl}</p>
                  )}
                  {ad.headline && (
                    <p className="text-xs font-semibold text-gray-900 truncate">{ad.headline}</p>
                  )}
                  {ad.description && (
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{ad.description}</p>
                  )}
                </div>
                {ad.callToAction && ad.callToAction !== 'NO_BUTTON' && (
                  <span className="shrink-0 px-3 py-1.5 bg-gray-200 text-gray-700 text-[11px] font-semibold rounded-md whitespace-nowrap">
                    {CTA_LABEL_TR[ad.callToAction] ?? ad.callToAction}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}

/* ── Types ── */

interface PageData {
  id: string
  name: string
  picture: string
  igId: string
  igUsername: string
  igPicture: string
}

/* ── Sub-components ── */

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start gap-3 mb-5">
        <span className="mt-0.5 text-gray-400">{icon}</span>
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function FormatCard({
  selected,
  onClick,
  icon,
  title,
  badge,
  badgeColor,
  disabled,
}: {
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  badge: string
  badgeColor: 'green' | 'gray'
  disabled?: boolean
}) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-600',
    gray: 'bg-gray-100 text-gray-400',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-center p-4 rounded-xl border-2 transition-all ${
        disabled
          ? 'border-gray-100 bg-gray-50/50 cursor-not-allowed opacity-60'
          : selected
          ? 'border-primary bg-primary/[0.03] shadow-sm'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2 ${
        disabled ? 'bg-gray-100 text-gray-400' : selected ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'
      }`}>
        {icon}
      </div>
      <span className={`text-xs font-semibold block ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>{title}</span>
      <span className={`mt-1 inline-block px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide ${colors[badgeColor]}`}>
        {badge}
      </span>
    </button>
  )
}

function PlacementTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
        active
          ? 'bg-primary/10 text-primary border border-primary/30'
          : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400'
      }`}
    >
      {label}
    </button>
  )
}
