'use client'
// Değişen dosyalar: CampaignWizard.tsx, wizard/TabBudget.tsx, wizard/TabDetails.tsx, wizard/StepAdSet.tsx

import { useState, useCallback, useEffect, useRef } from 'react'
import type { WizardState } from './wizard/types'
import { initialWizardState } from './wizard/types'
import WizardProgress from './wizard/WizardProgress'
import WizardNavigation from './wizard/WizardNavigation'
import StepCampaign from './wizard/StepCampaign'
import StepAdSet from './wizard/StepAdSet'
import StepAd from './wizard/StepAd'
import StepSummary from './wizard/StepSummary'
import WizardSidebar from './wizard/WizardSidebar'
import {
  getAllowedDestinations,
  getAllowedOptimizationGoals,
  getDefaultCTA,
  getDefaultOptimizationGoal,
  requiresWebsiteUrl,
  type DestinationId,
} from '@/lib/meta/spec/objectiveSpec'
import type { MetaCapabilities } from '@/lib/meta/capabilityRules'
import { X } from 'lucide-react'
import { getWizardTranslations, getLocaleFromCookie } from '@/lib/i18n/wizardTranslations'
import type { AccountInventory } from '@/app/api/meta/inventory/route'
import { preflight, type PreflightResult, type BlockedReason } from '@/lib/meta/spec/preflightValidator'
import { routeMetaError, type ErrorRoute } from '@/lib/meta/spec/errorRouter'
import { getSpecByApiObjective } from './wizard/spec/objectives'
import { validateStepsUpTo, numberToStepKey } from './wizard/runtime/validate'
import { emptyCapabilities as wizardEmptyCapabilities } from './wizard/capabilities/types'
import { t as specT, getSpecLocale } from './wizard/spec/i18n'
import { getMinDailyBudgetTRY, getUsdTryRate } from '@/lib/budget/minBudget'

export interface DiscoverySpecPatch {
  requiredFieldsAdded: string[]
  invalidCombination?: boolean
  notes?: string
}

export interface MetaPage {
  id: string
  name: string
  picture?: string
  instagram_business_account?: { id: string }
}

export interface InstagramAccount {
  id: string
  username: string
  profile_picture_url?: string
}

const REQUIRES_MIN_BUDGET = 'REQUIRES_MIN_BUDGET'
const REQUIRES_BID_AMOUNT = 'REQUIRES_BID_AMOUNT'
const PREFLIGHT_BLOCKED = 'PREFLIGHT_BLOCKED'

/** Map spec field key to UI step error key (existing step components expect these) */
function specFieldKeyToErrorKey(specKey: string): string {
  const map: Record<string, string> = {
    'campaign.name': 'name',
    'adset.name': 'name',
    'adset.pageId': 'pageId',
    'adset.pixelId': 'pixel_id',
    'adset.customEventType': 'conversion_event',
    'adset.appId': 'app_id',
    'adset.appStoreUrl': 'app_store_url',
    'adset.catalogId': 'catalog_id',
    'adset.productSetId': 'product_set_id',
    'adset.appStore': 'app_store',
    'ad.name': 'name',
    'ad.primaryText': 'primaryText',
    'ad.websiteUrl': 'websiteUrl',
    'ad.leadFormId': 'lead_form',
    'ad.chatGreeting': 'chat_greeting',
    'ad.phoneNumber': 'phone_number',
    'ad.media': 'media',
  }
  return map[specKey] ?? specKey.split('.').pop() ?? specKey
}


interface CampaignWizardProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  onToast?: (message: string, type: 'success' | 'error') => void
  capabilities?: MetaCapabilities | null
  initialObjective?: string
}

function buildTargeting(state: WizardState['adset']) {
  const t = state.targeting
  const countries = t.locations.filter((l) => l.type === 'country').map((l) => l.key)
  const cities = t.locations.filter((l) => l.type === 'city').map((l) => ({ key: l.key }))
  const regions = t.locations.filter((l) => l.type === 'region').map((l) => ({ key: l.key }))
  const geo: Record<string, unknown> = {}
  if (countries.length) geo.countries = countries
  if (cities.length) geo.cities = cities
  if (regions.length) geo.regions = regions
  if (Object.keys(geo).length === 0) geo.countries = ['TR']

  // Excluded locations (if any)
  const excludedLocations = t.excluded_locations ?? []
  const excludedCountries = excludedLocations.filter((l) => l.type === 'country').map((l) => l.key)
  const excludedCities = excludedLocations.filter((l) => l.type === 'city').map((l) => ({ key: l.key }))
  const excludedRegions = excludedLocations.filter((l) => l.type === 'region').map((l) => ({ key: l.key }))
  const excludedGeo: Record<string, unknown> = {}
  if (excludedCountries.length) excludedGeo.countries = excludedCountries
  if (excludedCities.length) excludedGeo.cities = excludedCities
  if (excludedRegions.length) excludedGeo.regions = excludedRegions

  // Ensure valid age range (age_min >= 18, age_max >= 65 per Meta API requirement)
  const ageMin = Math.max(18, t.ageMin || 18)
  // Meta API requires age_max to be at least 65 (error_subcode: 1870189 if less)
  const ageMax = Math.max(65, Math.max(ageMin, t.ageMax || 65))

  const targeting: Record<string, unknown> = {
    geo_locations: geo,
    age_min: ageMin,
    age_max: ageMax,
  }
  // Add excluded_geo_locations if there are any
  if (Object.keys(excludedGeo).length > 0) {
    targeting.excluded_geo_locations = excludedGeo
  }
  if (t.genders.length) targeting.genders = t.genders
  // Interests must be in flexible_spec, not as a top-level field
  if (t.interests.length) {
    targeting.flexible_spec = [{ interests: t.interests.map((i) => ({ id: i.id, name: i.name })) }]
  }
  if (t.locales.length) targeting.locales = t.locales
  if (t.custom_audiences.length) {
    targeting.custom_audiences = t.custom_audiences.map((a) => ({ id: a.id, name: a.name }))
  }
  if (t.excluded_custom_audiences.length) {
    targeting.excluded_custom_audiences = t.excluded_custom_audiences.map((a) => ({ id: a.id, name: a.name }))
  }

  // Manuel placement: 'platform:position' string array → Meta targeting format
  // 'advantage' seçiliyken hiçbir placement alanı gönderilmez (Meta optimize eder)
  if (Array.isArray(state.placements) && state.placements.length > 0) {
    const grouped: Record<string, string[]> = {}
    for (const p of state.placements) {
      const colonIdx = p.indexOf(':')
      if (colonIdx === -1) continue
      const platform = p.slice(0, colonIdx)
      const position = p.slice(colonIdx + 1)
      if (!grouped[platform]) grouped[platform] = []
      grouped[platform].push(position)
    }
    if (grouped.facebook) targeting.facebook_positions = grouped.facebook
    if (grouped.instagram) targeting.instagram_positions = grouped.instagram
    if (grouped.audience_network) targeting.audience_network_positions = grouped.audience_network
    if (grouped.messenger) targeting.messenger_positions = grouped.messenger
    if (grouped.threads) targeting.threads_positions = grouped.threads
    if (Object.keys(grouped).length > 0) targeting.publisher_platforms = Object.keys(grouped)
  }

  return targeting
}

/** localStorage-based IG verify cache — survives page refresh. Key: igVerify:{pageId}, TTL 30 min. */
interface IgVerifyCacheEntry { instagramUserId: string; username: string | null; expiresAt: number }
const IG_VERIFY_CACHE_TTL_MS = 30 * 60 * 1000

function readIgVerifyLocalCache(pageId: string): IgVerifyCacheEntry | null {
  try {
    const raw = localStorage.getItem(`igVerify:${pageId}`)
    if (!raw) return null
    const entry = JSON.parse(raw) as IgVerifyCacheEntry
    if (entry.expiresAt < Date.now()) { localStorage.removeItem(`igVerify:${pageId}`); return null }
    return entry
  } catch { return null }
}

function writeIgVerifyLocalCache(pageId: string, entry: IgVerifyCacheEntry): void {
  try { localStorage.setItem(`igVerify:${pageId}`, JSON.stringify(entry)) } catch { /* quota */ }
}

function getMinBudgetError(
  value: number | undefined | null,
  type: 'daily' | 'lifetime',
  minDailyBudget: number | undefined,
  dailyMsg: string,
  lifetimeMsg: string,
): string | null {
  if (value == null || value <= 0 || minDailyBudget == null) return null
  if (value >= minDailyBudget) return null
  const msg = type === 'lifetime' ? lifetimeMsg : dailyMsg
  return msg.replace('{min}', String(Math.ceil(minDailyBudget)))
}

