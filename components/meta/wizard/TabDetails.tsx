'use client'

import * as React from 'react'
import type { WizardState } from './types'
import { getAllowedOptimizationGoals, getAllowedDestinations, hasConversionLocation } from '@/lib/meta/spec/objectiveSpec'
import { getLocaleFromCookie, getWizardTranslations } from '@/lib/i18n/wizardTranslations'
import { getDestinationsWithLockInfo } from '@/lib/meta/capabilityRules'
import type { MetaCapabilities } from '@/lib/meta/capabilityRules'

function mapReasonToKey(reason: string | undefined): 'metaNotConnected' | 'metaPermissionRequired' | 'metaUnknown' {
  if (!reason) return 'metaUnknown'
  const r = reason.toLowerCase()
  if (r.includes('bağlantısı yok') || r.includes('baglantisi yok') || r.includes('not connected')) return 'metaNotConnected'
  if (r.includes('izin') || r.includes('permission')) return 'metaPermissionRequired'
  return 'metaUnknown'
}

interface SearchableSelectOption { value: string; label: string }
function SearchableSelect({ value, onChange, options, placeholder, className }: {
  value: string; onChange: (v: string) => void; options: SearchableSelectOption[];
  placeholder?: string; className?: string
}) {
  const t = getWizardTranslations(getLocaleFromCookie())
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const selected = options.find(o => o.value === value)
  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <button type="button" onClick={() => { setOpen(v => !v); setSearch('') }}
        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-left flex items-center justify-between bg-white focus:ring-2 focus:ring-primary focus:border-transparent">
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>{selected?.label ?? placeholder ?? t.selectPlaceholder}</span>
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div className="p-2 sticky top-0 bg-white border-b">
            <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          {filtered.map(opt => (
            <div key={opt.value} onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${opt.value === value ? 'bg-primary/10 text-primary font-medium' : ''}`}>
              {opt.label}
            </div>
          ))}
          {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">{t.noResults}</div>}
        </div>
      )}
    </div>
  )
}

function getPlacementOptions(t: ReturnType<typeof getWizardTranslations>) {
  return [
    {
      platform: 'facebook',
      label: 'Facebook',
      positions: [
        { value: 'feed', label: t.placementFbFeed },
        { value: 'right_hand_column', label: t.placementFbRightColumn },
        { value: 'marketplace', label: t.placementFbMarketplace },
        { value: 'video_feeds', label: t.placementFbVideoFeeds },
        { value: 'story', label: t.placementFbStory },
        { value: 'search', label: t.placementFbSearch },
        { value: 'reels', label: t.placementFbReels },
      ],
    },
    {
      platform: 'instagram',
      label: 'Instagram',
      positions: [
        { value: 'stream', label: t.placementIgFeed },
        { value: 'story', label: t.placementIgStory },
        { value: 'reels', label: t.placementIgReels },
        { value: 'explore_home', label: t.placementIgExploreHome },
        { value: 'profile_feed', label: t.placementIgProfileFeed },
        { value: 'ig_search', label: t.placementIgSearch },
      ],
    },
    {
      platform: 'audience_network',
      label: 'Audience Network',
      positions: [
        { value: 'classic', label: t.placementAnClassic },
        { value: 'rewarded_video', label: t.placementAnRewardedVideo },
      ],
    },
    {
      platform: 'messenger',
      label: 'Messenger',
      positions: [
        { value: 'messenger_inbox', label: t.placementMsgInbox },
        { value: 'story', label: t.placementMsgStory },
      ],
    },
    {
      platform: 'threads',
      label: 'Threads',
      positions: [
        { value: 'threads_feed', label: t.placementThreadsFeed },
      ],
    },
  ]
}

const ALL_PLACEMENT_KEYS = [
  'facebook:feed','facebook:right_hand_column','facebook:marketplace','facebook:video_feeds','facebook:story','facebook:search','facebook:reels',
  'instagram:stream','instagram:story','instagram:reels','instagram:explore_home','instagram:profile_feed','instagram:ig_search',
  'audience_network:classic','audience_network:rewarded_video',
  'messenger:messenger_inbox','messenger:story',
  'threads:threads_feed',
]

interface TabDetailsProps {
  state: WizardState['adset']
  campaignObjective: string
  onChange: (updates: Partial<WizardState['adset']>) => void
  errors?: Record<string, string>
  pages?: { id: string; name: string }[]
  instagramAccounts?: { id: string; username: string }[]
  pagesLoading?: boolean
  pagesInitialLoadDone?: boolean
  pagesError?: string | null
  instagramLoading?: boolean
  capabilities?: MetaCapabilities | null
  accountInventoryLeadForms?: Record<string, { form_id: string; name: string; status: string }[]>
  /** Real inventory from CampaignWizard — contains page-scoped WhatsApp data after re-fetch */
  accountInventory?: {
    whatsapp_phone_numbers?: { phoneNumberId: string; displayPhone?: string; verifiedName?: string; wabaId?: string }[]
    page_whatsapp_number?: string | null
    page_whatsapp_number_source?: string
  } | null
}

export default function TabDetails({
  state,
  campaignObjective,
  onChange,
  errors = {},
  pages = [],
  instagramAccounts = [],
  pagesLoading = false,
  pagesInitialLoadDone = false,
  pagesError = null,
  instagramLoading = false,
  capabilities = null,
  accountInventoryLeadForms,
  accountInventory = null,
}: TabDetailsProps) {
  const showEmptyPages = pagesInitialLoadDone && !pagesLoading && pages.length === 0 && !pagesError
  const t = getWizardTranslations(getLocaleFromCookie())

  // Destination labels — UPPERCASE keys matching Meta API enum
  const DESTINATION_LABELS: Record<string, string> = {
    WEBSITE: t.destinationWebsite,
    APP: t.destinationApp,
    MESSENGER: t.destinationMessenger,
    WHATSAPP: t.destinationWhatsapp,
    ON_AD:
      campaignObjective === 'OUTCOME_ENGAGEMENT'
        ? t.destinationOnAdEngagement
        : campaignObjective === 'OUTCOME_LEADS'
          ? t.destinationOnAdLeads
          : t.destinationOnAdDefault,
    INSTAGRAM_DIRECT: campaignObjective === 'OUTCOME_TRAFFIC' ? t.destinationInstagramDirectTraffic : t.destinationInstagramDirect,
    PHONE_CALL: t.destinationPhoneCall,
    CALL: t.destinationCall,
    ON_PAGE: t.destinationOnPage,
    CATALOG: t.destinationCatalog,
  }


  const CONVERSION_EVENTS: { value: string; label: string }[] = [
    { value: 'PURCHASE', label: t.convEventPurchase },
    { value: 'ADD_TO_CART', label: t.convEventAddToCart },
    { value: 'INITIATED_CHECKOUT', label: t.convEventCheckout },
    { value: 'ADD_PAYMENT_INFO', label: t.convEventAddPayment },
    { value: 'COMPLETE_REGISTRATION', label: t.convEventRegister },
    { value: 'LEAD', label: t.convEventLead },
    { value: 'CONTENT_VIEW', label: t.convEventViewContent },
    { value: 'SEARCH', label: t.convEventSearch },
    { value: 'OTHER', label: t.convEventOther },
  ]

  const conversionLocationOptions = getDestinationsWithLockInfo(campaignObjective, capabilities, DESTINATION_LABELS)

  function getConversionLocationsForObjective(objective: string): { value: string; label: string }[] {
    const allowed = getAllowedDestinations(objective)
    return allowed.map((value) => ({ value, label: DESTINATION_LABELS[value] ?? value }))
  }

  const inventory = capabilities?.assets
    ? {
        pages: (capabilities.assets.pages ?? []).map((p) => ({
          page_id: p.id,
          name: p.name,
          has_messaging: true,
          has_whatsapp: capabilities?.assets?.whatsapp?.available ?? false,
          lead_terms_accepted: null as boolean | null,
        })),
        pixels: (capabilities.assets.pixels ?? []).map((p) => ({ pixel_id: p.id, name: p.name })),
        apps: [] as { app_id: string; name: string }[],
        catalogs: [] as { catalog_id: string; name: string }[],
        lead_forms: (capabilities.assets.leadForms ?? []).reduce(
          (acc, f) => {
            if (!acc[f.page_id]) acc[f.page_id] = []
            acc[f.page_id].push({ form_id: f.id, name: f.name, status: 'ACTIVE' })
            return acc
          },
          {} as Record<string, { form_id: string; name: string; status: string }[]>
        ),
        product_sets: {} as Record<string, { product_set_id: string; name: string }[]>,
        pixel_events: {} as Record<string, string[]>,
        whatsapp_phone_numbers: ((capabilities?.assets?.whatsapp as any)?.phoneNumbers ?? []) as { phoneNumberId: string; displayPhone?: string; verifiedName?: string }[],
        token_permissions: { granted: capabilities?.grantedScopes ?? [], declined: [] as string[] },
        whatsapp_error: undefined as string | undefined,
        whatsapp_diagnostics: undefined as unknown,
      }
    : null

  const selectedPage = state.pageId ? inventory?.pages?.find((p) => p.page_id === state.pageId) : undefined
  const hasIgAccountsForPage = (instagramAccounts?.length ?? 0) > 0

  function getTrafficDestinationsFiltered(): { value: string; label: string }[] {
    const all = getConversionLocationsForObjective('OUTCOME_TRAFFIC')
    return all.filter((loc) => {
      if (loc.value === 'APP') return (inventory?.apps?.length ?? 0) > 0
      if (loc.value === 'MESSENGER') return selectedPage?.has_messaging === true
      if (loc.value === 'INSTAGRAM_DIRECT') return hasIgAccountsForPage
      return true
    })
  }

  // Engagement: inventory gating — MESSENGER/WHATSAPP/INSTAGRAM_DIRECT/WEBSITE/APP filtrelenir
  function getEngagementDestinationsFiltered(): { value: string; label: string }[] {
    const all = getConversionLocationsForObjective('OUTCOME_ENGAGEMENT')
    return all.filter((loc) => {
      if (loc.value === 'MESSENGER') return selectedPage?.has_messaging === true
      if (loc.value === 'WHATSAPP') return selectedPage?.has_whatsapp === true
      if (loc.value === 'INSTAGRAM_DIRECT') return hasIgAccountsForPage
      if (loc.value === 'WEBSITE') return (inventory?.pixels?.length ?? 0) > 0
      if (loc.value === 'APP') return (inventory?.apps?.length ?? 0) > 0
      return true // ON_AD, CALL, ON_PAGE
    })
  }

  // Leads: inventory gating — WEBSITE (pixel), MESSENGER (has_messaging), WHATSAPP (has_whatsapp); ON_AD, CALL her zaman
  function getLeadsDestinationsFiltered(): { value: string; label: string }[] {
    const all = getConversionLocationsForObjective('OUTCOME_LEADS')
    return all.filter((loc) => {
      if (loc.value === 'WEBSITE') return (inventory?.pixels?.length ?? 0) > 0
      if (loc.value === 'MESSENGER') return selectedPage?.has_messaging === true
      if (loc.value === 'WHATSAPP') return selectedPage?.has_whatsapp === true
      return true // ON_AD, CALL
    })
  }

  // Sales: inventory gating — WEBSITE (pixel), CATALOG (catalogs), APP (apps), MESSENGER (has_messaging), WHATSAPP (has_whatsapp)
  function getSalesDestinationsFiltered(): { value: string; label: string }[] {
    const all = getConversionLocationsForObjective('OUTCOME_SALES')
    return all.filter((loc) => {
      if (loc.value === 'WEBSITE') return (inventory?.pixels?.length ?? 0) > 0
      if (loc.value === 'CATALOG') return (inventory?.catalogs?.length ?? 0) > 0
      if (loc.value === 'APP') return (inventory?.apps?.length ?? 0) > 0
      if (loc.value === 'MESSENGER') return selectedPage?.has_messaging === true
      if (loc.value === 'WHATSAPP') return selectedPage?.has_whatsapp === true
      return true
    })
  }

  function getOptimizationGoalsForSelection(): { value: string; label: string }[] {
    const goals = getAllowedOptimizationGoals(campaignObjective, state.conversionLocation)
    // OUTCOME_ENGAGEMENT: OFFSITE_CONVERSIONS is not allowed by Meta API (errorSubcode 2490408)
    const filtered = campaignObjective === 'OUTCOME_ENGAGEMENT' 
      ? goals.filter((g) => g !== 'OFFSITE_CONVERSIONS')
      : goals
    return filtered.map((value) => ({ value, label: t[value as keyof typeof t] as string ?? value }))
  }

  const PLACEMENT_OPTIONS = getPlacementOptions(t)
  const isManualPlacements = state.placements !== 'advantage' && Array.isArray(state.placements)
  const optimizationGoalOptions = getOptimizationGoalsForSelection()
  const isSales = campaignObjective === 'OUTCOME_SALES'
  const isLeads = campaignObjective === 'OUTCOME_LEADS'
  const isEngagement = campaignObjective === 'OUTCOME_ENGAGEMENT'
  const isAppPromotion = campaignObjective === 'OUTCOME_APP_PROMOTION'
  const isTraffic = campaignObjective === 'OUTCOME_TRAFFIC'
  const isTrafficApp = isTraffic && state.conversionLocation === 'APP'
  const pixels = inventory?.pixels ?? []
  const pixelEvents = (state.pixelId && inventory?.pixel_events?.[state.pixelId]) || CONVERSION_EVENTS.map((e) => e.value)
  const selectedPageForLeads = state.pageId && inventory?.pages?.find((p) => p.page_id === state.pageId)
  const leadTermsNotAccepted = isLeads && state.conversionLocation === 'ON_AD' && selectedPageForLeads && selectedPageForLeads.lead_terms_accepted === false
  const debugMode = process.env.NODE_ENV !== 'production'
  type WhatsAppErrorObj = {
    stage?: string
    http_status?: number
    graph_code?: number
    graph_subcode?: number
    request_id?: string
    message?: string
    reason?: string
  }
  const whatsappError = inventory?.whatsapp_error as WhatsAppErrorObj | string | undefined
  const whatsappDiag = inventory?.whatsapp_diagnostics as
    | { mapping_fallback_used?: boolean; mapping_warning?: string }
    | undefined
  const whatsappDiagLine =
    whatsappError && typeof whatsappError === 'object'
      ? `stage:${whatsappError.stage} status:${whatsappError.http_status ?? '-'} code:${whatsappError.graph_code ?? '-'} subcode:${whatsappError.graph_subcode ?? '-'} request_id:${whatsappError.request_id ?? '-'}`
      : typeof whatsappError === 'string'
        ? whatsappError
        : null
  const whatsappMessage =
    typeof whatsappError === 'string' ? whatsappError : whatsappError?.message
  const whatsappReason = typeof whatsappError === 'object' && whatsappError ? whatsappError.reason : undefined

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {t.adsetName} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={state.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t.adsetNamePlaceholder}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {t.facebookPage} <span className="text-red-500">*</span>
        </label>
        <SearchableSelect
          value={state.pageId ?? ''}
          onChange={(v) => onChange({ pageId: v || undefined, instagramAccountId: '' })}
          options={[
            { value: '', label: pagesLoading ? t.loading : t.selectOption },
            ...pages.map((p) => ({ value: p.id, label: p.name })),
          ]}
          placeholder={pagesLoading ? t.loading : t.selectOption}
        />
        {pagesError && <p className="mt-1 text-sm text-red-600">{pagesError}</p>}
        {showEmptyPages && (
          <p className="mt-1 text-sm text-amber-600">{t.noPageHint}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {t.instagramAccount}
        </label>
        <select
          value={state.instagramAccountId ?? ''}
          onChange={(e) => onChange({ instagramAccountId: e.target.value || undefined })}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
        >
          <option value="">{t.selectOption}</option>
          {instagramAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              @{a.username}
            </option>
          ))}
        </select>
      </div>

      {hasConversionLocation(campaignObjective) && (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {t.conversionLocation}
        </label>
        <select
          value={state.conversionLocation}
          onChange={(e) => {
            const v = e.target.value
            const opt = conversionLocationOptions.find((o) => o.value === v)
            if (opt?.locked) return
            onChange({ conversionLocation: v })
          }}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          title={conversionLocationOptions.find((o) => o.value === state.conversionLocation)?.locked ? t[mapReasonToKey(conversionLocationOptions.find((o) => o.value === state.conversionLocation)?.reason)] : undefined}
        >
          {conversionLocationOptions.map((loc) => (
            <option
              key={loc.value}
              value={loc.value}
              disabled={loc.locked}
              title={loc.locked ? t[mapReasonToKey(loc.reason)] : undefined}
            >
              {loc.label}
              {loc.locked && loc.reason ? ` — ${t[mapReasonToKey(loc.reason)]}` : ''}
            </option>
          ))}
        </select>
        {conversionLocationOptions.some((o) => o.value === state.conversionLocation && o.locked) && (
          <p className="mt-1 text-sm text-amber-600">
            {t[mapReasonToKey(conversionLocationOptions.find((o) => o.value === state.conversionLocation)?.reason)]}
          </p>
        )}
      </div>
      )}

      {state.conversionLocation === 'WHATSAPP' && (() => {
        // Primary: accountInventory (page-scoped re-fetch with real WhatsApp data)
        // Fallback: capabilities-derived local inventory (initial load, no page_id)
        const wabaNumbers = (accountInventory?.whatsapp_phone_numbers?.length ?? 0) > 0
          ? accountInventory!.whatsapp_phone_numbers!
          : (inventory?.whatsapp_phone_numbers ?? [])
        const pageWhatsappNumber = accountInventory?.page_whatsapp_number
          ?? (typeof (inventory as Record<string, unknown> | null)?.page_whatsapp_number === 'string'
            ? String((inventory as Record<string, unknown>).page_whatsapp_number)
            : null)
        const pageWhatsappSource = accountInventory?.page_whatsapp_number_source
          ?? String((inventory as Record<string, unknown> | null)?.page_whatsapp_number_source ?? 'unknown')
        const selectedPhoneId = state.destinationDetails?.messaging?.whatsappPhoneNumberId
        const selectedDisplayPhone = state.destinationDetails?.messaging?.whatsappDisplayPhone

        // Mismatch guardrail: page-linked number vs selected WABA number
        const selectedWabaPhone = wabaNumbers.find(p => p.phoneNumberId === selectedPhoneId)
        const hasMismatch = pageWhatsappNumber && selectedWabaPhone?.displayPhone
          && !pageWhatsappNumber.replace(/\s/g, '').endsWith(selectedWabaPhone.displayPhone.replace(/[\s+\-()]/g, '').slice(-7))
          && !selectedWabaPhone.displayPhone.replace(/[\s+\-()]/g, '').endsWith(pageWhatsappNumber.replace(/[\s+\-()]/g, '').slice(-7))

        const hasNoNumbers = !pageWhatsappNumber && wabaNumbers.length === 0

        return (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {(t as Record<string, string>).whatsappPhoneLabel} <span className="text-red-500">*</span>
          </label>

          {/* Page field: whatsapp_number (sayfa ayarlarından gelen numara — referans) */}
          {pageWhatsappNumber && (
            <div className="mb-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm">
              <span className="font-medium text-green-700">Sayfaya Bağlı WhatsApp Numarası:</span>{' '}
              <span className="text-green-900 font-semibold">{pageWhatsappNumber}</span>
              <span className="text-green-500 text-xs ml-1">
                (kaynak: {pageWhatsappSource})
              </span>
            </div>
          )}

          {/* WABA phone numbers — SELECTABLE dropdown */}
          {wabaNumbers.length > 0 ? (
            <div className="mb-2">
              <select
                value={selectedPhoneId ?? ''}
                onChange={(e) => {
                  const phoneId = e.target.value || undefined
                  const phone = wabaNumbers.find(p => p.phoneNumberId === phoneId)
                  onChange({
                    destinationDetails: {
                      ...state.destinationDetails,
                      messaging: {
                        ...state.destinationDetails?.messaging,
                        whatsappPhoneNumberId: phoneId,
                        whatsappDisplayPhone: phone?.displayPhone ?? undefined,
                        whatsappSourceLayer: phoneId ? 'waba_selected' : undefined,
                      },
                    },
                  })
                }}
                className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary text-sm ${
                  errors.whatsapp_phone ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">— WhatsApp numarası seçin —</option>
                {wabaNumbers.map((p) => (
                  <option key={p.phoneNumberId} value={p.phoneNumberId}>
                    {p.displayPhone ?? p.phoneNumberId}
                    {p.verifiedName ? ` (${p.verifiedName})` : ''}
                  </option>
                ))}
              </select>
              {errors.whatsapp_phone && <p className="mt-1 text-sm text-red-600">{errors.whatsapp_phone}</p>}
            </div>
          ) : pageWhatsappNumber ? (
            <div className="mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              WABA numarası bulunamadı. Meta, sayfaya bağlı numarayı ({pageWhatsappNumber}) otomatik kullanacaktır.
            </div>
          ) : null}

          {/* Guardrail: no numbers at all — block publish */}
          {hasNoNumbers && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 font-medium">
              Bu sayfaya bağlı WhatsApp numarası bulunamadı. Reklam yayınlanamaz. Meta Business Suite'ten WhatsApp bağlantısını kontrol edin.
            </p>
          )}

          {/* Guardrail: mismatch between page-linked and selected WABA number */}
          {hasMismatch && (
            <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
              <span className="font-semibold">⚠ Numara Uyuşmazlığı:</span> Seçilen WABA numarası ({selectedWabaPhone?.displayPhone}) ile sayfaya bağlı WhatsApp numarası ({pageWhatsappNumber}) farklı görünüyor. Meta tarafındaki Sayfa bağlantısını kontrol edin. Reklamda yanlış numara kullanılabilir.
            </div>
          )}

          {wabaNumbers.length > 0 && (
            <p className="mt-1 text-xs text-gray-400">
              Reklamda kullanılacak WhatsApp numarasını seçin. Bu numara Meta'ya promoted_object içinde gönderilir.
            </p>
          )}
        </div>
        )
      })()}

      {/* CALL: Telefon numarası */}
      {state.conversionLocation === 'CALL' && (isEngagement || isLeads || isTraffic) && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {t.phoneNumber} <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={state.destinationDetails?.calls?.phoneNumber ?? ''}
            onChange={(e) =>
              onChange({
                destinationDetails: {
                  ...state.destinationDetails,
                  calls: { phoneNumber: e.target.value || undefined },
                },
              })
            }
            placeholder={t.phoneNumberPlaceholder}
            className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary text-sm ${errors.phone_number ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.phone_number && <p className="mt-1 text-sm text-red-600">{errors.phone_number}</p>}
        </div>
      )}


      {/* Traffic + APP: Uygulama ID ve Mağaza linki (adset) + platform + destinationDetails.app */}
      {(isTrafficApp || (isEngagement && state.conversionLocation === 'APP') || (isSales && state.conversionLocation === 'APP')) && (
        <>
          {(inventory?.apps?.length ?? 0) > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{t.appSelect}</label>
              <select
                value={state.appId ?? ''}
                onChange={(e) => {
                  const appId = e.target.value || undefined
                  const app = inventory?.apps?.find((a) => a.app_id === appId)
                  onChange({
                    appId,
                    destinationDetails: {
                      ...state.destinationDetails,
                      app: {
                        ...state.destinationDetails?.app,
                        appId,
                        storeUrl: state.appStoreUrl,
                        platform: state.destinationDetails?.app?.platform,
                      },
                    },
                  })
                }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">{t.appManual}</option>
                {(inventory?.apps ?? []).map((a) => (
                  <option key={a.app_id} value={a.app_id}>
                    {a.name || a.app_id}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.app} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={state.appId ?? ''}
              onChange={(e) => {
                const appId = e.target.value || undefined
                onChange({
                  appId,
                  destinationDetails: {
                    ...state.destinationDetails,
                    app: {
                      ...state.destinationDetails?.app,
                      appId,
                      storeUrl: state.appStoreUrl,
                      platform: state.destinationDetails?.app?.platform,
                    },
                  },
                })
              }}
              placeholder="Facebook App ID (örn. 123456789)"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
            {errors.app_id && <p className="mt-1 text-sm text-red-600">{errors.app_id}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{t.platform}</label>
            <select
              value={state.destinationDetails?.app?.platform ?? 'ANDROID'}
              onChange={(e) =>
                onChange({
                  destinationDetails: {
                    ...state.destinationDetails,
                    app: {
                      ...state.destinationDetails?.app,
                      appId: state.appId,
                      storeUrl: state.appStoreUrl,
                      platform: e.target.value as 'IOS' | 'ANDROID',
                    },
                  },
                })
              }
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-sm"
            >
              <option value="ANDROID">Android</option>
              <option value="IOS">iOS</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.storeUrl} <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={state.appStoreUrl ?? ''}
              onChange={(e) => {
                const storeUrl = e.target.value || undefined
                onChange({
                  appStoreUrl: storeUrl,
                  destinationDetails: {
                    ...state.destinationDetails,
                    app: {
                      ...state.destinationDetails?.app,
                      appId: state.appId,
                      storeUrl,
                      platform: state.destinationDetails?.app?.platform,
                    },
                  },
                })
              }}
              placeholder="https://play.google.com/store/apps/details?id=com.example.app"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
            {errors.app_store_url && <p className="mt-1 text-sm text-red-600">{errors.app_store_url}</p>}
          </div>
        </>
      )}
      {/* App Promotion: Mağaza tipi (zorunlu) + İlişkilendirme modeli (opsiyonel) */}
      {isAppPromotion && (
        <>
          {errors.app_store_url && (
            <p className="text-sm text-red-600">{errors.app_store_url}</p>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.storeLabel} <span className="text-red-500">*</span>
            </label>
            <select
              value={state.appStore ?? 'GOOGLE_PLAY'}
              onChange={(e) => onChange({ appStore: e.target.value })}
              className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm ${errors.app_store ? 'border-red-500' : 'border-gray-300'}`}
            >
              {[
                { value: 'GOOGLE_PLAY', label: 'Google Play' },
                { value: 'APPLE_APP_STORE', label: 'Apple App Store' },
                { value: 'AMAZON_APPSTORE', label: 'Amazon Appstore' },
                { value: 'META_QUEST', label: 'Meta Quest Store' },
              ].map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {errors.app_store && <p className="mt-1 text-sm text-red-600">{errors.app_store}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{t.attributionModel}</label>
            <select
              value={state.attributionModel ?? 'STANDARD'}
              onChange={(e) => onChange({ attributionModel: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            >
              <option value="STANDARD">Standart</option>
              <option value="INCREMENTAL">Artımlı</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{t.conversionLocationLabel}</label>
            <p className="text-sm text-gray-600">{t.app}</p>
          </div>
        </>
      )}

      {/* Leads + ON_AD ve lead_terms_accepted === false uyarısı */}
      {leadTermsNotAccepted && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          {t.leadTermsWarning}{' '}
          <a href="https://www.facebook.com/ads/leadgen/tos" target="_blank" rel="noopener noreferrer" className="underline font-medium">{t.leadTermsAcceptLink}</a>
        </div>
      )}

      {/* Sales + WEBSITE: Pixel + Dönüşüm Olayı — Step 2'de zorunlu */}
      {isSales && state.conversionLocation === 'WEBSITE' && (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.pixelLabel} <span className="text-red-500">*</span>
            </label>
            <select
              value={state.pixelId ?? ''}
              onChange={(e) => onChange({ pixelId: e.target.value || undefined, customEventType: e.target.value ? (state.customEventType || 'PURCHASE') : undefined })}
              disabled={pixels.length === 0}
              className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm disabled:bg-gray-100 ${errors.pixel_id ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">{pixels.length === 0 ? t.pixelNone : t.selectOption}</option>
              {pixels.map((p) => (
                <option key={p.pixel_id} value={p.pixel_id}>
                  {p.name || p.pixel_id}
                </option>
              ))}
            </select>
            {pixels.length === 0 && <p className="mt-1 text-sm text-amber-600">{t.pixelRequiredSales}</p>}
            {errors.pixel_id && <p className="mt-1 text-sm text-red-600">{errors.pixel_id}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.conversionEventLabel} <span className="text-red-500">*</span>
            </label>
            <select
              value={state.customEventType ?? 'PURCHASE'}
              onChange={(e) => onChange({ customEventType: e.target.value })}
              disabled={!state.pixelId}
              className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm disabled:bg-gray-100 ${errors.conversion_event ? 'border-red-500' : 'border-gray-300'}`}
            >
              {CONVERSION_EVENTS.filter((e) => pixelEvents.includes(e.value)).map((ev) => (
                <option key={ev.value} value={ev.value}>
                  {ev.label}
                </option>
              ))}
            </select>
            {errors.conversion_event && <p className="mt-1 text-sm text-red-600">{errors.conversion_event}</p>}
          </div>
        </>
      )}

      {isSales && state.conversionLocation === 'WEBSITE' && (
        <details className="border border-gray-200 rounded-lg overflow-hidden">
          <summary className="flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 cursor-pointer text-sm font-semibold text-gray-700">
            {(t as Record<string, string>).valueRulesLabel}
            <span className="text-caption text-gray-400">{(t as Record<string, string>).optional}</span>
          </summary>
          <div className="px-4 py-3 text-sm text-gray-600">
            {(t as Record<string, string>).valueRulesNote}
          </div>
        </details>
      )}

      {/* Sales + CATALOG: Ürün Katalogu + Ürün Seti (opsiyonel) */}
      {isSales && state.conversionLocation === 'CATALOG' && (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.catalogLabel} <span className="text-red-500">*</span>
            </label>
            <select
              value={state.catalogId ?? ''}
              onChange={(e) => {
                const catalogId = e.target.value || undefined
                onChange({
                  catalogId,
                  productSetId: undefined,
                  destinationDetails: {
                    ...state.destinationDetails,
                    catalog: { catalogId, productSetId: undefined },
                  },
                })
              }}
              disabled={(inventory?.catalogs?.length ?? 0) === 0}
              className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm disabled:bg-gray-100 ${errors.catalog_id ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">{(inventory?.catalogs?.length ?? 0) === 0 ? t.catalogNone : t.selectOption}</option>
              {(inventory?.catalogs ?? []).map((c) => (
                <option key={c.catalog_id} value={c.catalog_id}>
                  {c.name || c.catalog_id}
                </option>
              ))}
            </select>
            {errors.catalog_id && <p className="mt-1 text-sm text-red-600">{errors.catalog_id}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.productSetLabel}
            </label>
            <select
              value={state.productSetId ?? ''}
              onChange={(e) => {
                const productSetId = e.target.value || undefined
                onChange({
                  productSetId,
                  destinationDetails: {
                    ...state.destinationDetails,
                    catalog: {
                      catalogId: state.catalogId,
                      productSetId,
                    },
                  },
                })
              }}
              disabled={!state.catalogId}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm disabled:bg-gray-100"
            >
              <option value="">{t.productSetAll}</option>
              {(() => {
                const sets = state.catalogId ? inventory?.product_sets?.[state.catalogId] : undefined
                const list = Array.isArray(sets) ? sets : []
                return list.map((ps) => (
                  <option key={ps.product_set_id} value={ps.product_set_id}>
                    {ps.name || ps.product_set_id}
                  </option>
                ))
              })()}
            </select>
          </div>
        </>
      )}

      {/* Leads + WEBSITE: Pixel + Dönüşüm Olayı (Leads için genelde LEAD) */}
      {isLeads && state.conversionLocation === 'WEBSITE' && (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.pixelLabel} <span className="text-red-500">*</span>
            </label>
            <select
              value={state.pixelId ?? ''}
              onChange={(e) => onChange({ pixelId: e.target.value || undefined, customEventType: e.target.value ? (state.customEventType || 'LEAD') : undefined })}
              disabled={pixels.length === 0}
              className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm disabled:bg-gray-100 ${errors.pixel_id ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">{pixels.length === 0 ? t.pixelNone : t.selectOption}</option>
              {pixels.map((p) => (
                <option key={p.pixel_id} value={p.pixel_id}>
                  {p.name || p.pixel_id}
                </option>
              ))}
            </select>
            {pixels.length === 0 && <p className="mt-1 text-sm text-amber-600">{t.pixelRequiredLeads}</p>}
            {errors.pixel_id && <p className="mt-1 text-sm text-red-600">{errors.pixel_id}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.conversionEventLabel} <span className="text-red-500">*</span>
            </label>
            <select
              value={state.customEventType ?? 'LEAD'}
              onChange={(e) => onChange({ customEventType: e.target.value })}
              disabled={!state.pixelId}
              className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm disabled:bg-gray-100 ${errors.conversion_event ? 'border-red-500' : 'border-gray-300'}`}
            >
              {CONVERSION_EVENTS.filter((e) => e.value === 'LEAD' || pixelEvents.includes(e.value)).map((ev) => (
                <option key={ev.value} value={ev.value}>
                  {ev.label}
                </option>
              ))}
            </select>
            {errors.conversion_event && <p className="mt-1 text-sm text-red-600">{errors.conversion_event}</p>}
          </div>
        </>
      )}

      {/* Engagement + WEBSITE: Pixel + Dönüşüm Olayı (Sales ile aynı) — HIDE for OUTCOME_ENGAGEMENT per Meta API restriction */}
      {isEngagement && state.conversionLocation === 'WEBSITE' && (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.pixelLabel} <span className="text-red-500">*</span>
            </label>
            <select
              value={state.pixelId ?? ''}
              onChange={(e) => onChange({ pixelId: e.target.value || undefined, customEventType: e.target.value ? (state.customEventType || 'PURCHASE') : undefined })}
              disabled={pixels.length === 0}
              className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm disabled:bg-gray-100 ${errors.pixel_id ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">{pixels.length === 0 ? t.pixelNone : t.selectOption}</option>
              {pixels.map((p) => (
                <option key={p.pixel_id} value={p.pixel_id}>
                  {p.name || p.pixel_id}
                </option>
              ))}
            </select>
            {pixels.length === 0 && <p className="mt-1 text-sm text-amber-600">{t.pixelRequiredEngagement}</p>}
            {errors.pixel_id && <p className="mt-1 text-sm text-red-600">{errors.pixel_id}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.conversionEventLabel} <span className="text-red-500">*</span>
            </label>
            <select
              value={state.customEventType ?? 'PURCHASE'}
              onChange={(e) => onChange({ customEventType: e.target.value })}
              disabled={!state.pixelId}
              className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm disabled:bg-gray-100 ${errors.conversion_event ? 'border-red-500' : 'border-gray-300'}`}
            >
              {CONVERSION_EVENTS.filter((e) => pixelEvents.includes(e.value)).map((ev) => (
                <option key={ev.value} value={ev.value}>
                  {ev.label}
                </option>
              ))}
            </select>
            {errors.conversion_event && <p className="mt-1 text-sm text-red-600">{errors.conversion_event}</p>}
          </div>
        </>
      )}

      {/* Optimization Goal — Awareness, Engagement, Sales, Traffic: dropdown; Leads, App Promotion: sabit */}
      {!isLeads && !isAppPromotion && optimizationGoalOptions.length >= 1 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {campaignObjective === 'OUTCOME_AWARENESS' || campaignObjective === 'OUTCOME_ENGAGEMENT'
              ? t.performanceGoal
              : t.optimizationGoal}
            {(campaignObjective === 'OUTCOME_AWARENESS' || campaignObjective === 'OUTCOME_ENGAGEMENT') && (
              <span className="text-red-500"> *</span>
            )}
          </label>
          <select
            value={state.optimizationGoal}
            onChange={(e) => onChange({ optimizationGoal: e.target.value })}
            className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm ${errors.performance_goal ? 'border-red-500' : 'border-gray-300'}`}
          >
            {!state.optimizationGoal && <option value="">Seçin...</option>}
            {optimizationGoalOptions.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
          {errors.performance_goal && <p className="mt-1 text-sm text-red-600">{errors.performance_goal}</p>}
        </div>
      )}

      {!isLeads && !isAppPromotion && !isSales && state.conversionLocation !== 'WHATSAPP' && (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="dynamic-creative"
            checked={state.dynamicCreative === true}
            onChange={(e) => onChange({ dynamicCreative: e.target.checked })}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <div>
            <label htmlFor="dynamic-creative" className="text-sm font-semibold text-gray-700">
              {(t as Record<string, string>).dynamicCreativeLabel}
            </label>
            <p className="text-caption text-gray-500">{(t as Record<string, string>).dynamicCreativeDesc}</p>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t.adPlacements}
        </label>
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="placements"
              checked={state.placements === 'advantage'}
              onChange={() => onChange({ placements: 'advantage' })}
              className="text-primary focus:ring-primary"
            />
            <span className="text-sm">{t.advantagePlacementsRecommended}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="placements"
              checked={isManualPlacements}
              onChange={() => onChange({ placements: [...ALL_PLACEMENT_KEYS] })}
              className="text-primary focus:ring-primary"
            />
            <span className="text-sm">{t.manualPlacement}</span>
          </label>
          {isManualPlacements && (() => {
            const selected = Array.isArray(state.placements) ? state.placements as string[] : []

            const togglePosition = (platform: string, position: string) => {
              const key = `${platform}:${position}`
              const next = selected.includes(key)
                ? selected.filter((p) => p !== key)
                : [...selected, key]
              if (next.length > 0) onChange({ placements: next })
            }

            const togglePlatform = (platform: string, positions: readonly { value: string; label: string }[]) => {
              const keys = positions.map((pos) => `${platform}:${pos.value}`)
              const allChecked = keys.every((k) => selected.includes(k))
              if (allChecked) {
                const next = selected.filter((p) => !keys.includes(p))
                if (next.length > 0) onChange({ placements: next })
              } else {
                const next = [...new Set([...selected, ...keys])]
                onChange({ placements: next })
              }
            }

            return (
              <div className="ml-6 space-y-1 border border-gray-200 rounded-lg overflow-hidden">
                {PLACEMENT_OPTIONS.map((platform) => {
                  const platformKeys = platform.positions.map((pos) => `${platform.platform}:${pos.value}`)
                  const allChecked = platformKeys.every((k) => selected.includes(k))
                  const someChecked = platformKeys.some((k) => selected.includes(k))
                  return (
                    <div key={platform.platform} className="border-b border-gray-100 last:border-b-0">
                      <label className="flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={(el) => { if (el) el.indeterminate = !allChecked && someChecked }}
                          onChange={() => togglePlatform(platform.platform, platform.positions)}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-semibold text-gray-700">{platform.label}</span>
                      </label>
                      <div className="px-3 py-1.5 space-y-1">
                        {platform.positions.map((pos) => {
                          const key = `${platform.platform}:${pos.value}`
                          return (
                            <label key={key} className="flex items-center gap-2 ml-4 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selected.includes(key)}
                                onChange={() => togglePosition(platform.platform, pos.value)}
                                className="rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <span className="text-sm text-gray-600">{pos.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
