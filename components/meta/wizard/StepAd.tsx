'use client'

import { useState } from 'react'
import type { WizardState } from './types'
import MediaUploader from './MediaUploader'
import CarouselEditor, { type CarouselCard } from './CarouselEditor'
import AdTextFields from './AdTextFields'
import AdPreview from './AdPreview'
import ExistingPostSelector from './ExistingPostSelector'
import { getWizardTranslations, getLocaleFromCookie } from '@/lib/i18n/wizardTranslations'

interface DiscoveryPatch {
  requiredFieldsAdded: string[]
  invalidCombination?: boolean
  notes?: string
}

/** Lead form listesi — inventory.lead_forms[page_id] */
type LeadFormItem = { form_id: string; name: string; status: string }

interface StepAdProps {
  state: WizardState['ad']
  campaignObjective?: string
  conversionLocation?: string
  optimizationGoal?: string
  pageId?: string
  instagramAccountId?: string
  inventory?: { lead_forms?: Record<string, LeadFormItem[]> } | null
  pixels?: { pixel_id: string; name: string }[]
  onChange: (updates: Partial<WizardState['ad']>) => void
  errors?: Record<string, string>
  discoveryPatch?: DiscoveryPatch | null
}

export default function StepAd({ state, campaignObjective = 'OUTCOME_TRAFFIC', conversionLocation = 'website', optimizationGoal = 'LINK_CLICKS', pageId, instagramAccountId, inventory, pixels = [], onChange, errors = {}, discoveryPatch }: StepAdProps) {
  const locale = getLocaleFromCookie()
  const t = getWizardTranslations(locale)
  const [previewPlacement, setPreviewPlacement] = useState('facebook_feed')
  const [urlParamModalOpen, setUrlParamModalOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [draftParams, setDraftParams] = useState({ utmSource: '', utmMedium: '', utmCampaign: '', utmContent: '' })
  const [showExistingPostModal, setShowExistingPostModal] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<'both' | 'facebook' | 'instagram'>('both')
  const isLeads = campaignObjective === 'OUTCOME_LEADS'
  const isLeadsOnAd = isLeads && conversionLocation === 'ON_AD'
  const isLeadsMessaging =
    isLeads && (conversionLocation === 'MESSENGER' || conversionLocation === 'WHATSAPP')
  const isLeadsCall = isLeads && conversionLocation === 'CALL'
  const isEngagementMessaging =
    campaignObjective === 'OUTCOME_ENGAGEMENT' &&
    (conversionLocation === 'MESSENGER' || conversionLocation === 'WHATSAPP')
  const isSalesMessaging =
    campaignObjective === 'OUTCOME_SALES' &&
    (conversionLocation === 'MESSENGER' || conversionLocation === 'WHATSAPP')
  const isEngagementCall = campaignObjective === 'OUTCOME_ENGAGEMENT' && conversionLocation === 'CALL'
  const isMessaging = conversionLocation === 'MESSENGER' || conversionLocation === 'WHATSAPP' || conversionLocation === 'INSTAGRAM_DIRECT'
  const isCall = conversionLocation === 'CALL'
  const isOnAd = conversionLocation === 'ON_AD'
  const isOnPage = conversionLocation === 'ON_PAGE'
  const isApp = conversionLocation === 'APP' || campaignObjective === 'OUTCOME_APP_PROMOTION'
  const isCatalog = conversionLocation === 'CATALOG'
  const isAppPromotion = campaignObjective === 'OUTCOME_APP_PROMOTION'

  const pageLeadForms = (pageId && inventory?.lead_forms?.[pageId]) || []
  const activeLeadForms = pageLeadForms.filter((f) => f.status === 'ACTIVE')

  const handleMediaChange = (
    file: File | null,
    preview: string,
    extra?: { hash?: string; videoId?: string }
  ) => {
    onChange({
      media: {
        file: file ?? null,
        preview,
        hash: extra?.hash,
        videoId: extra?.videoId,
      },
    })
  }

  const handleCarouselChange = (cards: CarouselCard[]) => {
    onChange({
      carouselCards: cards.map((c) => ({
        media: c.media,
        preview: c.preview,
        headline: c.headline,
        description: c.description,
        link: c.link,
      })),
    })
  }

  const handleCarouselMediaChange = (index: number, file: File | null, preview: string) => {
    const next = [...state.carouselCards]
    if (!next[index]) return
    next[index] = { ...next[index], media: file, preview }
    onChange({ carouselCards: next })
  }

  const defaultCarouselCards: CarouselCard[] = [
    { media: null, headline: '', description: '', link: '' },
    { media: null, headline: '', description: '', link: '' },
  ]

  return (
    <div className="flex gap-8 items-start">
      <div className="flex-1 space-y-4">
        <div className="light-sweep-wrapper rounded-md w-fit">
          <h3 className="text-lg font-semibold text-gray-900">{t.adCreative}</h3>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {t.adName} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={state.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={t.adNamePlaceholder}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        {/* 2-Column Layout: Reklam Kurulumu | Reklam Formatı/Platform */}
        <div className="grid grid-cols-2 gap-4">
          {/* Left Column: Reklam Kurulumu */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{t.adCreationMode}</label>
            <select
              value={state.adCreationMode}
              onChange={(e) => {
                const mode = e.target.value as 'create' | 'existing'
                onChange({ adCreationMode: mode, existingPostId: mode === 'create' ? undefined : state.existingPostId })
              }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            >
              <option value="create">{t.createNewAd}</option>
              <option value="existing">{t.useExistingPost}</option>
            </select>
          </div>

          {/* Right Column: Conditional (Format or Platform) */}
          {state.adCreationMode === 'create' ? (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{t.adFormat}</label>
              <select
                value={state.format}
                onChange={(e) => {
                  const format = e.target.value as 'single_image' | 'single_video' | 'carousel'
                  onChange({
                    format,
                    media: format === 'carousel' ? state.media : { file: null, preview: '' },
                    carouselCards: format === 'carousel' ? (state.carouselCards.length >= 2 ? state.carouselCards : defaultCarouselCards) : [],
                  })
                }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              >
                <option value="single_image">{t.singleImage}</option>
                <option value="single_video">{t.singleVideo}</option>
                <option value="carousel">{t.carousel}</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {locale === 'tr' ? 'Platform Seçin' : 'Select Platform'}
              </label>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value as 'both' | 'facebook' | 'instagram')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              >
                <option value="both">{locale === 'tr' ? 'Tümü' : 'All'}</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
              </select>
            </div>
          )}
        </div>

        {/* Existing Post: Post Selector & CTA */}
        {state.adCreationMode === 'existing' && (
          <>
            <div>
              <button
                type="button"
                onClick={() => setShowExistingPostModal(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary hover:bg-gray-50 transition-colors text-sm text-left text-gray-500"
              >
                {state.existingPostId ? (
                  <span className="text-primary font-medium">
                    ✓ {locale === 'tr' ? 'Gönderi Seçildi' : 'Post Selected'}
                  </span>
                ) : (
                  <span className="text-gray-400">
                    {locale === 'tr' ? '[Paylaşılmış Gönderiyi Seçin]' : '[Select Published Post]'}
                  </span>
                )}
              </button>
              {errors.existing_post && <p className="mt-1 text-sm text-red-600">{errors.existing_post}</p>}
            </div>

            {/* CTA Button for Existing Post */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t.ctaButton}
              </label>
              <select
                value={state.callToAction}
                onChange={(e) => onChange({ callToAction: e.target.value, websiteUrl: e.target.value ? state.websiteUrl : '' })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              >
                <option value="">{locale === 'tr' ? 'Seçim Yapılmadı' : 'No Selection'}</option>
                <option value="LEARN_MORE">{locale === 'tr' ? 'Daha Fazla Bilgi' : 'Learn More'}</option>
                <option value="SHOP_NOW">{locale === 'tr' ? 'Hemen Alışveriş Yap' : 'Shop Now'}</option>
                <option value="SIGN_UP">{locale === 'tr' ? 'Kaydol' : 'Sign Up'}</option>
                <option value="DOWNLOAD">{locale === 'tr' ? 'İndir' : 'Download'}</option>
                <option value="WATCH_MORE">{locale === 'tr' ? 'Daha Fazla İzle' : 'Watch More'}</option>
                <option value="CONTACT_US">{locale === 'tr' ? 'Bize Ulaşın' : 'Contact Us'}</option>
                <option value="APPLY_NOW">{locale === 'tr' ? 'Hemen Başvur' : 'Apply Now'}</option>
                <option value="BOOK_NOW">{locale === 'tr' ? 'Rezervasyon Yap' : 'Book Now'}</option>
                <option value="GET_QUOTE">{locale === 'tr' ? 'Teklif Al' : 'Get Quote'}</option>
                <option value="SUBSCRIBE">{locale === 'tr' ? 'Abone Ol' : 'Subscribe'}</option>
              </select>
            </div>

            {/* Website URL - Only shown when CTA is selected */}
            {state.callToAction && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t.websiteUrl} <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={state.websiteUrl}
                  onChange={(e) => onChange({ websiteUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
                {errors.websiteUrl && <p className="mt-1 text-sm text-red-600">{errors.websiteUrl}</p>}
              </div>
            )}
          </>
        )}

        {/* Leads + MESSENGER/WHATSAPP: Karşılama mesajı zorunlu */}
        {isLeadsMessaging && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.chatGreetingLabel} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={state.chatGreeting ?? ''}
              onChange={(e) => onChange({ chatGreeting: e.target.value || undefined })}
              placeholder={t.chatGreetingPlaceholder}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
            {errors.chat_greeting && <p className="mt-1 text-sm text-red-600">{errors.chat_greeting}</p>}
          </div>
        )}

        {/* Leads + CALL: Telefon numarası zorunlu */}
        {isLeadsCall && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.phoneNumberLabel} <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={state.phoneNumber ?? ''}
              onChange={(e) => onChange({ phoneNumber: e.target.value || undefined })}
              placeholder={t.phoneNumberPlaceholder}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
            {errors.phone_number && <p className="mt-1 text-sm text-red-600">{errors.phone_number}</p>}
          </div>
        )}

        {/* Media Upload - Only for 'create' mode */}
        {state.adCreationMode === 'create' && (
          <>
            {state.format === 'single_image' && (
              <MediaUploader
                type="image"
                maxSizeMB={30}
                preview={state.media.preview}
                onFileSelect={handleMediaChange}
                label={t.uploadImage}
              />
            )}
            {state.format === 'single_video' && (
              <MediaUploader
                type="video"
                maxSizeMB={4096}
                preview={state.media.preview}
                onFileSelect={handleMediaChange}
                label={t.uploadVideo}
              />
            )}
            {state.format === 'carousel' && (
              <CarouselEditor
                cards={state.carouselCards}
                onChange={handleCarouselChange}
                onCardMediaChange={handleCarouselMediaChange}
              />
            )}
          </>
        )}

        {/* Ad Text Fields - Only for 'create' mode */}
        {state.adCreationMode === 'create' && (
          <AdTextFields
            state={state}
            campaignObjective={campaignObjective}
            conversionLocation={conversionLocation}
            optimizationGoal={optimizationGoal}
            onChange={onChange}
            errors={errors}
            isMessaging={isMessaging}
            isCall={isCall}
            isOnPage={isOnPage}
            isOnAd={isOnAd}
            isAppPromotion={isAppPromotion}
            isCatalog={isCatalog}
            isLeadsOnAd={isLeadsOnAd}
            activeLeadForms={activeLeadForms}
          />
        )}

        {isAppPromotion && state.adCreationMode === 'create' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Deep Link URL <span className="text-caption text-gray-400">{t.deepLinkOptional}</span>
            </label>
            <input
              type="url"
              value={state.deepLinkUrl ?? ''}
              onChange={(e) => onChange({ deepLinkUrl: e.target.value || undefined })}
              placeholder="myapp://screen/product"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
          </div>
        )}

        {/* Engagement + MESSENGER/WHATSAPP: Karşılama mesajı zorunlu */}
        {isEngagementMessaging && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.chatGreetingLabel} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={state.chatGreeting ?? ''}
              onChange={(e) => onChange({ chatGreeting: e.target.value || undefined })}
              placeholder={t.chatGreetingPlaceholder}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
            {errors.chat_greeting && <p className="mt-1 text-sm text-red-600">{errors.chat_greeting}</p>}
          </div>
        )}

        {/* Sales + MESSENGER/WHATSAPP: Karşılama mesajı zorunlu */}
        {isSalesMessaging && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.chatGreetingLabel} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={state.chatGreeting ?? ''}
              onChange={(e) => onChange({ chatGreeting: e.target.value || undefined })}
              placeholder={t.chatGreetingPlaceholder}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
            {errors.chat_greeting && <p className="mt-1 text-sm text-red-600">{errors.chat_greeting}</p>}
          </div>
        )}

        {/* Engagement + CALL: Telefon numarası zorunlu */}
        {isEngagementCall && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.phoneNumberLabel} <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={state.phoneNumber ?? ''}
              onChange={(e) => onChange({ phoneNumber: e.target.value || undefined })}
              placeholder={t.phoneNumberPlaceholder}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
            {errors.phone_number && <p className="mt-1 text-sm text-red-600">{errors.phone_number}</p>}
          </div>
        )}

        {/* Takip */}
        <div className="pt-6 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 className="text-sm font-semibold text-gray-900">{t.trackingLabel}</h3>
          </div>
          <p className="text-caption text-gray-500 mb-3">{t.trackingDesc}</p>

          {/* İnternet sitesi olayları (Pixel) */}
          {pixels.length > 0 && (
            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 mb-3">
              <input
                type="checkbox"
                checked={!!state.pixelId}
                onChange={(e) => onChange({ pixelId: e.target.checked ? pixels[0]?.pixel_id : undefined })}
                className="mt-0.5 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">{t.websiteEvents}</span>
                {state.pixelId ? (
                  <div className="mt-1">
                    <select
                      value={state.pixelId}
                      onChange={(e) => onChange({ pixelId: e.target.value || undefined })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary"
                    >
                      {pixels.map((p) => (
                        <option key={p.pixel_id} value={p.pixel_id}>
                          {p.name || p.pixel_id}
                        </option>
                      ))}
                    </select>
                    <p className="mt-0.5 text-caption text-gray-400">Pixel ID: {state.pixelId}</p>
                  </div>
                ) : (
                  <p className="text-caption text-gray-400 mt-0.5">{t.enableToActivate}</p>
                )}
              </div>
            </label>
          )}

          {/* URL Parametreleri */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">{t.urlParametersLabel}</span>
              <button
                type="button"
                onClick={() => {
                  setDraftParams({
                    utmSource: state.urlParameters?.utmSource ?? '',
                    utmMedium: state.urlParameters?.utmMedium ?? '',
                    utmCampaign: state.urlParameters?.utmCampaign ?? '',
                    utmContent: state.urlParameters?.utmContent ?? '',
                  })
                  setUrlParamModalOpen(true)
                }}
                className="text-sm text-primary hover:underline"
              >
                {t.createUrlParameter}
              </button>
            </div>
            {(() => {
              const p = state.urlParameters
              const hasParams = p && (p.utmSource || p.utmMedium || p.utmCampaign || p.utmContent)
              if (!hasParams) return null
              const parts: string[] = []
              if (p.utmSource)   parts.push(`utm_source=${p.utmSource}`)
              if (p.utmMedium)   parts.push(`utm_medium=${p.utmMedium}`)
              if (p.utmCampaign) parts.push(`utm_campaign=${p.utmCampaign}`)
              if (p.utmContent)  parts.push(`utm_content=${p.utmContent}`)
              return (
                <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-mono break-all w-full">
                  {parts.join('&')}
                </p>
              )
            })()}
          </div>
        </div>

        {/* URL Parametresi Modal */}
        {urlParamModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setUrlParamModalOpen(false); setActiveDropdown(null) }}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => { setUrlParamModalOpen(false); setActiveDropdown(null) }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <h2 className="text-base font-semibold text-gray-900 mb-1">{t.urlParamModalTitle}</h2>
              <p className="text-caption text-gray-500 mb-4">
                {t.urlParamModalDesc}
                <code className="bg-gray-100 px-1 rounded text-xs">{'{{ad.id}}'}</code>
                {' '}{t.urlParamModalSuffix}
              </p>

              {(() => {
                const DYNAMIC_PARAMS = ['{{campaign.id}}','{{adset.id}}','{{ad.id}}','{{campaign.name}}','{{adset.name}}','{{ad.name}}','{{placement}}','{{site_source_name}}']
                const fields: { key: keyof typeof draftParams; label: string; desc: string }[] = [
                  { key: 'utmSource',   label: t.utmSourceLabel,   desc: t.utmSourceDesc   },
                  { key: 'utmMedium',   label: t.utmMediumLabel,   desc: t.utmMediumDesc   },
                  { key: 'utmCampaign', label: t.utmCampaignLabel, desc: t.utmCampaignDesc },
                  { key: 'utmContent',  label: t.utmContentLabel,  desc: t.utmContentDesc  },
                ]
                const previewParts: string[] = []
                if (draftParams.utmSource)   previewParts.push(`utm_source=${draftParams.utmSource}`)
                if (draftParams.utmMedium)   previewParts.push(`utm_medium=${draftParams.utmMedium}`)
                if (draftParams.utmCampaign) previewParts.push(`utm_campaign=${draftParams.utmCampaign}`)
                if (draftParams.utmContent)  previewParts.push(`utm_content=${draftParams.utmContent}`)
                return (
                  <div className="space-y-4">
                    {fields.map(({ key, label, desc }) => (
                      <div key={key} className="relative">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={draftParams[key]}
                            onChange={(e) => setDraftParams(p => ({ ...p, [key]: e.target.value }))}
                            onFocus={() => setActiveDropdown(key)}
                            placeholder={t.dynamicParamPlaceholder}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                          {activeDropdown === key && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActiveDropdown(null)} />
                              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden">
                                {DYNAMIC_PARAMS.map((param) => (
                                  <button
                                    key={param}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      setDraftParams(p => ({ ...p, [key]: param }))
                                      setActiveDropdown(null)
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-primary/10 hover:text-primary font-mono"
                                  >
                                    {param}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                        <p className="mt-1 text-caption text-gray-400">{desc}</p>
                      </div>
                    ))}

                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">{t.paramPreview}</p>
                      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-caption text-gray-600 font-mono min-h-[36px] break-all">
                        {previewParts.length > 0 ? previewParts.join('&') : <span className="text-gray-300">—</span>}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => { setUrlParamModalOpen(false); setActiveDropdown(null) }}
                        className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        {t.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onChange({ urlParameters: { ...draftParams } })
                          setUrlParamModalOpen(false)
                          setActiveDropdown(null)
                        }}
                        className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
                      >
                        {t.apply}
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>

      <div className="w-80 flex-shrink-0 hidden lg:flex lg:flex-col">
        <div className="light-sweep-wrapper rounded-md w-fit mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{t.adPreviewTitle}</h3>
        </div><AdPreview state={state} placement={previewPlacement} onPlacementChange={setPreviewPlacement} />
      </div>

      {/* Existing Post Selector Modal */}
      {pageId && (
        <ExistingPostSelector
          pageId={pageId}
          instagramAccountId={instagramAccountId}
          platform={selectedPlatform}
          isOpen={showExistingPostModal}
          onClose={() => setShowExistingPostModal(false)}
          onSelect={(postId, post) => {
            onChange({
              existingPostId: postId,
              existingPostData: {
                id: post.id,
                message: post.message,
                caption: post.caption,
                full_picture: post.full_picture,
                media_url: post.media_url,
                thumbnail_url: post.thumbnail_url,
                permalink_url: post.permalink_url,
                type: post.type,
                media_type: post.media_type,
              },
            })
            setShowExistingPostModal(false)
          }}
        />
      )}
    </div>
  )
}