export default function CampaignWizard({ isOpen, onClose, onSuccess, onToast, capabilities, initialObjective }: CampaignWizardProps) {
  const t = getWizardTranslations(getLocaleFromCookie())
  // Static min daily budget: 1 USD in TRY (ENV-based, immediately available — no API wait)
  // null when NEXT_PUBLIC_USD_TRY_RATE is missing/invalid — warning suppressed
  const _usdTryRate = getUsdTryRate()
  const minDailyTry: number | null = _usdTryRate != null ? getMinDailyBudgetTRY({ usdTryRate: _usdTryRate }) : null
  const BLOCKED_REASON_MESSAGES: Record<BlockedReason, string> = {
    NO_PAGE: t.preflightNoPage,
    NO_PIXEL: t.preflightNoPixel,
    NO_FORMS: t.preflightNoForms,
    LEAD_TERMS_NOT_ACCEPTED: t.preflightLeadTerms,
    NO_APP: t.preflightNoApp,
    NO_CATALOG: t.preflightNoCatalog,
    NO_WHATSAPP: t.preflightNoWhatsapp,
    NO_MESSENGER: t.preflightNoMessenger,
    WHATSAPP_PHONE_NOT_SELECTED: t.preflightWhatsappPhoneNotSelected,
    MIN_BUDGET: t.preflightMinBudget,
  }
  const [state, setState] = useState<WizardState>(initialWizardState)
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pages, setPages] = useState<MetaPage[]>([])
  const [pagesLoading, setPagesLoading] = useState(false)
  const [pagesInitialLoadDone, setPagesInitialLoadDone] = useState(false)
  const [pagesError, setPagesError] = useState<string | null>(null)
  const [instagramAccount, setInstagramAccount] = useState<InstagramAccount | null>(null)
  const [instagramLoading, setInstagramLoading] = useState(false)
  /** IG verify gate for INSTAGRAM_DIRECT */
  /** idle: not started | verifying: request in-flight | ok: verified | blocked_rate_limit: cooldown active | error: failed */
  const [igVerifyStatus, setIgVerifyStatus] = useState<'idle' | 'verifying' | 'ok' | 'blocked_rate_limit' | 'error'>('idle')
  const [igVerifyMsg, setIgVerifyMsg] = useState<string | null>(null)
  const [igVerifyErrorKind, setIgVerifyErrorKind] = useState<string | null>(null)
  const [igVerifyUsername, setIgVerifyUsername] = useState<string | null>(null)
  const [igVerifyIgUserId, setIgVerifyIgUserId] = useState<string | null>(null)
  /** Timestamp (ms) until which Meta rate-limit is in effect; null = not rate-limited */
  const [igRateLimitUntil, setIgRateLimitUntil] = useState<number | null>(null)
  /** Countdown in seconds, updated every second while rate-limited */
  const [igRateLimitCountdown, setIgRateLimitCountdown] = useState<number | null>(null)
  const igVerifyAbortRef = useRef<AbortController | null>(null)
  /** 900ms debounce timer for verify trigger */
  const igVerifyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** pageIds currently in-flight — prevents duplicate concurrent requests */
  const igVerifyInFlightRef = useRef<Set<string>>(new Set())
  /** Mirror of igRateLimitUntil state for reads inside effects without causing re-deps */
  const igRateLimitUntilRef = useRef<number | null>(null)
  const [discoveryPatch, setDiscoveryPatch] = useState<DiscoverySpecPatch | null>(null)
  const [discoveryLoading, setDiscoveryLoading] = useState(false)
  const discoveryAbortRef = useRef<AbortController | null>(null)
  const [bidRequirements, setBidRequirements] = useState<{ requiresBidAmount: boolean; allowedBidStrategies: string[] } | null>(null)
  /** 409 requiresBidAmount gelince true; Otomatik disabled, CAP zorunlu. */
  const [bidRequirementMode, setBidRequirementMode] = useState(false)
  const [allowedBidStrategies, setAllowedBidStrategies] = useState<string[] | null>(null)
  const [minBudgetRequirement, setMinBudgetRequirement] = useState<{ minDailyBudgetTry: number } | null>(null)
  const [minDailyBudgetTry, setMinDailyBudgetTry] = useState<{ value?: number; status: 'idle' | 'loading' | 'ready' | 'error' }>({ status: 'idle' })
  const [accountCurrency, setAccountCurrency] = useState<string | null>(null)
  const [fxState, setFxState] = useState<{ status: 'loading' | 'ready' | 'error'; rate?: number; asOf?: string }>({ status: 'loading' })
  const budgetInputRef = useRef<HTMLInputElement | null>(null)
  const [inventory, setInventory] = useState<AccountInventory | null>(null)
  const [inventoryPageId, setInventoryPageId] = useState<string | null>(null)
  const [inventoryStatus, setInventoryStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [campaignMinBudgetError, setCampaignMinBudgetError] = useState<string | null>(null)
  const [adSetMinBudgetError, setAdSetMinBudgetError] = useState<string | null>(null)
  /** Campaign budget (step 1) min daily = 1 USD in TRY — from /api/fx/usdtry, only for CBO + daily */
  const [campaignUsdTryRate, setCampaignUsdTryRate] = useState<number | null>(null)
  const [campaignMinDailyTry, setCampaignMinDailyTry] = useState<number | null>(null)
  const [campaignFxError, setCampaignFxError] = useState<string | null>(null)
  /** Backend publish error — exact response shown in UI (no silent fail) */
  const [publishError, setPublishError] = useState<{
    message: string
    error_user_msg?: string
    subcode?: number
  } | null>(null)

  const resetWizardState = useCallback(() => {
    setState({
      ...initialWizardState,
      campaign: {
        ...initialWizardState.campaign,
        objective: initialObjective || initialWizardState.campaign.objective,
      },
    })
    setStepErrors({})
    setBidRequirementMode(false)
    setAllowedBidStrategies(null)
    setMinBudgetRequirement(null)
    setMinDailyBudgetTry({ status: 'idle' })
    setCampaignUsdTryRate(null)
    setCampaignMinDailyTry(null)
    setCampaignFxError(null)
    setPublishError(null)
  }, [initialObjective])

  useEffect(() => {
    if (isOpen) resetWizardState()
  }, [isOpen, resetWizardState])

  useEffect(() => {
    if (!isOpen) {
      setBidRequirementMode(false)
      setAllowedBidStrategies(null)
      return
    }
    let cancelled = false
    fetch('/api/meta/ad-account-currency')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setAccountCurrency(data.ok && typeof data.currency === 'string' ? data.currency : null)
      })
      .catch(() => {
        if (!cancelled) {
          setAccountCurrency(null)
        }
      })
    return () => { cancelled = true }
  }, [isOpen])

  // Fetch FX rate when accountCurrency is determined
  useEffect(() => {
    if (!accountCurrency) {
      setFxState({ status: 'loading' })
      return
    }
    if (accountCurrency === 'TRY') {
      setFxState({ status: 'ready', rate: 1, asOf: new Date().toISOString() })
      return
    }
    let cancelled = false
    setFxState({ status: 'loading' })
    fetch(`/api/fx?base=${encodeURIComponent(accountCurrency)}&quote=TRY`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.ok && typeof data.rate === 'number' && data.rate > 0) {
          setFxState({ status: 'ready', rate: data.rate, asOf: data.asOf })
        } else {
          setFxState({ status: 'error' })
        }
      })
      .catch(() => {
        if (!cancelled) setFxState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [accountCurrency])

  // Campaign budget min daily = 1 USD in TRY — fetch from FX endpoint (1h cache), only used when CBO + daily
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setCampaignFxError(null)
    fetch('/api/fx/usdtry')
      .then((res) => {
        if (!res.ok) throw new Error('FX rate unavailable')
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const rate = typeof data?.rate === 'number' && data.rate > 0 ? data.rate : null
        if (rate != null) {
          setCampaignUsdTryRate(rate)
          setCampaignMinDailyTry(Math.ceil(rate * 1))
          setCampaignFxError(null)
        } else {
          setCampaignUsdTryRate(null)
          setCampaignMinDailyTry(null)
          setCampaignFxError(t.fxErrorMinBudget)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCampaignUsdTryRate(null)
          setCampaignMinDailyTry(null)
          setCampaignFxError(t.fxErrorMinBudget)
        }
      })
    return () => { cancelled = true }
  }, [isOpen, t.fxErrorMinBudget])

  useEffect(() => {
    if (!isOpen || state.currentStep !== 2) return
    const objective = state.campaign?.objective
    const isCBO = state.campaign?.budgetOptimization === 'campaign'
    if (!objective) return
    let cancelled = false
    setBidRequirements(null)
    fetch(`/api/meta/adsets/bid-requirements?objective=${encodeURIComponent(objective)}&campaignBudgetOptimization=${isCBO}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.ok) return
        setBidRequirements({
          requiresBidAmount: !!data.requiresBidAmount,
          allowedBidStrategies: Array.isArray(data.allowedBidStrategies) ? data.allowedBidStrategies : ['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP'],
        })
      })
      .catch(() => { if (!cancelled) setBidRequirements(null) })
    return () => { cancelled = true }
  }, [isOpen, state.currentStep, state.campaign?.objective, state.campaign?.budgetOptimization])

  // Fetch minimum daily budget in TRY from Meta /minimum_budgets (with 2% buffer + 1 USD floor).
  // Debounce 300ms on dependency change.
  // Reset to loading when any key input changes.
  const CAP_STRATEGIES = ['LOWEST_COST_WITH_BID_CAP', 'COST_CAP']
  const bidMode = state.adset.bidStrategy != null && CAP_STRATEGIES.includes(state.adset.bidStrategy) ? 'cap' : 'auto'
  useEffect(() => {
    if (!isOpen || (state.currentStep !== 1 && state.currentStep !== 2)) return
    // Reset → loading (value null: no stale UI)
    setMinDailyBudgetTry({ value: undefined, status: 'loading' })
    const timer = setTimeout(() => {
      // WhatsApp: backend normalizes goal — ENGAGEMENT → CONVERSATIONS, others → REPLIES
      const effGoal =
        state.adset.conversionLocation === 'WHATSAPP'
          ? (state.campaign.objective === 'OUTCOME_ENGAGEMENT' ? 'CONVERSATIONS' : 'REPLIES')
          : (state.adset.optimizationGoal ?? 'LINK_CLICKS')
      const params = new URLSearchParams({
        optimizationGoal: effGoal,
        objective: state.campaign.objective ?? 'OUTCOME_TRAFFIC',
        bidMode,
      })
      fetch(`/api/meta/min-daily-budget-try?${params}`)
        .then((res) => {
          if (res.status === 503) {
            setMinDailyBudgetTry({ value: undefined, status: 'error' })
            return
          }
          return res.json()
        })
        .then((data) => {
          if (!data) return // 503 handled above
          if (data.ok && typeof data.minDailyBudgetTry === 'number') {
            setMinDailyBudgetTry({ value: data.minDailyBudgetTry, status: 'ready' })
          } else {
            setMinDailyBudgetTry({ value: undefined, status: 'error' })
          }
        })
        .catch(() => setMinDailyBudgetTry({ value: undefined, status: 'error' }))
    }, 300)
    return () => clearTimeout(timer)
  }, [isOpen, state.currentStep, state.adset.optimizationGoal, state.adset.conversionLocation, state.campaign.objective, bidMode])

  // When returning to step 2 due to Meta min budget error, focus budget input after tab is visible
  useEffect(() => {
    if (!minBudgetRequirement || state.currentStep !== 2) return
    const id = setTimeout(() => budgetInputRef.current?.focus(), 100)
    return () => clearTimeout(id)
  }, [minBudgetRequirement, state.currentStep])

  // ── Unified inventory fetch: pages + IG + pixels + lead forms ──
  useEffect(() => {
    if (!isOpen) {
      setPagesInitialLoadDone(false)
      return
    }
    if (
      inventory &&
      (inventory as AccountInventory & { adAccountId?: string }).adAccountId === capabilities?.adAccountId
    ) {
      setPagesLoading(false)
      setPagesInitialLoadDone(true)
      setInstagramLoading(false)
      return
    }
    let cancelled = false
    setPagesError(null)
    setPagesLoading(true)
    setInstagramLoading(true)
    fetch('/api/meta/inventory')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.ok && data.data) {
          const inv = data.data as AccountInventory
          setInventory({ ...inv, adAccountId: capabilities?.adAccountId ?? undefined } as AccountInventory)
          // Derive pages for child components (keep existing MetaPage prop interface)
          setPages(
            inv.pages.map((p) => {
              const ig = inv.ig_accounts.find((a) => a.connected_page_id === p.page_id)
              return {
                id: p.page_id,
                name: p.name,
                picture: p.picture,
                instagram_business_account: ig ? { id: ig.ig_id } : undefined,
              }
            })
          )
        } else {
          setPagesError(data.message || t.pagesLoadFailed)
        }
      })
      .catch(() => {
        if (!cancelled) setPagesError(t.connectionError)
      })
      .finally(() => {
        if (!cancelled) {
          setPagesLoading(false)
          setPagesInitialLoadDone(true)
          setInstagramLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [isOpen])

  // ── Page-scoped inventory re-fetch: WhatsApp numbers depend on selected page ──
  // Single source of truth: /api/meta/inventory?page_id=X. No capabilities/canCTWA.
  // Early fetch: when pages loaded but user hasn't selected, pre-fetch for first page so step 2 WhatsApp is ready.
  const lastFetchedPageIdRef = useRef<string | undefined>(undefined)
  const defaultPageId = pagesInitialLoadDone && pages.length >= 1 ? pages[0].id : null
  const effectivePageId = state.adset.pageId || defaultPageId

  useEffect(() => {
    const pageId = effectivePageId
    if (!isOpen || !pageId) {
      lastFetchedPageIdRef.current = undefined
      setInventoryStatus('idle')
      setInventoryPageId(null)
      if (!isOpen) console.log('[CampaignWizard] INVENTORY_FETCH_RESET', { reason: 'modal_closed' })
      else if (!pageId) console.log('[CampaignWizard] INVENTORY_FETCH_RESET', { reason: 'pageId_cleared' })
      return
    }
    if (lastFetchedPageIdRef.current === pageId) return

    lastFetchedPageIdRef.current = pageId
    setInventoryStatus('loading')
    console.log('[CampaignWizard] INVENTORY_FETCH_START', { pageId })

    let cancelled = false
    fetch(`/api/meta/inventory?page_id=${encodeURIComponent(pageId)}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (!data.ok || !data.data) {
          setInventoryStatus('error')
          console.log('[CampaignWizard] INVENTORY_FETCH_ERROR', { pageId, reason: 'response_not_ok' })
          return
        }
        const inv = data.data as AccountInventory
        const newWabaNumbers = inv.whatsapp_phone_numbers ?? []
        const hasPageLinkedWhatsApp = newWabaNumbers.length > 0 || !!inv.page_whatsapp_number || inv.page_has_whatsapp === true

        setInventory((prev) => {
          if (!prev) return { ...inv, adAccountId: capabilities?.adAccountId ?? undefined } as AccountInventory
          const pageHasWhatsApp = hasPageLinkedWhatsApp
          return {
            ...prev,
            whatsapp_phone_numbers: newWabaNumbers,
            page_whatsapp_number: inv.page_whatsapp_number,
            page_whatsapp_number_source: inv.page_whatsapp_number_source,
            page_has_whatsapp: inv.page_has_whatsapp,
            whatsapp_diagnostics: inv.whatsapp_diagnostics,
            whatsapp_error: inv.whatsapp_error,
            pages: prev.pages.map(p =>
              p.page_id === pageId ? { ...p, has_whatsapp: pageHasWhatsApp || p.has_whatsapp } : p
            ),
          }
        })
        setInventoryPageId(pageId)
        setInventoryStatus('loaded')

        // Only adjust conversionLocation/phone when this fetch is for the user-selected page (not pre-fetch)
        setState((prev) => {
          if (prev.adset.pageId !== pageId) return prev
          let next = prev
          if (!hasPageLinkedWhatsApp && prev.adset.conversionLocation === 'WHATSAPP') {
            const allowed = getAllowedDestinations(prev.campaign.objective ?? '')
            const fallback = allowed.find((d) => d !== 'WHATSAPP') ?? allowed[0] ?? 'WEBSITE'
            next = {
              ...prev,
              adset: {
                ...prev.adset,
                conversionLocation: fallback,
                destinationDetails: {
                  ...prev.adset.destinationDetails,
                  messaging: {
                    ...prev.adset.destinationDetails?.messaging,
                    whatsappPhoneNumberId: undefined,
                    whatsappDisplayPhone: undefined,
                    whatsappSourceLayer: undefined,
                  },
                },
              },
            }
          }
          const currentPhoneId = next.adset.destinationDetails?.messaging?.whatsappPhoneNumberId
          if (currentPhoneId && !newWabaNumbers.some((n) => n.phoneNumberId === currentPhoneId)) {
            next = {
              ...next,
              adset: {
                ...next.adset,
                destinationDetails: {
                  ...next.adset.destinationDetails,
                  messaging: {
                    ...next.adset.destinationDetails?.messaging,
                    whatsappPhoneNumberId: undefined,
                    whatsappDisplayPhone: undefined,
                    whatsappSourceLayer: undefined,
                  },
                },
              },
            }
          }
          return next
        })

        console.log('[CampaignWizard] INVENTORY_FETCH_SUCCESS', { pageId, wa_count: newWabaNumbers.length, page_wa: inv.page_whatsapp_number ?? 'null' })
      })
      .catch((e) => {
        if (!cancelled) {
          setInventoryStatus('error')
          console.log('[CampaignWizard] INVENTORY_FETCH_ERROR', { pageId, reason: 'fetch_failed', error: e instanceof Error ? e.message : String(e) })
        }
      })
    return () => { cancelled = true }
  }, [isOpen, state.adset.pageId, pagesInitialLoadDone, pages, effectivePageId])

  // Derive Instagram account from inventory when pageId changes
  useEffect(() => {
    if (!state.adset.pageId || !inventory) {
      setInstagramAccount(null)
      return
    }
    const ig = inventory.ig_accounts.find((a) => a.connected_page_id === state.adset.pageId)
    if (ig) {
      setInstagramAccount({ id: ig.ig_id, username: ig.username, profile_picture_url: ig.profile_picture_url })
    } else {
      setInstagramAccount(null)
    }
  }, [state.adset.pageId, inventory])

  // ── Keep igRateLimitUntilRef in sync so the verify effect can read it without a dep ──
  useEffect(() => { igRateLimitUntilRef.current = igRateLimitUntil }, [igRateLimitUntil])

  // ── Deterministic IG verify: fires once on conversionLocation/pageId change ──────
  // Rules: debounce 900ms, single-flight per pageId, 10-min cache, no auto-retry.
  useEffect(() => {
    if (igVerifyDebounceRef.current) clearTimeout(igVerifyDebounceRef.current)

    const convLoc = state.adset.conversionLocation
    const pageId  = state.adset.pageId
    const step    = state.currentStep

    // Reset when conditions not met (step left, dialog closed, location changed)
    if (!isOpen || convLoc !== 'INSTAGRAM_DIRECT' || !pageId || step !== 2) {
      setIgVerifyStatus('idle')
      setIgVerifyMsg(null)
      setIgVerifyErrorKind(null)
      setIgVerifyUsername(null)
      setIgVerifyIgUserId(null)
      igVerifyAbortRef.current?.abort()
      return
    }

    // Rate-limit cooldown active → blocked; do NOT auto-trigger when it expires
    const rlUntil = igRateLimitUntilRef.current
    if (rlUntil && Date.now() < rlUntil) {
      setIgVerifyStatus('blocked_rate_limit')
      setIgVerifyErrorKind('meta_rate_limited')
      setIgVerifyMsg(null) // countdown shown separately via igRateLimitCountdown
      return
    }

    // localStorage cache hit → use it, no request
    const cached = readIgVerifyLocalCache(pageId)
    if (cached) {
      setIgVerifyStatus('ok')
      setIgVerifyMsg(null)
      setIgVerifyErrorKind(null)
      setIgVerifyUsername(cached.username)
      setIgVerifyIgUserId(cached.instagramUserId)
      // Adset'e de IG account ID'yi yaz
      if (cached.instagramUserId) {
        setState((prev) => ({
          ...prev,
          adset: { ...prev.adset, instagramAccountId: cached.instagramUserId || '' },
        }))
      }
      return
    }

    // ── Inventory shortcut: IG data zaten /api/meta/inventory'den geldi ──
    if (inventory) {
      const igFromInv = inventory.ig_accounts.find(
        (a: { connected_page_id?: string }) => a.connected_page_id === pageId
      )
      if (igFromInv && igFromInv.ig_id) {
        writeIgVerifyLocalCache(pageId, {
          instagramUserId: igFromInv.ig_id,
          username: igFromInv.username ?? null,
          expiresAt: Date.now() + IG_VERIFY_CACHE_TTL_MS,
        })
        setIgVerifyStatus('ok')
        setIgVerifyMsg(null)
        setIgVerifyErrorKind(null)
        setIgVerifyUsername(igFromInv.username ?? null)
        setIgVerifyIgUserId(igFromInv.ig_id)
        // Adset'e de IG account ID'yi yaz — adset create'de instagram_actor_id olarak gidecek
        setState((prev) => ({
          ...prev,
          adset: { ...prev.adset, instagramAccountId: igFromInv.ig_id || '' },
        }))
        return
      }
      setIgVerifyStatus('error')
      setIgVerifyErrorKind('ig_not_linked_to_page')
      setIgVerifyMsg(t.igNotLinkedToPage)
      setIgVerifyUsername(null)
      setIgVerifyIgUserId(null)
      return
    }

    // In-flight for this pageId → already going, wait for response
    if (igVerifyInFlightRef.current.has(pageId)) {
      setIgVerifyStatus('verifying')
      return
    }

    // Debounce 900ms then fire a single request — no retry on any result
    igVerifyDebounceRef.current = setTimeout(() => {
      // Abort any previous request (different pageId)
      igVerifyAbortRef.current?.abort()
      const controller = new AbortController()
      igVerifyAbortRef.current = controller

      igVerifyInFlightRef.current.add(pageId)
      setIgVerifyStatus('verifying')
      setIgVerifyMsg(null)
      setIgVerifyErrorKind(null)

      fetch(`/api/meta/ig/verify?pageId=${encodeURIComponent(pageId)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data: {
          ok: boolean
          error?: string
          message?: string
          instagram_user_id?: string
          username?: string
          retryAfterSec?: number
        }) => {
          igVerifyInFlightRef.current.delete(pageId)
          if (data.ok) {
            writeIgVerifyLocalCache(pageId, {
              instagramUserId: data.instagram_user_id ?? '',
              username: data.username ?? null,
              expiresAt: Date.now() + IG_VERIFY_CACHE_TTL_MS,
            })
            setIgVerifyStatus('ok')
            setIgVerifyMsg(null)
            setIgVerifyErrorKind(null)
            setIgVerifyUsername(data.username ?? null)
            setIgVerifyIgUserId(data.instagram_user_id ?? null)
            // Adset'e de IG account ID'yi yaz
            if (data.instagram_user_id) {
              setState((prev) => ({
                ...prev,
                adset: { ...prev.adset, instagramAccountId: data.instagram_user_id || '' },
              }))
            }
          } else if (data.error === 'meta_rate_limited' || data.error === 'client_throttled') {
            const retryMs = (data.retryAfterSec ?? 120) * 1000
            setIgRateLimitUntil(Date.now() + retryMs)
            setIgVerifyStatus('blocked_rate_limit')
            setIgVerifyErrorKind(data.error)
            setIgVerifyMsg(null) // displayed via igRateLimitCountdown
            setIgVerifyUsername(null)
            setIgVerifyIgUserId(null)
          } else {
            // verify_in_progress and all other errors: show message, NO auto-retry
            setIgVerifyStatus('error')
            setIgVerifyErrorKind(data.error ?? null)
            setIgVerifyMsg(data.message ?? t.blockedIgFailed)
            setIgVerifyUsername(null)
            setIgVerifyIgUserId(null)
          }
        })
        .catch((e: unknown) => {
          igVerifyInFlightRef.current.delete(pageId)
          if (e instanceof Error && e.name === 'AbortError') return
          setIgVerifyStatus('error')
          setIgVerifyMsg(t.igVerifyFetchFailed)
          setIgVerifyErrorKind(null)
        })
    }, 900)

    return () => {
      if (igVerifyDebounceRef.current) clearTimeout(igVerifyDebounceRef.current)
    }
  // igRateLimitUntil intentionally excluded: changes read via ref, not re-trigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, state.adset.conversionLocation, state.adset.pageId, state.currentStep, inventory])

  // ── Rate-limit countdown timer — on expiry reset status to idle (user must re-interact) ──
  useEffect(() => {
    if (!igRateLimitUntil) {
      setIgRateLimitCountdown(null)
      return
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((igRateLimitUntil - Date.now()) / 1000))
      setIgRateLimitCountdown(remaining)
      if (remaining <= 0) {
        setIgRateLimitUntil(null)
        setIgRateLimitCountdown(null)
        // Reset to idle so user can change a field and trigger a fresh verify
        setIgVerifyStatus('idle')
        setIgVerifyErrorKind(null)
        setIgVerifyMsg(null)
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [igRateLimitUntil])

  // INSTAGRAM_DIRECT: ig.me linkini otomatik doldur (kullanıcı değiştirmemişse)
  useEffect(() => {
    if (
      igVerifyStatus !== 'ok' ||
      state.adset.conversionLocation !== 'INSTAGRAM_DIRECT' ||
      state.ad.websiteUrl?.trim()
    ) return
    const igDmLink = igVerifyUsername
      ? `https://ig.me/m/${igVerifyUsername}`
      : igVerifyIgUserId
        ? `https://ig.me/m/${igVerifyIgUserId}`
        : null
    if (igDmLink) updateAd({ websiteUrl: igDmLink })
  }, [igVerifyStatus, igVerifyUsername, igVerifyIgUserId, state.adset.conversionLocation])

  // WHATSAPP: phone number is explicitly selected by user from WABA numbers.
  // No auto-fill, no silent fallback. User must pick a number from the dropdown.
  // Selected number is sent in promoted_object.whatsapp_phone_number for explicit control.

  // When capabilities load and current destination is locked, switch to first unlocked
  useEffect(() => {
    if (!isOpen || !capabilities?.features) return
    const objective = state.campaign.objective
    const allowedDests = getAllowedDestinations(objective)
    const capabilityFiltered = allowedDests.filter((d) => {
      // WhatsApp: always allow in list; TabDetails locks/unlocks per-page via accountInventory
      if (d === 'WHATSAPP') return true
      if (d === 'ON_AD' && !capabilities!.features!.canLeadFormsCreate && objective !== 'OUTCOME_LEADS') return false
      if (d === 'WEBSITE' && !capabilities!.features!.canWebsite) return false
      return true
    })
    const current = state.adset.conversionLocation as DestinationId
    if (capabilityFiltered.includes(current)) return
    const defaultDest = objective === 'OUTCOME_LEADS' ? 'ON_AD' : 'WEBSITE'
    const firstAllowed = (objective === 'OUTCOME_LEADS' && capabilityFiltered.includes('ON_AD' as DestinationId))
      ? ('ON_AD' as DestinationId)
      : (capabilityFiltered[0] ?? allowedDests[0] ?? defaultDest)
    const allowedGoals = getAllowedOptimizationGoals(objective, firstAllowed)
    const nextGoal = allowedGoals[0] ?? state.adset.optimizationGoal
    const newCTA = getDefaultCTA(objective, firstAllowed, nextGoal)
    const needsUrl = requiresWebsiteUrl(objective, firstAllowed, nextGoal)
    setState((prev) => ({
      ...prev,
      adset: { ...prev.adset, conversionLocation: firstAllowed, optimizationGoal: nextGoal },
      ad: { ...prev.ad, callToAction: newCTA, websiteUrl: needsUrl ? prev.ad.websiteUrl : '' },
    }))
  }, [isOpen, capabilities, state.campaign.objective, state.adset.conversionLocation, state.adset.optimizationGoal])

  useEffect(() => {
    if (!isOpen) return
    if (state.currentStep < 2) return
    const objective = state.campaign.objective
    const conversionLocation = state.adset.conversionLocation
    const optimizationGoal = state.adset.optimizationGoal
    discoveryAbortRef.current?.abort()
    discoveryAbortRef.current = new AbortController()
    setDiscoveryLoading(true)
    setDiscoveryPatch(null)
    fetch('/api/meta/discovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objective,
        conversionGroup: conversionLocation,
        destinationType: conversionLocation,
        optimizationGoal,
        hasCampaignBudget: false,
        draftFields: { pageId: state.adset.pageId || undefined },
      }),
      signal: discoveryAbortRef.current.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.specPatch) {
          setDiscoveryPatch(data.specPatch as DiscoverySpecPatch)
          if (data.specPatch.invalidCombination) {
            const allowedGoals = getAllowedOptimizationGoals(objective, conversionLocation)
            const firstGoal = allowedGoals[0]
            if (firstGoal && optimizationGoal !== firstGoal) {
              setState((prev) => ({
                ...prev,
                adset: { ...prev.adset, optimizationGoal: firstGoal },
                ad: { ...prev.ad, callToAction: getDefaultCTA(objective, conversionLocation, firstGoal) },
              }))
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setDiscoveryLoading(false))
    return () => {
      discoveryAbortRef.current?.abort()
    }
  }, [isOpen, state.campaign.objective, state.adset.conversionLocation, state.adset.optimizationGoal])

  // ── Auto-sync: optimizationGoal allowed listesinde yoksa ilk allowed goal'e düzelt ──
  useEffect(() => {
    if (!isOpen) return
    if (state.currentStep < 2) return
    const objective = state.campaign.objective
    const dest = state.adset.conversionLocation
    const currentGoal = state.adset.optimizationGoal
    const allowedGoals = getAllowedOptimizationGoals(objective, dest)
    const filteredGoals = objective === 'OUTCOME_ENGAGEMENT'
      ? allowedGoals.filter((g) => g !== 'OFFSITE_CONVERSIONS')
      : allowedGoals
    if (filteredGoals.length > 0 && (!currentGoal || !filteredGoals.includes(currentGoal))) {
      setState((prev) => ({
        ...prev,
        adset: { ...prev.adset, optimizationGoal: filteredGoals[0] },
      }))
    }
  }, [isOpen, state.campaign.objective, state.adset.conversionLocation, state.adset.optimizationGoal])

  // App Promotion / Traffic+APP: Step 3'e geçildiğinde ad.websiteUrl boşsa store URL ile doldur
  useEffect(() => {
    if (state.currentStep !== 3 || state.ad.websiteUrl?.trim()) return
    const storeUrl =
      state.campaign.objective === 'OUTCOME_APP_PROMOTION'
        ? state.campaign.appStoreUrl?.trim()
        : state.campaign.objective === 'OUTCOME_TRAFFIC' && state.adset.conversionLocation === 'APP'
          ? state.adset.appStoreUrl?.trim()
          : null
    if (storeUrl) updateAd({ websiteUrl: storeUrl })
  }, [
    state.currentStep,
    state.campaign.objective,
    state.campaign.appStoreUrl,
    state.adset.conversionLocation,
    state.adset.appStoreUrl,
    state.ad.websiteUrl,
  ])

  // ── Min-budget inline error — recomputed whenever budget value, type, or mode changes ──
  // Campaign step CBO + daily: use /api/fx/usdtry (campaignMinDailyTry / campaignFxError).
  // Otherwise: ENV-based minDailyTry for backward compatibility.
  useEffect(() => {
    const isCBO = state.campaign.budgetOptimization === 'campaign'
    const isDaily = (state.campaign.campaignBudgetType ?? 'daily') === 'daily'
    if (isCBO && isDaily) {
      if (campaignFxError) {
        setCampaignMinBudgetError(campaignFxError)
        return
      }
      if (campaignMinDailyTry != null && state.campaign.campaignBudget != null && state.campaign.campaignBudget > 0 && state.campaign.campaignBudget < campaignMinDailyTry) {
        setCampaignMinBudgetError(t.budgetMinDailyTry.replace('{min}', String(Math.ceil(campaignMinDailyTry))))
        return
      }
      setCampaignMinBudgetError(null)
      return
    }
    const minDaily = (state.campaign.campaignBudgetType === 'lifetime' || minDailyTry == null) ? undefined : minDailyTry
    setCampaignMinBudgetError(
      getMinBudgetError(
        state.campaign.campaignBudget,
        state.campaign.campaignBudgetType ?? 'daily',
        minDaily,
        t.budgetMinDailyTry,
        t.minLifetimeBudgetInfo,
      ),
    )
  }, [
    state.campaign.campaignBudget,
    state.campaign.campaignBudgetType,
    state.campaign.budgetOptimization,
    minDailyTry,
    campaignMinDailyTry,
    campaignFxError,
    t.budgetMinDailyTry,
    t.minLifetimeBudgetInfo,
  ])

  useEffect(() => {
    const minDaily = (state.adset.budgetType === 'lifetime' || minDailyTry == null) ? undefined : minDailyTry
    setAdSetMinBudgetError(
      getMinBudgetError(
        state.adset.budget,
        state.adset.budgetType,
        minDaily,
        t.budgetMinDailyTry,
        t.minLifetimeBudgetInfo,
      ),
    )
  }, [
    state.adset.budget,
    state.adset.budgetType,
    state.campaign.budgetOptimization,
    minDailyTry,
  ])

  // ── Objective değişince HARD RESET: campaign name hariç tüm state sıfırlanır ──
  // ── Budget owner (CBO↔ABO) değişince bid alanları reset ──
  const updateCampaign = useCallback((updates: Partial<WizardState['campaign']>) => {
    setState((prev) => {
      const nextCampaign = { ...prev.campaign, ...updates }
      const objective = nextCampaign.objective

      if (updates.objective !== undefined) {
        const allowedDests = getAllowedDestinations(objective)
        const capabilityFiltered = capabilities?.features
          ? allowedDests.filter((d) => {
              if (d === 'WHATSAPP') return true // TabDetails locks/unlocks per-page via accountInventory
              if (d === 'ON_AD' && !capabilities!.features!.canLeadFormsCreate && objective !== 'OUTCOME_LEADS') return false
              if (d === 'WEBSITE' && !capabilities!.features!.canWebsite) return false
              return true
            })
          : allowedDests
        const defaultDest = objective === 'OUTCOME_LEADS' ? 'ON_AD' : 'WEBSITE'
        const firstAllowed = (objective === 'OUTCOME_LEADS' && capabilityFiltered.includes('ON_AD' as DestinationId))
          ? ('ON_AD' as DestinationId)
          : (capabilityFiltered[0] ?? allowedDests[0] ?? defaultDest)
        const nextConversionLocation = (objective === 'OUTCOME_LEADS' && capabilityFiltered.includes('ON_AD' as DestinationId))
          ? ('ON_AD' as DestinationId)
          : (allowedDests.includes(prev.adset.conversionLocation as DestinationId) && capabilityFiltered.includes(prev.adset.conversionLocation as DestinationId)
            ? prev.adset.conversionLocation
            : firstAllowed)

        const allowedGoals = getAllowedOptimizationGoals(objective, nextConversionLocation)
        const nextOptimizationGoal = allowedGoals.includes(prev.adset.optimizationGoal)
          ? prev.adset.optimizationGoal
          : (allowedGoals[0] ?? 'LINK_CLICKS')
        const freshCTA = getDefaultCTA(objective, nextConversionLocation, nextOptimizationGoal)
        const needsUrl = requiresWebsiteUrl(objective, nextConversionLocation, nextOptimizationGoal)
        const isIgMeLink = prev.ad.websiteUrl?.includes('ig.me/m/')
        const websiteUrl = needsUrl ? (isIgMeLink && nextConversionLocation !== 'INSTAGRAM_DIRECT' ? '' : prev.ad.websiteUrl) : ''

        const freshAdset: WizardState['adset'] = {
          ...initialWizardState.adset,
          conversionLocation: nextConversionLocation,
          optimizationGoal: nextOptimizationGoal,
        }
        const freshAd: WizardState['ad'] = {
          ...initialWizardState.ad,
          callToAction: freshCTA,
          websiteUrl,
        }

        setBidRequirementMode(false)
        setAllowedBidStrategies(null)

        const campaignCleaned =
          objective === 'OUTCOME_APP_PROMOTION'
            ? { ...nextCampaign, ios14Campaign: nextCampaign.ios14Campaign ?? false, advantagePlusApp: nextCampaign.advantagePlusApp !== false }
            : { ...nextCampaign, appId: undefined, appStoreUrl: undefined, ios14Campaign: undefined, advantagePlusApp: undefined }

        const CBO_NOT_ALLOWED = ['OUTCOME_APP_PROMOTION']
        if (CBO_NOT_ALLOWED.includes(objective)) {
          campaignCleaned.budgetOptimization = 'adset'
        }

        return { ...prev, campaign: campaignCleaned, adset: freshAdset, ad: freshAd }
      }

      // Budget owner (CBO↔ABO) değişince bid alanları reset
      if (updates.budgetOptimization !== undefined && updates.budgetOptimization !== prev.campaign.budgetOptimization) {
        setBidRequirementMode(false)
        setAllowedBidStrategies(null)
        return {
          ...prev,
          campaign: nextCampaign,
          adset: { ...prev.adset, bidStrategy: undefined, bidAmount: undefined },
        }
      }

      return { ...prev, campaign: nextCampaign }
    })
    setStepErrors((prev) => ({
      ...prev,
      name: '',
      ...('campaignBudget' in updates ? { budget: '' } : undefined),
    }))
  }, [])

  // ── Adset güncelleme — destination değişince bid/goal/CTA reset, goal değişince CTA + bid revalidate ──
  const updateAdset = useCallback((updates: Partial<WizardState['adset']>) => {
    if ('budget' in updates) {
      setStepErrors((prev) => ({ ...prev, budget: '' }))
    }
    if (updates.budget != null && minBudgetRequirement && Number(updates.budget) >= minBudgetRequirement.minDailyBudgetTry) {
      setMinBudgetRequirement(null)
    }
    setState((prev) => {
      const nextAdset = { ...prev.adset, ...updates }
      const objective = prev.campaign.objective
      const dest = nextAdset.conversionLocation
      const goal = nextAdset.optimizationGoal

      if (updates.conversionLocation !== undefined) {
        const allowedGoals = getAllowedOptimizationGoals(objective, dest)
        const nextGoal = allowedGoals.includes(prev.adset.optimizationGoal)
          ? prev.adset.optimizationGoal
          : (allowedGoals[0] ?? goal)
        const defaultCTA = getDefaultCTA(objective, dest, nextGoal)

        const needsUrl = requiresWebsiteUrl(objective, dest, nextGoal)

        // Destination değişince: bid alanları + bidRequirementMode reset
        setBidRequirementMode(false)
        setAllowedBidStrategies(null)

        // Destination-dependent alanları temizle (yeni dest gerektirmiyorsa)
        const needsPixel =
          (objective === 'OUTCOME_SALES' && dest === 'WEBSITE') ||
          (objective === 'OUTCOME_ENGAGEMENT' && dest === 'WEBSITE') ||
          (objective === 'OUTCOME_LEADS' && dest === 'WEBSITE')
        const needsApp =
          (objective === 'OUTCOME_TRAFFIC' && dest === 'APP') ||
          (objective === 'OUTCOME_ENGAGEMENT' && dest === 'APP') ||
          (objective === 'OUTCOME_SALES' && dest === 'APP')
        const needsCatalog = objective === 'OUTCOME_SALES' && dest === 'CATALOG'
        const needsIg = (objective === 'OUTCOME_TRAFFIC' && dest === 'INSTAGRAM_DIRECT') || (objective === 'OUTCOME_ENGAGEMENT' && dest === 'INSTAGRAM_DIRECT')
        const needsChatGreeting =
          (objective === 'OUTCOME_ENGAGEMENT' && (dest === 'MESSENGER' || dest === 'WHATSAPP')) ||
          (objective === 'OUTCOME_LEADS' && (dest === 'MESSENGER' || dest === 'WHATSAPP')) ||
          (objective === 'OUTCOME_SALES' && (dest === 'MESSENGER' || dest === 'WHATSAPP'))
        const needsPhone = (objective === 'OUTCOME_ENGAGEMENT' && dest === 'CALL') || (objective === 'OUTCOME_LEADS' && dest === 'CALL')
        const needsLeadForm = objective === 'OUTCOME_LEADS' && dest === 'ON_AD'

        const clearedAdset = {
          ...nextAdset,
          optimizationGoal: nextGoal,
          bidStrategy: undefined,
          bidAmount: undefined,
          pixelId: needsPixel ? nextAdset.pixelId : undefined,
          customEventType: needsPixel ? nextAdset.customEventType : undefined,
          appId: needsApp ? nextAdset.appId : undefined,
          appStoreUrl: needsApp ? nextAdset.appStoreUrl : undefined,
          catalogId: needsCatalog ? nextAdset.catalogId : undefined,
          productSetId: needsCatalog ? nextAdset.productSetId : undefined,
          instagramAccountId: nextAdset.instagramAccountId,
        }
        const clearedAd = {
          ...prev.ad,
          callToAction: defaultCTA,
          websiteUrl: needsUrl ? prev.ad.websiteUrl : '',
          chatGreeting: needsChatGreeting ? prev.ad.chatGreeting : undefined,
          phoneNumber: needsPhone ? prev.ad.phoneNumber : undefined,
          leadFormId: needsLeadForm ? prev.ad.leadFormId : undefined,
        }

        return { ...prev, adset: clearedAdset, ad: clearedAd }
      }
      if (updates.optimizationGoal !== undefined) {
        const defaultCTA = getDefaultCTA(objective, dest, goal)
        // Performance goal değişince: bid alanlarını revalidate (sıfırla)
        return {
          ...prev,
          adset: { ...nextAdset, bidStrategy: undefined, bidAmount: undefined },
          ad: { ...prev.ad, callToAction: defaultCTA },
        }
      }
      return { ...prev, adset: nextAdset }
    })
  }, [minBudgetRequirement])

  const updateAd = useCallback((updates: Partial<WizardState['ad']>) => {
    setState((prev) => ({ ...prev, ad: { ...prev.ad, ...updates } }))
  }, [])

  const validateStep1 = (): boolean => {
    const err: Record<string, string> = {}
    // name required is indicated by asterisk; don't add to stepErrors
    if (state.campaign.objective === 'OUTCOME_APP_PROMOTION') {
      if (!state.campaign.appId?.trim()) err.app_id = t.appRequired
      if (!state.campaign.appStoreUrl?.trim()) err.app_store_url = t.appStoreUrlRequired
      else {
        const url = state.campaign.appStoreUrl.trim()
        if (!url.startsWith('https://')) err.app_store_url = t.appStoreUrlHttps
        else if (!url.includes('play.google.com') && !url.includes('apps.apple.com')) {
          err.app_store_url = t.appStoreUrlInvalidStore
        }
      }
    }
    setStepErrors(err)
    return Object.keys(err).length === 0
  }

  const validateStep2 = (): boolean => {
    console.log('[validateStep2] optimizationGoal:', state.adset.optimizationGoal, '| objective:', state.campaign.objective, '| dest:', state.adset.conversionLocation)
    const err: Record<string, string> = {}
    // name/pageId required indicated by asterisk; don't add to stepErrors
    // Sales + WEBSITE: pixel ve dönüşüm olayı zorunlu
    if (state.campaign.objective === 'OUTCOME_SALES' && state.adset.conversionLocation === 'WEBSITE') {
      if (!state.adset.pixelId?.trim()) err.pixel_id = t.pixelRequired
      if (!state.adset.customEventType?.trim()) err.conversion_event = t.conversionEventRequired
    }
    // Sales + CATALOG: katalog zorunlu
    if (state.campaign.objective === 'OUTCOME_SALES' && state.adset.conversionLocation === 'CATALOG') {
      if (!state.adset.catalogId?.trim()) err.catalog_id = t.catalogRequired
    }
    // Sales + APP: uygulama ve mağaza linki
    if (state.campaign.objective === 'OUTCOME_SALES' && state.adset.conversionLocation === 'APP') {
      if (!state.adset.appId?.trim()) err.app_id = t.appRequired
      if (!state.adset.appStoreUrl?.trim()) err.app_store_url = t.appStoreUrlRequired
      else {
        const url = state.adset.appStoreUrl.trim()
        if (!url.startsWith('https://')) err.app_store_url = t.appStoreUrlHttps
        else if (!url.includes('play.google.com') && !url.includes('apps.apple.com')) {
          err.app_store_url = t.appStoreUrlInvalidStore
        }
      }
    }
    // Traffic + APP: uygulama ve mağaza linki (adset)
    if (state.campaign.objective === 'OUTCOME_TRAFFIC' && state.adset.conversionLocation === 'APP') {
      if (!state.adset.appId?.trim()) err.app_id = t.appRequired
      if (!state.adset.appStoreUrl?.trim()) err.app_store_url = t.appStoreUrlRequired
      else {
        const url = state.adset.appStoreUrl.trim()
        if (!url.startsWith('https://')) err.app_store_url = t.appStoreUrlHttps
        else if (!url.includes('play.google.com') && !url.includes('apps.apple.com')) {
          err.app_store_url = t.appStoreUrlInvalidStore
        }
      }
    }
    // INSTAGRAM_DIRECT: IG verify gate (server-side resolve)
    if (state.adset.conversionLocation === 'INSTAGRAM_DIRECT') {
      if (igVerifyStatus === 'error' && igVerifyMsg) {
        err.ig_account = igVerifyMsg
      } else if (igVerifyStatus === 'blocked_rate_limit') {
        err.ig_account = t.igRateLimited
      } else if (igVerifyStatus === 'verifying') {
        err.ig_account = t.igVerifyChecking
      }
    }
    // Traffic + INSTAGRAM_DIRECT: Instagram hesabı zorunlu
    if (state.campaign.objective === 'OUTCOME_TRAFFIC' && state.adset.conversionLocation === 'INSTAGRAM_DIRECT') {
      if (!state.adset.instagramAccountId?.trim()) err.ig_account = err.ig_account ?? t.instagramAccountRequired
    }
    // OUTCOME_ENGAGEMENT + WEBSITE: Meta API restriction (error 2490408) — pixel/conversion not supported, no check needed
    // Engagement + APP: uygulama ve mağaza linki
    if (state.campaign.objective === 'OUTCOME_ENGAGEMENT' && state.adset.conversionLocation === 'APP') {
      if (!state.adset.appId?.trim()) err.app_id = t.appRequired
      if (!state.adset.appStoreUrl?.trim()) err.app_store_url = t.appStoreUrlRequired
      else {
        const url = state.adset.appStoreUrl.trim()
        if (!url.startsWith('https://')) err.app_store_url = t.appStoreUrlHttps
        else if (!url.includes('play.google.com') && !url.includes('apps.apple.com')) {
          err.app_store_url = t.appStoreUrlInvalidStore
        }
      }
    }
    // Engagement + INSTAGRAM_DIRECT: Instagram hesabı zorunlu
    if (state.campaign.objective === 'OUTCOME_ENGAGEMENT' && state.adset.conversionLocation === 'INSTAGRAM_DIRECT') {
      if (!state.adset.instagramAccountId?.trim()) err.ig_account = err.ig_account ?? t.instagramAccountRequired
    }
    // App Promotion: mağaza tipi zorunlu; store URL mağaza ile eşleşmeli
    if (state.campaign.objective === 'OUTCOME_APP_PROMOTION') {
      if (!state.adset.appStore?.trim()) err.app_store = t.appStoreTypeRequired
      const storeUrl = state.campaign.appStoreUrl?.trim() ?? ''
      const appStore = (state.adset.appStore ?? 'GOOGLE_PLAY').toUpperCase()
      if (storeUrl && appStore === 'GOOGLE_PLAY' && !storeUrl.includes('play.google.com')) {
        err.app_store_url = t.googlePlayUrlRequired
      }
      if (storeUrl && appStore === 'APPLE_APP_STORE' && !storeUrl.includes('apps.apple.com')) {
        err.app_store_url = t.appStoreIosUrlRequired
      }
    }
    // CALL: telefon numarası zorunlu
    if (state.adset.conversionLocation === 'CALL') {
      if (!state.adset.destinationDetails?.calls?.phoneNumber?.trim()) {
        err.phone_number = t.phoneNumberRequired
      }
    }
    // Leads + WEBSITE: pixel ve dönüşüm olayı
    if (state.campaign.objective === 'OUTCOME_LEADS' && state.adset.conversionLocation === 'WEBSITE') {
      if (!state.adset.pixelId?.trim()) err.pixel_id = t.pixelRequired
      if (!state.adset.customEventType?.trim()) err.conversion_event = t.conversionEventRequired
    }
    const isCapStep2 = state.adset.bidStrategy != null && CAP_STRATEGIES.includes(state.adset.bidStrategy)
    if (isCapStep2 && (!state.adset.bidAmount || state.adset.bidAmount <= 0)) err.bidAmount = t.bidCapRequired
    // Budget required is indicated by asterisk; inline min-budget error handled via adSetMinBudgetError
    const isCBOCampaign = state.campaign.budgetOptimization === 'campaign'
    if (state.adset.bidStrategy === 'LOWEST_COST_WITH_BID_CAP' && (!state.adset.bidAmount || state.adset.bidAmount <= 0)) {
      err.bidAmount = t.bidCapRequired
    }
    if (bidRequirementMode && allowedBidStrategies?.length) {
      if (!state.adset.bidAmount || state.adset.bidAmount <= 0) {
        err.bidAmount = t.bidAmountRequired
      } else if (!state.adset.bidStrategy || !allowedBidStrategies.includes(state.adset.bidStrategy)) {
        err.bidAmount = t.bidStrategyAndAmountRequired
      }
    }

    // Optimization goal: AWARENESS & ENGAGEMENT için goal gerekli — boşsa/geçersizse auto-set, validation DAIMA geçer
    const requiresOptimizationGoal = 
      state.campaign.objective === 'OUTCOME_AWARENESS' || 
      state.campaign.objective === 'OUTCOME_ENGAGEMENT'
    if (requiresOptimizationGoal) {
      const allowedGoals = getAllowedOptimizationGoals(state.campaign.objective, state.adset.conversionLocation)
      const filteredGoals = state.campaign.objective === 'OUTCOME_ENGAGEMENT'
        ? allowedGoals.filter((g) => g !== 'OFFSITE_CONVERSIONS')
        : allowedGoals
      if (filteredGoals.length > 0 && (!state.adset.optimizationGoal?.trim() || !filteredGoals.includes(state.adset.optimizationGoal))) {
        setState((prev) => ({
          ...prev,
          adset: { ...prev.adset, optimizationGoal: filteredGoals[0] },
        }))
      }
      // err.performance_goal ASLA set edilmez — dropdown her zaman geçerli bir goal gösteriyor
    }

    setStepErrors(err)
    return Object.keys(err).length === 0
  }

  // ── Destination-aware validation ──
  const validateStep3 = (): boolean => {
    const err: Record<string, string> = {}
    if (!state.ad.name.trim()) err.name = t.adNameRequired

    // Existing post mode: validate post selection and websiteUrl (if CTA selected)
    if (state.ad.adCreationMode === 'existing') {
      if (!state.ad.existingPostId) err.existing_post = t.selectPost
      // websiteUrl only required if CTA is selected
      if (state.ad.callToAction && !state.ad.websiteUrl.trim()) {
        err.websiteUrl = t.websiteUrlRequired
      }
      setStepErrors(err)
      return Object.keys(err).length === 0
    }

    // Create mode: validate all creative fields
    if (!state.ad.primaryText.trim()) err.primaryText = t.primaryTextRequired

    // websiteUrl sadece destination gerektiriyorsa zorunlu
    const needsUrl = requiresWebsiteUrl(
      state.campaign.objective,
      state.adset.conversionLocation,
      state.adset.optimizationGoal
    )
    if (needsUrl && !state.ad.websiteUrl.trim()) {
      err.websiteUrl = t.websiteUrlRequired
    }

    // Leads + ON_AD: Potansiyel müşteri formu zorunlu (Step 2 destinationDetails veya Step 3 ad.leadFormId)
    if (state.campaign.objective === 'OUTCOME_LEADS' && state.adset.conversionLocation === 'ON_AD') {
      if (!state.ad.leadFormId?.trim() && !state.adset.destinationDetails?.leads?.leadFormId?.trim()) {
        err.lead_form = t.leadFormRequired
      }
    }

    // Leads + CALL: telefon numarası zorunlu
    if (state.campaign.objective === 'OUTCOME_LEADS' && state.adset.conversionLocation === 'CALL') {
      if (!state.ad.phoneNumber?.trim() && !state.adset.destinationDetails?.calls?.phoneNumber?.trim()) err.phone_number = t.phoneNumberEnter
    }

    // Engagement + CALL: telefon numarası zorunlu
    if (state.campaign.objective === 'OUTCOME_ENGAGEMENT' && state.adset.conversionLocation === 'CALL') {
      if (!state.ad.phoneNumber?.trim() && !state.adset.destinationDetails?.calls?.phoneNumber?.trim()) err.phone_number = t.phoneNumberEnter
    }

    // Traffic + CALL: telefon numarası zorunlu
    if (state.campaign.objective === 'OUTCOME_TRAFFIC' && state.adset.conversionLocation === 'CALL') {
      if (!state.ad.phoneNumber?.trim() && !state.adset.destinationDetails?.calls?.phoneNumber?.trim()) err.phone_number = t.phoneNumberEnter
    }

    if (state.ad.format === 'single_image' && !state.ad.media.preview) err.media = t.imageRequired
    if (state.ad.format === 'single_video' && !state.ad.media.preview) err.media = t.videoRequired
    if (state.ad.format === 'carousel' && state.ad.carouselCards.length < 2) err.carousel = t.minCarouselCards
    setStepErrors(err)
    return Object.keys(err).length === 0
  }

  /**
   * Run preflight validation (inventory gating + field check).
   * Returns true if OK, false if blocked. Handles UI side-effects (toast, step redirect, errors).
   */
  const runPreflight = (): boolean => {
    const result: PreflightResult = preflight(
      state.campaign.objective,
      state.adset.conversionLocation,
      state,
      inventory,
      minDailyBudgetTry.status === 'ready' ? minDailyBudgetTry.value : undefined
    )

    if (result.ok) return true

    // Blocked by inventory gating
    if (result.blocked_reason) {
      const message = result.blocked_message || BLOCKED_REASON_MESSAGES[result.blocked_reason] || t.preflightMissingResource
      onToast?.(message, 'error')

      // Route to relevant step based on blocked_reason
      const stepMap: Partial<Record<BlockedReason, 1 | 2 | 3>> = {
        NO_PAGE: 2,
        NO_PIXEL: 2,
        NO_FORMS: 2,
        LEAD_TERMS_NOT_ACCEPTED: 2,
        NO_APP: 1,
        NO_CATALOG: 2,
        NO_WHATSAPP: 2,
        NO_MESSENGER: 2,
        MIN_BUDGET: 2,
      }
      const targetStep = stepMap[result.blocked_reason] ?? 2
      setState((prev) => ({ ...prev, currentStep: targetStep }))
      return false
    }

    // Missing fields
    if (result.missing_fields && result.missing_fields.length > 0) {
      // Go to the first missing field's step
      const firstMissing = result.missing_fields[0]
      setState((prev) => ({ ...prev, currentStep: firstMissing.step as 1 | 2 | 3 | 4 }))

      // Set all errors from missing_fields
      const errs: Record<string, string> = {}
      for (const mf of result.missing_fields) {
        errs[mf.field] = mf.message
      }
      setStepErrors(errs)
      onToast?.(firstMissing.message, 'error')
      return false
    }

    return true
  }

  const goNext = () => {
    const step = state.currentStep
    const stepKey = numberToStepKey(step as 1 | 2 | 3)
    const objectiveSpec = state.campaign.objective ? getSpecByApiObjective(state.campaign.objective) : null
    if (objectiveSpec) {
      const result = validateStepsUpTo(objectiveSpec, stepKey, state as unknown as import('./wizard/spec/types').SpecWizardState, wizardEmptyCapabilities)
      if (!result.ok) {
        const errs: Record<string, string> = {}
        const msg = specT(getSpecLocale(), result.messageKey)
        for (const m of result.missing) {
          const uiKey = specFieldKeyToErrorKey(m)
          errs[uiKey] = msg
        }
        setStepErrors(errs)
        onToast?.(msg, 'error')
        return
      }
    }
    if (step === 1 && !validateStep1()) { onToast?.(t.validationErrorStep1 ?? 'Kampanya bilgilerini kontrol edin.', 'error'); return }
    if (step === 2 && !validateStep2()) { onToast?.(t.validationErrorStep2 ?? 'Reklam seti bilgilerini kontrol edin.', 'error'); return }
    if (step === 3 && !validateStep3()) { onToast?.(t.validationErrorStep3 ?? 'Reklam bilgilerini kontrol edin.', 'error'); return }
    if (step < 4) {
      setState((prev) => ({ ...prev, currentStep: (prev.currentStep + 1) as 1 | 2 | 3 | 4 }))
    }
  }

  const goBack = () => {
    if (state.currentStep > 1) {
      setState((prev) => ({ ...prev, currentStep: (prev.currentStep - 1) as 1 | 2 | 3 | 4 }))
    }
  }

  const handleClose = useCallback(() => {
    resetWizardState()
    onClose()
  }, [resetWizardState, onClose])

  const runCreateFlow = async (status: 'ACTIVE' | 'PAUSED') => {
    setPublishError(null)
    // TRY -> adCurrency dönüşüm fonksiyonu
    const fxRate = fxState.rate
    if (!fxRate || fxState.status !== 'ready') {
      throw new Error(t.fxUnavailable)
    }
    const tryToAd = (tryVal: number) => tryVal / fxRate

    const CBO_NOT_ALLOWED = ['OUTCOME_APP_PROMOTION']
    const isCBO = state.campaign.budgetOptimization === 'campaign' && !CBO_NOT_ALLOWED.includes(state.campaign.objective)

    // ── 1. Campaign create ──
    const campaignPayload: Record<string, unknown> = {
      name: state.campaign.name.trim(),
      objective: state.campaign.objective,
      // Backend ["NONE"] olarak normalize eder; boş array göndermek yeterli.
      specialAdCategories: state.campaign.specialAdCategories.filter((c) => c !== 'NONE'),
      status,
      campaignBudgetOptimization: isCBO,
    }

    if (isCBO) {
      const budgetAd = state.campaign.campaignBudget != null ? tryToAd(state.campaign.campaignBudget) : undefined
      if ((state.campaign.campaignBudgetType ?? 'daily') === 'daily') {
        campaignPayload.dailyBudget = budgetAd
      } else {
        campaignPayload.lifetimeBudget = budgetAd
      }
    }

    if (state.campaign.objective === 'OUTCOME_APP_PROMOTION') {
      if (state.campaign.ios14Campaign) campaignPayload.ios14Campaign = true
      if (state.campaign.advantagePlusApp !== false) campaignPayload.advantagePlusApp = true
    }

    const campaignRes = await fetch('/api/meta/campaigns/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaignPayload),
    })
    const campaignData = await campaignRes.json()
    if (!campaignData.ok) throw new Error(campaignData.message || t.campaignCreateFailed)
    const campaignId = campaignData.campaignId

    // ── 2. Adset create — UI bid alanları backend'e bidStrategy / bidAmount ve snake_case bid_strategy / bid_amount gitmeli ──
    const uiBidStrategy = state.adset.bidStrategy
    const uiBidAmountNum = state.adset.bidAmount != null ? Number(state.adset.bidAmount) : 0
    const isCapStrategy = uiBidStrategy != null && CAP_STRATEGIES.includes(uiBidStrategy)
    // Submit öncesi validasyon: CAP veya bidRequirementMode ise bid zorunlu
    if (isCapStrategy || bidRequirementMode) {
      if (!uiBidStrategy || String(uiBidStrategy).trim() === '') {
        onToast?.(t.bidCapRequired ?? t.bidStrategySelectRequired, 'error')
        return
      }
      if (uiBidAmountNum <= 0 || state.adset.bidAmount == null) {
        onToast?.(t.bidCapRequired ?? t.bidCapEnterRequired, 'error')
        return
      }
    }
    const shouldSendBid =
      (isCapStrategy && uiBidAmountNum > 0) ||
      (bidRequirementMode && uiBidStrategy && uiBidAmountNum > 0)
    const bidAmountAd = uiBidAmountNum > 0 ? tryToAd(uiBidAmountNum) : undefined
    const bidPayload: Record<string, unknown> =
      shouldSendBid && uiBidStrategy && bidAmountAd != null
        ? {
            bidStrategy: uiBidStrategy,
            bidAmount: bidAmountAd,
            bid_strategy: uiBidStrategy,
            bid_amount: bidAmountAd,
          }
        : {
            bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
          }

    const objective = state.campaign.objective
    const isSales = objective === 'OUTCOME_SALES'
    const isAppPromotion = objective === 'OUTCOME_APP_PROMOTION'
    const hasSavedAudience = !!state.adset.savedAudienceId
    const targeting = hasSavedAudience ? undefined : buildTargeting(state.adset)
    // PAGE_LIKES is Facebook-only — instagram_actor_id must not be sent
    const isPageLikes = state.adset.optimizationGoal === 'PAGE_LIKES'
    const adsetPayload: Record<string, unknown> = {
      campaignId,
      name: state.adset.name.trim(),
      pageId: state.adset.pageId,
      instagramAccountId: isPageLikes ? undefined : (state.adset.instagramAccountId || undefined),
      ...(hasSavedAudience
        ? { saved_audience_id: state.adset.savedAudienceId }
        : { targeting }),
      placements: state.adset.placements,
      optimizationGoal: isSales
        ? 'OFFSITE_CONVERSIONS'
        : isAppPromotion
            ? 'APP_INSTALLS'
            : state.adset.optimizationGoal,
      billingEvent: 'IMPRESSIONS',
      destination_type: state.adset.conversionLocation,
      dailyBudget: isCBO ? undefined : (state.adset.budgetType === 'daily' && state.adset.budget != null ? tryToAd(state.adset.budget) : undefined),
      lifetimeBudget: isCBO ? undefined : (state.adset.budgetType === 'lifetime' && state.adset.budget != null ? tryToAd(state.adset.budget) : undefined),
      budget: state.adset.budget != null ? tryToAd(state.adset.budget) : undefined,
      budgetType: state.adset.budgetType,
      ...bidPayload,
      startTime: state.adset.startTime || undefined,
      endTime: state.adset.endTime || undefined,
      status,
    }
    if (bidPayload.bidStrategy != null) adsetPayload.bidStrategy = bidPayload.bidStrategy
    if (bidPayload.bidAmount != null) adsetPayload.bidAmount = bidPayload.bidAmount

    adsetPayload.advantage_audience = state.adset.advantageAudience !== false

    // Dinamik Kreatif — Meta kısıtları:
    // ❌ OUTCOME_SALES (Haziran 2024'ten itibaren)
    // ❌ OUTCOME_APP_PROMOTION
    // ❌ WhatsApp destination
    const dynamicCreativeAllowed =
      !isSales &&
      !isAppPromotion &&
      state.adset.conversionLocation !== 'WHATSAPP'
    if (dynamicCreativeAllowed && state.adset.dynamicCreative === true) {
      adsetPayload.use_dynamic_creative = true
    }

    if (state.adset.conversionLocation === 'ON_AD') {
      const formId = state.ad.leadFormId?.trim() || state.adset.leadGenFormId?.trim()
      if (formId) adsetPayload.lead_gen_form_id = formId
    }
    // WhatsApp: send explicitly selected phone number to promoted_object
    if (state.adset.conversionLocation === 'WHATSAPP') {
      const selectedDisplayPhone = state.adset.destinationDetails?.messaging?.whatsappDisplayPhone
      const selectedPhoneId = state.adset.destinationDetails?.messaging?.whatsappPhoneNumberId
      if (selectedDisplayPhone) {
        adsetPayload.whatsapp_phone_number = selectedDisplayPhone
      }
      if (selectedPhoneId) {
        adsetPayload.whatsapp_phone_number_id = selectedPhoneId
      }
      // Fallback: page-level whatsapp number from inventory
      if (!selectedDisplayPhone && !selectedPhoneId && inventory?.page_whatsapp_number) {
        adsetPayload.page_whatsapp_number = inventory.page_whatsapp_number
      }
      // Pass destinationDetails for server-side logging
      adsetPayload.destinationDetails = state.adset.destinationDetails
      console.log('[DIAG][CampaignWizard] WHATSAPP_PAYLOAD:', {
        pageId: state.adset.pageId,
        whatsapp_phone_number: selectedDisplayPhone ?? '(none)',
        whatsapp_phone_number_id: selectedPhoneId ?? '(none)',
        page_whatsapp_number: (!selectedDisplayPhone && !selectedPhoneId) ? (inventory?.page_whatsapp_number ?? '(none)') : '(not needed)',
        sourceLayer: state.adset.destinationDetails?.messaging?.whatsappSourceLayer ?? '(none)',
      })
    }

    const ADSET_ENDPOINT = '/api/meta/adsets/create'
    console.log('[DIAG][CampaignWizard] Calling adset create:', ADSET_ENDPOINT, '| payload keys:', Object.keys(adsetPayload), '| conversionLocation:', adsetPayload.destination_type, '| optimizationGoal:', adsetPayload.optimizationGoal, '| bidStrategy:', adsetPayload.bidStrategy)
    const adsetRes = await fetch(ADSET_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adsetPayload),
    })
    let adsetData = await adsetRes.json()

    // ── Error handling: 409 + generic errors → routeMetaError + specific handlers ──
    if (adsetRes.status === 409 || !adsetData.ok) {
      const metaError = adsetData.error || {}
      const errorCode: number | undefined = metaError.code
      const errorSubcode: number | undefined = metaError.error_subcode ?? metaError.subcode
      const errorUserMsg: string = metaError.error_user_msg || ''
      const errorMessage: string = metaError.error_user_msg || metaError.message || adsetData.message || ''

      // Rich error for UI: backend response aynen gösterilsin
      const displayMsg =
        errorUserMsg || errorMessage || adsetData.message || t.adsetCreateFailed
      const subcodePart = errorSubcode != null ? ` (subcode: ${errorSubcode})` : ''
      const fullDisplayMsg = `${displayMsg}${subcodePart}`
      setPublishError({
        message: fullDisplayMsg,
        error_user_msg: errorUserMsg || undefined,
        subcode: errorSubcode,
      })

      const route: ErrorRoute = routeMetaError(errorCode, errorSubcode, errorMessage, state.campaign.objective)

      console.info('[ErrorRouter] adsets/create', {
        status: adsetRes.status,
        errorCode,
        errorSubcode,
        routeResult: { step: route.step, field: route.field },
        requiresMinBudget: adsetData.requiresMinBudget,
        requiresBidAmount: adsetData.requiresBidAmount,
      })

      // ── Specific handler: min budget (1885272 or backend requiresMinBudget) ──
      if (adsetData.requiresMinBudget === true && typeof adsetData.minDailyBudgetTry === 'number') {
        const minMsg = t.minBudgetError.replace('{min}', String(Math.ceil(Number(adsetData.minDailyBudgetTry))))
        setMinBudgetRequirement({ minDailyBudgetTry: adsetData.minDailyBudgetTry })
        setMinDailyBudgetTry({ value: adsetData.minDailyBudgetTry, status: 'ready' })
        setStepErrors((prev) => ({ ...prev, budget: minMsg }))
        onToast?.(minMsg, 'error')
        throw new Error(REQUIRES_MIN_BUDGET)
      }

      // ── Specific handler: bid amount required (1815857) ──
      if (adsetData.requiresBidAmount === true) {
        if (!isCapStrategy) {
          console.error('[BUG] autoSelectedButMetaRequiresBid', {
            uiBidStrategy: state.adset.bidStrategy,
            uiBidAmount: state.adset.bidAmount,
            sentBidPayload: bidPayload,
            adsetPayloadKeys: Object.keys(adsetPayload),
          })
        }
        setBidRequirementMode(true)
        const allowed = Array.isArray(adsetData.allowedBidStrategies) ? adsetData.allowedBidStrategies : ['LOWEST_COST_WITH_BID_CAP', 'COST_CAP']
        setAllowedBidStrategies(allowed)
        const preferredStrategy = (allowed.includes('LOWEST_COST_WITH_BID_CAP') ? 'LOWEST_COST_WITH_BID_CAP' : allowed[0]) as WizardState['adset']['bidStrategy']
        setState((prev) => ({
          ...prev,
          adset: {
            ...prev.adset,
            bidStrategy: !prev.adset.bidStrategy || !allowed.includes(prev.adset.bidStrategy) ? preferredStrategy : prev.adset.bidStrategy,
          },
        }))
        setStepErrors((prev) => ({
          ...prev,
          bidAmount: route.message,
        }))
        onToast?.(route.message, 'error')
        throw new Error(REQUIRES_BID_AMOUNT)
      }

      // ── Fallback: show error on Summary, do NOT reset step ──
      if (route.field) {
        setStepErrors((prev) => ({ ...prev, [route.field!]: route.message }))
      }
      onToast?.(fullDisplayMsg, 'error')
      throw new Error(route.message || t.adsetCreateFailed)
    }
    const adsetId = adsetData.adsetId
    setBidRequirementMode(false)
    setAllowedBidStrategies(null)

    await runAdCreatePart(campaignId, adsetId, status)
  }

  const runAdCreatePart = async (campaignId: string, adsetId: string, status: 'ACTIVE' | 'PAUSED') => {
    // ── Existing Post (Post Promote) Flow ──
    if (state.ad.adCreationMode === 'existing' && state.ad.existingPostId) {
      const adBody: Record<string, unknown> = {
        adsetId,
        name: state.ad.name.trim(),
        pageId: state.adset.pageId,
        existingPostId: state.ad.existingPostId,
        callToAction: state.ad.callToAction,
        websiteUrl: state.ad.websiteUrl.trim(),
        status,
        objective: state.campaign.objective,
        conversionLocation: state.adset.conversionLocation,
        optimizationGoal: state.adset.optimizationGoal,
      }
      // WhatsApp: include ONLY page-linked phone number
      if (state.adset.conversionLocation === 'WHATSAPP') {
        const wpId = state.adset.destinationDetails?.messaging?.whatsappPhoneNumberId
        if (wpId) {
          adBody.whatsappPhoneNumberId = wpId
          adBody.whatsapp_phone_number_id = wpId
          adBody.destinationDetails = state.adset.destinationDetails
        }
      }

      const adRes = await fetch('/api/meta/ads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adBody),
      })
      const adData = await adRes.json()
      if (!adData.ok) throw new Error(adData.message || t.adCreateFailed)
      return // Done with existing post flow
    }

    // ── New Ad Creation Flow (existing code) ──
    let imageHash = state.ad.media.hash
    let videoId = state.ad.media.videoId
    if (state.ad.format !== 'carousel' && state.ad.media.file && !imageHash && !videoId) {
      const formData = new FormData()
      formData.append('file', state.ad.media.file)
      formData.append('type', state.ad.format === 'single_video' ? 'video' : 'image')
      const mediaRes = await fetch('/api/meta/upload-media', { method: 'POST', body: formData })
      const mediaData = await mediaRes.json()
      if (!mediaData.ok) throw new Error(mediaData.message || t.mediaUploadFailed)
      imageHash = mediaData.hash
      videoId = mediaData.videoId
    }

    let carouselCardsWithHashes: { headline: string; description: string; link: string; imageHash: string }[] | undefined
    if (state.ad.format === 'carousel' && state.ad.carouselCards.length >= 2) {
      const cards = state.ad.carouselCards
      const withHashes: { headline: string; description: string; link: string; imageHash: string }[] = []
      for (const c of cards) {
        let hash = (c as { imageHash?: string }).imageHash
        if (c.media && !hash) {
          const fd = new FormData()
          fd.append('file', c.media)
          fd.append('type', 'image')
          const mr = await fetch('/api/meta/upload-media', { method: 'POST', body: fd })
          const md = await mr.json()
          if (!md.ok) throw new Error(md.message || t.cardImageUploadFailed)
          hash = md.hash
        }
        if (hash) withHashes.push({ headline: c.headline, description: c.description, link: c.link, imageHash: hash })
      }
      if (withHashes.length < 2) throw new Error(t.carouselMinImages)
      carouselCardsWithHashes = withHashes
    }

    // App Promotion: link_url = campaign.appStoreUrl. Traffic+APP: link_url = adset.appStoreUrl. Engagement/Leads+MESSENGER/WHATSAPP: link yok
    const isEngagementMessaging =
      state.campaign.objective === 'OUTCOME_ENGAGEMENT' &&
      (state.adset.conversionLocation === 'MESSENGER' || state.adset.conversionLocation === 'WHATSAPP')
    const isLeadsMessaging =
      state.campaign.objective === 'OUTCOME_LEADS' &&
      (state.adset.conversionLocation === 'MESSENGER' || state.adset.conversionLocation === 'WHATSAPP')
    const isSalesMessaging =
      state.campaign.objective === 'OUTCOME_SALES' &&
      (state.adset.conversionLocation === 'MESSENGER' || state.adset.conversionLocation === 'WHATSAPP')
    const websiteUrlForCreative = (isEngagementMessaging || isLeadsMessaging || isSalesMessaging)
      ? undefined
      : state.campaign.objective === 'OUTCOME_APP_PROMOTION'
        ? (state.ad.websiteUrl || state.campaign.appStoreUrl || '').trim()
        : state.campaign.objective === 'OUTCOME_TRAFFIC' && state.adset.conversionLocation === 'APP'
          ? (state.ad.websiteUrl || state.adset.appStoreUrl || '').trim()
          : state.campaign.objective === 'OUTCOME_ENGAGEMENT' && state.adset.conversionLocation === 'APP'
            ? (state.ad.websiteUrl || state.adset.appStoreUrl || '').trim()
            : state.campaign.objective === 'OUTCOME_SALES' && state.adset.conversionLocation === 'APP'
              ? (state.ad.websiteUrl || state.adset.appStoreUrl || '').trim()
              : state.ad.websiteUrl || undefined
    // PAGE_LIKES is Facebook-only; for all other ON_PAGE / INSTAGRAM_DIRECT cases send the IG account
    const igAccountForAd = (
      (state.adset.conversionLocation === 'INSTAGRAM_DIRECT' || state.adset.conversionLocation === 'ON_PAGE') &&
      state.adset.optimizationGoal !== 'PAGE_LIKES'
    )
      ? (state.adset.instagramAccountId || undefined)
      : undefined

    const creativePayload = {
      format: state.ad.format,
      imageHash: state.ad.format === 'single_image' ? imageHash : undefined,
      videoId: state.ad.format === 'single_video' ? videoId : undefined,
      primaryText: state.ad.primaryText,
      headline: state.ad.headline,
      description: state.ad.description,
      websiteUrl: websiteUrlForCreative || undefined,
      displayUrl: state.ad.displayUrl || undefined,
      callToAction: state.ad.callToAction,
      carouselCards: carouselCardsWithHashes,
      // instagramActorId: WHATSAPP için gönderme (Meta kabul etmiyor → PERMISSION_DENIED code 1)
      instagramActorId: state.adset.conversionLocation === 'WHATSAPP' ? undefined : igAccountForAd,
      urlParameters: state.ad.urlParameters,
      pixelId: state.ad.pixelId || undefined,
    }

    const adBody: Record<string, unknown> = {
      adsetId,
      name: state.ad.name.trim(),
      pageId: state.adset.pageId,
      creative: creativePayload,
      status,
      objective: state.campaign.objective,
      conversionLocation: state.adset.conversionLocation,
      optimizationGoal: state.adset.optimizationGoal,
    }
    // WhatsApp: wabaCount=0 olsa bile ID varsa gönder — page_id yeterli, whatsapp_phone_number_id opsiyonel
    if (state.adset.conversionLocation === 'WHATSAPP') {
      const wpId = state.adset.destinationDetails?.messaging?.whatsappPhoneNumberId
      if (wpId) {
        adBody.whatsappPhoneNumberId = wpId
        adBody.whatsapp_phone_number_id = wpId
        adBody.destinationDetails = state.adset.destinationDetails
      }
    }
    // Pass verify result for backend page_id_mismatch guard
    if (state.adset.conversionLocation === 'INSTAGRAM_DIRECT') {
      const resolvedIgUserId = igVerifyIgUserId || state.adset.instagramAccountId || null
      if (resolvedIgUserId) {
        adBody.igVerifiedPageId = state.adset.pageId
        adBody.igVerifiedUserId = resolvedIgUserId
        adBody.instagram_user_id = resolvedIgUserId
      }
    }
    // WHATSAPP: phone number is sent above via whatsappPhoneNumberId + destinationDetails
    const leadFormIdVal = state.ad.leadFormId?.trim() || state.adset.destinationDetails?.leads?.leadFormId?.trim()
    const chatGreetingVal = state.ad.chatGreeting?.trim() || state.adset.destinationDetails?.messaging?.messageTemplate?.trim()
    const phoneNumberVal = state.ad.phoneNumber?.trim() || state.adset.destinationDetails?.calls?.phoneNumber?.trim()
    if (state.campaign.objective === 'OUTCOME_LEADS' && state.adset.conversionLocation === 'ON_AD' && leadFormIdVal) {
      adBody.lead_gen_form_id = leadFormIdVal
      adBody.leadFormId = leadFormIdVal
    }
    if (state.campaign.objective === 'OUTCOME_LEADS') {
      if ((state.adset.conversionLocation === 'MESSENGER' || state.adset.conversionLocation === 'WHATSAPP') && chatGreetingVal) {
        adBody.chat_greeting = chatGreetingVal
        adBody.chatGreeting = chatGreetingVal
      }
      if (state.adset.conversionLocation === 'CALL' && phoneNumberVal) {
        adBody.phone_number = phoneNumberVal
        adBody.phoneNumber = phoneNumberVal
      }
    }
    if (state.campaign.objective === 'OUTCOME_ENGAGEMENT') {
      if ((state.adset.conversionLocation === 'MESSENGER' || state.adset.conversionLocation === 'WHATSAPP') && chatGreetingVal) {
        adBody.chat_greeting = chatGreetingVal
        adBody.chatGreeting = chatGreetingVal
      }
      if (state.adset.conversionLocation === 'CALL' && phoneNumberVal) {
        adBody.phone_number = phoneNumberVal
        adBody.phoneNumber = phoneNumberVal
      }
    }
    if (state.campaign.objective === 'OUTCOME_SALES') {
      if ((state.adset.conversionLocation === 'MESSENGER' || state.adset.conversionLocation === 'WHATSAPP') && chatGreetingVal) {
        adBody.chat_greeting = chatGreetingVal
        adBody.chatGreeting = chatGreetingVal
      }
    }
    const adRes = await fetch('/api/meta/ads/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adBody),
    })
    const adData = await adRes.json()
    if (!adData.ok) {
      // Handle field-specific validation errors
      if (adData.code === 'VALIDATION_ERROR' && adData.fields) {
        const fieldErrors = adData.fields as Record<string, string>
        const allErrors = Object.entries(fieldErrors).map(([field, msg]) => `${field}: ${msg}`).join('\n')
        throw new Error(`${adData.message}\n${allErrors}`)
      }

      // IG professional link / page mismatch — set inline error on step 2 IG field
      if (
        adData.error === 'ig_not_linked_or_not_professional' ||
        adData.error === 'page_id_mismatch'
      ) {
        setStepErrors((prev) => ({ ...prev, ig_account: adData.message }))
      }

      const errorMsg = adData.error_user_msg || adData.message || t.adCreateFailed
      const traceId = adData.fbtrace_id ? ` (${adData.fbtrace_id})` : ''
      throw new Error(`${errorMsg}${traceId}`)
    }
  }

  const handleSaveDraft = async () => {
    if (!validateStep1()) { onToast?.(t.validationErrorStep1 ?? 'Kampanya bilgilerini kontrol edin.', 'error'); return }
    if (!validateStep2()) { onToast?.(t.validationErrorStep2 ?? 'Reklam seti bilgilerini kontrol edin.', 'error'); return }
    if (!validateStep3()) { onToast?.(t.validationErrorStep3 ?? 'Reklam bilgilerini kontrol edin.', 'error'); return }
    // Preflight: ek katman — mevcut validation geçtiyse inventory gating + field check
    if (!runPreflight()) return
    setIsSubmitting(true)
    try {
      await runCreateFlow('PAUSED')
      onToast?.(t.draftSaved, 'success')
      onSuccess?.()
      handleClose()
    } catch (err) {
      if (err instanceof Error && (err.message === REQUIRES_BID_AMOUNT || err.message === REQUIRES_MIN_BUDGET || err.message === PREFLIGHT_BLOCKED)) return
      onToast?.(err instanceof Error ? err.message : t.saveFailed, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePublish = async () => {
    if (!validateStep1()) { onToast?.(t.validationErrorStep1 ?? 'Kampanya bilgilerini kontrol edin.', 'error'); return }
    if (!validateStep2()) { onToast?.(t.validationErrorStep2 ?? 'Reklam seti bilgilerini kontrol edin.', 'error'); return }
    if (!validateStep3()) { onToast?.(t.validationErrorStep3 ?? 'Reklam bilgilerini kontrol edin.', 'error'); return }
    // Preflight: ek katman — mevcut validation geçtiyse inventory gating + field check
    if (!runPreflight()) return
    setIsSubmitting(true)
    try {
      await runCreateFlow('ACTIVE')
      onToast?.(t.campaignPublished, 'success')
      onSuccess?.()
      handleClose()
    } catch (err) {
      if (err instanceof Error && (err.message === REQUIRES_BID_AMOUNT || err.message === REQUIRES_MIN_BUDGET || err.message === PREFLIGHT_BLOCKED)) return
      onToast?.(err instanceof Error ? err.message : t.publishFailed, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── canGoNext — destination-aware ──
  const needsUrl = requiresWebsiteUrl(
    state.campaign.objective,
    state.adset.conversionLocation,
    state.adset.optimizationGoal
  )

  // CAP seçiliyken veya 409 requiresBidAmount sonrası bid alanları zorunlu
  const isCapForNav = state.adset.bidStrategy != null && CAP_STRATEGIES.includes(state.adset.bidStrategy)
  const requiresBidForStep2 =
    (isCapForNav && (!state.adset.bidAmount || state.adset.bidAmount <= 0)) ||
    (bidRequirementMode &&
      (!allowedBidStrategies?.length ||
        !state.adset.bidStrategy ||
        !allowedBidStrategies.includes(state.adset.bidStrategy) ||
        !state.adset.bidAmount ||
        state.adset.bidAmount <= 0))
  const isCBO = state.campaign.budgetOptimization === 'campaign'
  const budgetInvalid = isCBO
    ? (state.campaign.campaignBudget == null || state.campaign.campaignBudget <= 0)
    : (state.adset.budget == null || state.adset.budget <= 0)
  // CBO + daily: use campaign FX (campaignMinDailyTry) for step 1; else use minDailyBudgetTry for compatibility
  const campaignBudgetDaily = (state.campaign.campaignBudgetType ?? 'daily') === 'daily'
  const campaignMinForStep1 = isCBO && campaignBudgetDaily ? campaignMinDailyTry : null
  const campaignBudgetBelowMin =
    isCBO &&
    campaignBudgetDaily &&
    (campaignFxError != null ||
      (campaignMinForStep1 != null &&
        state.campaign.campaignBudget != null &&
        state.campaign.campaignBudget > 0 &&
        state.campaign.campaignBudget < campaignMinForStep1))
  // Block next/publish if adset budget < min daily budget (TRY) — only for non-CBO; use ceil for same threshold as campaign
  const adSetMinTry = minDailyBudgetTry.value != null ? Math.ceil(minDailyBudgetTry.value) : null
  const budgetBelowMin =
    !isCBO &&
    minDailyBudgetTry.status === 'ready' &&
    adSetMinTry != null &&
    state.adset.budget != null &&
    state.adset.budget > 0 &&
    state.adset.budget < adSetMinTry
  // campaignMinBudgetError / adSetMinBudgetError are useState + useEffect (see above); no computed vars needed here
  // Block forward if min budget hasn't loaded yet (no stale pass-through) or if error — only for non-CBO
  const minBudgetNotReady =
    !isCBO &&
    state.adset.budgetType === 'daily' &&
    state.adset.budget != null &&
    state.adset.budget > 0 &&
    (minDailyBudgetTry.status === 'loading' || minDailyBudgetTry.status === 'error')
  // v2-FIXED Awareness Step 2: performans hedefi (REACH, IMPRESSIONS, AD_RECALL_LIFT, THRUPLAY) seçili olmalı
  const awarenessGoalOk =
    state.campaign.objective !== 'OUTCOME_AWARENESS' ||
    (!!state.adset.optimizationGoal &&
      ['REACH', 'IMPRESSIONS', 'AD_RECALL_LIFT', 'THRUPLAY'].includes(state.adset.optimizationGoal))

  // Engagement Step 2: performans hedefi destination'a göre izin verilenlerden biri olmalı
  const engagementAllowedGoals = getAllowedOptimizationGoals('OUTCOME_ENGAGEMENT', state.adset.conversionLocation)
    .filter((g) => g !== 'OFFSITE_CONVERSIONS')
  const engagementGoalOk =
    state.campaign.objective !== 'OUTCOME_ENGAGEMENT' ||
    engagementAllowedGoals.length > 0

  // Sales Step 2: pixel ve dönüşüm olayı zorunlu
  const salesPixelOk =
    state.campaign.objective !== 'OUTCOME_SALES' ||
    state.adset.conversionLocation !== 'WEBSITE' ||
    (!!state.adset.pixelId?.trim() && !!state.adset.customEventType?.trim())

  // Traffic Step 2: APP → appId + appStoreUrl; INSTAGRAM_DIRECT → instagramAccountId
  const isTrafficApp =
    state.campaign.objective === 'OUTCOME_TRAFFIC' && state.adset.conversionLocation === 'APP'
  const trafficAppOk =
    !isTrafficApp ||
    (!!state.adset.appId?.trim() &&
      !!state.adset.appStoreUrl?.trim() &&
      state.adset.appStoreUrl.trim().startsWith('https://') &&
      (state.adset.appStoreUrl.includes('play.google.com') || state.adset.appStoreUrl.includes('apps.apple.com')))
  const trafficInstagramDirectOk =
    state.campaign.objective !== 'OUTCOME_TRAFFIC' ||
    state.adset.conversionLocation !== 'INSTAGRAM_DIRECT' ||
    !!state.adset.instagramAccountId?.trim()

  // Meta API restriction (error 2490408): OUTCOME_ENGAGEMENT + WEBSITE does not support pixel/conversion params
  const engagementWebsiteOk = true
  const isEngagementApp =
    state.campaign.objective === 'OUTCOME_ENGAGEMENT' && state.adset.conversionLocation === 'APP'
  const engagementAppOk =
    !isEngagementApp ||
    (!!state.adset.appId?.trim() &&
      !!state.adset.appStoreUrl?.trim() &&
      state.adset.appStoreUrl.trim().startsWith('https://') &&
      (state.adset.appStoreUrl.includes('play.google.com') || state.adset.appStoreUrl.includes('apps.apple.com')))
  const engagementInstagramDirectOk =
    state.campaign.objective !== 'OUTCOME_ENGAGEMENT' ||
    state.adset.conversionLocation !== 'INSTAGRAM_DIRECT' ||
    !!state.adset.instagramAccountId?.trim()

  const leadsWebsiteOk =
    state.campaign.objective !== 'OUTCOME_LEADS' ||
    state.adset.conversionLocation !== 'WEBSITE' ||
    (!!state.adset.pixelId?.trim() && !!state.adset.customEventType?.trim())

  const isMessagingDest =
    state.adset.conversionLocation === 'MESSENGER' || state.adset.conversionLocation === 'WHATSAPP'
const messagingOk = true
  const callOk =
    state.adset.conversionLocation !== 'CALL' ||
    !!state.adset.destinationDetails?.calls?.phoneNumber?.trim()
  const leadsOnAdOk = true

  const salesCatalogOk =
    state.campaign.objective !== 'OUTCOME_SALES' ||
    state.adset.conversionLocation !== 'CATALOG' ||
    !!state.adset.catalogId?.trim()
  const isSalesApp =
    state.campaign.objective === 'OUTCOME_SALES' && state.adset.conversionLocation === 'APP'
  const salesAppOk =
    !isSalesApp ||
    (!!state.adset.appId?.trim() &&
      !!state.adset.appStoreUrl?.trim() &&
      state.adset.appStoreUrl.trim().startsWith('https://') &&
      (state.adset.appStoreUrl.includes('play.google.com') || state.adset.appStoreUrl.includes('apps.apple.com')))

  const appPromotionStep1Ok =
    state.campaign.objective !== 'OUTCOME_APP_PROMOTION' ||
    (!!state.campaign.appId?.trim() &&
      !!state.campaign.appStoreUrl?.trim() &&
      state.campaign.appStoreUrl.trim().startsWith('https://') &&
      (state.campaign.appStoreUrl.includes('play.google.com') || state.campaign.appStoreUrl.includes('apps.apple.com')))
  const appPromotionStep2Ok =
    state.campaign.objective !== 'OUTCOME_APP_PROMOTION' ||
    (!!state.adset.appStore?.trim() &&
      (() => {
        const url = state.campaign.appStoreUrl?.trim() ?? ''
        const store = (state.adset.appStore ?? 'GOOGLE_PLAY').toUpperCase()
        if (!url) return true
        if (store === 'GOOGLE_PLAY') return url.includes('play.google.com')
        if (store === 'APPLE_APP_STORE') return url.includes('apps.apple.com')
        return true
      })())
  const canGoNext: boolean =
    state.currentStep === 1
      ? state.campaign.name.trim().length > 0 && appPromotionStep1Ok &&
        (!isCBO || (state.campaign.campaignBudget != null && state.campaign.campaignBudget > 0)) &&
        !campaignBudgetBelowMin
      : state.currentStep === 2
      ? state.adset.name.trim().length > 0 &&
        !!state.adset.pageId &&
        awarenessGoalOk &&
        engagementGoalOk &&
        salesPixelOk &&
        salesCatalogOk &&
        salesAppOk &&
        trafficAppOk &&
        trafficInstagramDirectOk &&
        engagementWebsiteOk &&
        engagementAppOk &&
        engagementInstagramDirectOk &&
        leadsWebsiteOk &&
        messagingOk &&
        callOk &&
        leadsOnAdOk &&
        appPromotionStep2Ok &&
        !requiresBidForStep2 &&
        !budgetInvalid &&
        !budgetBelowMin &&
        !minBudgetNotReady &&
        (state.adset.conversionLocation !== 'INSTAGRAM_DIRECT' || igVerifyStatus === 'ok')
      : state.currentStep === 3
      ? state.ad.name.trim().length > 0 &&
        state.ad.primaryText.trim().length > 0 &&
        (!needsUrl || state.ad.websiteUrl.trim().length > 0) &&
        (state.campaign.objective !== 'OUTCOME_LEADS' ||
          state.adset.conversionLocation !== 'ON_AD' ||
          !!state.ad.leadFormId?.trim() ||
          !!state.adset.destinationDetails?.leads?.leadFormId?.trim()) &&
        (state.campaign.objective !== 'OUTCOME_LEADS' ||
          (state.adset.conversionLocation !== 'MESSENGER' && state.adset.conversionLocation !== 'WHATSAPP') ||
          !!state.ad.chatGreeting?.trim() ||
          !!state.adset.destinationDetails?.messaging?.messageTemplate?.trim()) &&
        (state.campaign.objective !== 'OUTCOME_LEADS' ||
          state.adset.conversionLocation !== 'CALL' ||
          !!state.ad.phoneNumber?.trim() ||
          !!state.adset.destinationDetails?.calls?.phoneNumber?.trim()) &&
        (state.campaign.objective !== 'OUTCOME_SALES' ||
          (state.adset.conversionLocation !== 'MESSENGER' && state.adset.conversionLocation !== 'WHATSAPP') ||
          !!state.ad.chatGreeting?.trim() ||
          !!state.adset.destinationDetails?.messaging?.messageTemplate?.trim()) &&
        ((state.campaign.objective !== 'OUTCOME_ENGAGEMENT' ||
          (state.adset.conversionLocation !== 'MESSENGER' && state.adset.conversionLocation !== 'WHATSAPP') ||
          !!state.ad.chatGreeting?.trim() ||
          !!state.adset.destinationDetails?.messaging?.messageTemplate?.trim())) &&
        (state.campaign.objective !== 'OUTCOME_ENGAGEMENT' ||
          state.adset.conversionLocation !== 'CALL' ||
          !!state.ad.phoneNumber?.trim() ||
          !!state.adset.destinationDetails?.calls?.phoneNumber?.trim())
      : true

  // Required and min-budget messages are shown inline below their inputs; nothing shown next to the Next button
  const nextBlockedReason: string | null = null

  if (!isOpen) return null

  const instagramAccounts = instagramAccount ? [instagramAccount] : []

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">

      {/* ── Header ── */}
      <div className="h-24 flex items-center px-6 border-b border-gray-200 flex-shrink-0 gap-4">
        <div className="flex items-center gap-3 w-48 flex-shrink-0">
          <img src="/meta-logo.png" alt="Meta" width={28} height={28} className="shrink-0" />
          <h2 className="text-sm font-semibold text-gray-900 truncate">{t.createMetaCampaign}</h2>
        </div>
        <div className="flex-1 flex justify-center min-w-0">
          <div className="w-full max-w-xl">
            <WizardProgress
              currentStep={state.currentStep}
              compact
              onStepClick={(step) => setState(prev => ({ ...prev, currentStep: step }))}
            />
          </div>
        </div>
        <div className="w-48 flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="grid grid-cols-3 gap-8">

            {/* Left: step content */}
            <div className="col-span-2">
              {discoveryPatch?.invalidCombination && (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  {t.invalidCombination}
                  {discoveryPatch.notes && <span className="block mt-1 text-amber-700">{discoveryPatch.notes}</span>}
                </div>
              )}

              {state.currentStep === 1 && (
                <StepCampaign
                  state={state.campaign}
                  onChange={updateCampaign}
                  errors={stepErrors}
                  minBudgetError={campaignMinBudgetError}
                />
              )}

              {state.currentStep === 2 && (
                <>
                  <StepAdSet
                    state={state.adset}
                    campaignObjective={state.campaign.objective}
                    budgetOptimization={state.campaign.budgetOptimization}
                    onChange={updateAdset}
                    errors={{
                      ...stepErrors,
                      budget: stepErrors.budget || adSetMinBudgetError || '',
                    }}
                    pages={pages}
                    instagramAccounts={instagramAccounts}
                    pagesLoading={pagesLoading}
                    pagesInitialLoadDone={pagesInitialLoadDone}
                    pagesError={pagesError}
                    instagramLoading={instagramLoading}
                    discoveryPatch={discoveryPatch}
                    capabilities={capabilities}
                    accountInventoryLeadForms={inventory?.lead_forms}
                    accountInventory={inventory}
                    accountInventoryPageId={inventoryPageId}
                    accountInventoryStatus={inventoryStatus}
                  />
                  {state.adset.conversionLocation === 'INSTAGRAM_DIRECT' && igVerifyStatus === 'verifying' && (
                    <p className="mt-2 text-caption text-gray-500 flex items-center gap-1">
                      <svg className="animate-spin h-3 w-3 text-gray-400" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      {t.igVerifyChecking}
                    </p>
                  )}
                  {state.adset.conversionLocation === 'INSTAGRAM_DIRECT' && igVerifyStatus === 'blocked_rate_limit' && (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-caption text-amber-700">
                      <div className="flex items-start gap-2">
                        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 102 0V6zm-1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <span>
                          {t.igRateLimitText}{igRateLimitCountdown !== null && igRateLimitCountdown > 0
                            ? ` ${t.igRateLimitRetrySeconds.replace('{0}', String(igRateLimitCountdown))}`
                            : ` ${t.igRateLimitWait}`}
                        </span>
                      </div>
                    </div>
                  )}
                  {state.adset.conversionLocation === 'INSTAGRAM_DIRECT' && igVerifyStatus === 'error' && igVerifyMsg && (
                    <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-caption text-red-700">
                      <div className="flex items-start gap-2">
                        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span>{igVerifyMsg}</span>
                      </div>
                      {igVerifyErrorKind === 'ig_not_linked_to_page' && (
                        <p className="mt-2 text-caption text-amber-700">
                          Bu sayfaya Instagram bağlı değil.{' '}
                          <a href="https://business.facebook.com/settings/instagram-accounts" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-amber-900">
                            Meta Business Manager'dan bağlayın →
                          </a>
                        </p>
                      )}
                      {(igVerifyErrorKind === 'page_token_not_found' || igVerifyErrorKind === 'page_token_required' || igVerifyErrorKind === 'ig_permission_error') && (
                        <a href="/api/meta/login" className="mt-2 inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-caption font-medium text-white hover:bg-red-700 transition-colors">
                          Meta Bağlantısını Yenile
                        </a>
                      )}
                    </div>
                  )}
                  {state.adset.conversionLocation === 'INSTAGRAM_DIRECT' && igVerifyStatus === 'ok' && (
                    <p className="mt-2 text-caption text-green-600 flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Instagram hesabı doğrulandı.
                    </p>
                  )}
                </>
              )}

              {state.currentStep === 3 && (
                <StepAd
                  state={state.ad}
                  campaignObjective={state.campaign.objective}
                  conversionLocation={state.adset.conversionLocation}
                  optimizationGoal={state.adset.optimizationGoal}
                  pageId={state.adset.pageId}
                  instagramAccountId={state.adset.instagramAccountId}
                  inventory={inventory}
                  pixels={inventory?.pixels ?? []}
                  onChange={updateAd}
                  errors={stepErrors}
                  discoveryPatch={discoveryPatch}
                />
              )}

              {state.currentStep === 4 && (
                <div className="space-y-4">
                  {publishError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                      <p className="font-medium">{t.publishFailed ?? 'Yayınlama başarısız'}</p>
                      <p className="mt-1">{publishError.message}</p>
                    </div>
                  )}
                  <StepSummary state={state} accountCurrency={accountCurrency} fxState={fxState} />
                </div>
              )}
            </div>

            {/* Right: sidebar */}
            <div className="col-span-1">
              <WizardSidebar state={state} currentStep={state.currentStep} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      {state.currentStep < 4 ? (
        <WizardNavigation
          currentStep={state.currentStep}
          onBack={goBack}
          onNext={goNext}
          canGoNext={canGoNext}
          nextLabel={t.next}
          backLabel={t.back}
          blockedReason={nextBlockedReason}
          asFooter
        />
      ) : (
        <div className="flex items-center justify-between px-6 h-16 border-t border-gray-200 bg-white flex-shrink-0">
          <button type="button" onClick={goBack} className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            {t.back}
          </button>
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSubmitting || (accountCurrency !== 'TRY' && fxState.status !== 'ready')}
                className="px-5 py-2.5 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary/10 disabled:opacity-50"
              >
                {t.saveDraft}
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={isSubmitting || (accountCurrency !== 'TRY' && fxState.status !== 'ready')}
                className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? t.processing : t.publish}
              </button>
            </div>
            {accountCurrency && accountCurrency !== 'TRY' && fxState.status === 'error' && (
              <p className="text-caption text-red-500">Kur bilgisi alınamadı. Yayınlama devre dışı.</p>
            )}
            {accountCurrency && accountCurrency !== 'TRY' && fxState.status === 'loading' && (
              <p className="text-caption text-gray-400">Kur bilgisi yükleniyor…</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
