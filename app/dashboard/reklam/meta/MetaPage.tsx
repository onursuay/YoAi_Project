'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams, useRouter } from 'next/navigation'
import Topbar from '@/components/Topbar'
import Tabs from '@/components/Tabs'
import ToggleSwitch from '@/components/ToggleSwitch'
import CircularProgress from '@/components/CircularProgress'
import CampaignCreateModal from '@/components/CampaignCreateModal'
import MetaObjectiveSelector from '@/components/meta/MetaObjectiveSelector'
import dynamic from 'next/dynamic'
const TrafficWizard = dynamic(() => import('@/components/meta/TrafficWizard'), { ssr: false })
const CampaignWizard = dynamic(() => import('@/components/meta/CampaignWizard'), { ssr: false })
import type { MetaCapabilities } from '@/lib/meta/capabilityRules'
import TableShimmer from '@/components/TableShimmer'
import DashboardKpiCard from '@/components/DashboardKpiCard'
import AlertBanner from '@/components/AlertBanner'
import { ToastContainer, Toast, ToastType } from '@/components/Toast'
import { Lightbulb, X, Info, Trash2, Copy, RefreshCw, Search, Eye, EyeOff, Pencil } from 'lucide-react'
import DateRangePicker from '@/components/DateRangePicker'
import AdsetEditDrawer from '@/components/meta/AdsetEditDrawer'
import AdEditDrawer from '@/components/meta/AdEditDrawer'
import CampaignEditOverlay from '@/components/meta/CampaignEditOverlay'
import { metaFetch, TOKEN_EXPIRED_EVENT, TOKEN_MISSING_EVENT, resetTokenExpiredFlag } from '@/lib/meta/clientFetch'
import MetaTableReal from './components/MetaTableReal'
import MetaTableSkeleton from './components/MetaTableSkeleton'

interface Campaign {
  id: string
  name: string
  status: string
  effective_status?: string
  budget: number | null
  daily_budget?: number | null
  lifetime_budget?: number | null
  spent: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  reach: number
  engagement: number
  purchases: number
  roas: number | null
}

interface AdSet {
  id: string
  name: string
  status: string
  effective_status?: string
  campaignId: string
  budget: number
  daily_budget?: number
  lifetime_budget?: number
  spent: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  purchases: number
  roas: number | null
}

interface Ad {
  id: string
  name: string
  status: string
  effective_status?: string
  adsetId: string
  campaignId: string
  spent: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  purchases: number
  roas: number | null
}

interface InsightsData {
  spendTRY: number | string
  purchases: number
  roas: number
  impressions: number
  clicks: number
  ctr: number
  cpcTRY: number
  reach?: number
  engagement?: number
  results?: number
  series?: {
    spend: number[]
    impressions: number[]
    clicks: number[]
    reach: number[]
    dates?: string[]
  }
}

type FlatRec = {
  type: string
  object_ids: string[]
  title: string | null
  description: string | null
  points: number | null
  impact: string | null
  deep_link: string | null
}

/** Normalize API insights response so spendTRY is always a number. */
function normalizeInsightsResponse(data: unknown): InsightsData {
  const fallback: InsightsData = {
    spendTRY: 0,
    purchases: 0,
    roas: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    cpcTRY: 0,
  }
  if (!data || typeof data !== 'object') return fallback
  const d = data as Record<string, unknown>
  const raw = d.spendTRY ?? d.spend
  const parsed = raw == null ? NaN : typeof raw === 'string' ? parseFloat(raw) : Number(raw)
  const spendTRY = Number.isFinite(parsed) ? parsed : 0
  return {
    spendTRY,
    purchases: Number(d.purchases) || 0,
    roas: Number(d.roas) || 0,
    impressions: Number(d.impressions) || 0,
    clicks: Number(d.clicks) || 0,
    ctr: Number(d.ctr) || 0,
    cpcTRY: Number(d.cpcTRY) || 0,
    reach: d.reach != null ? Number(d.reach) : undefined,
    engagement: d.engagement != null ? Number(d.engagement) : undefined,
    results: d.results != null ? Number(d.results) : undefined,
    series: d.series && typeof d.series === 'object' ? d.series as InsightsData['series'] : undefined,
  }
}

export default function MetaPage() {
  const t = useTranslations('dashboard.meta')
  const tMetrics = useTranslations('meta.metrics')
  const recommendationsEnabled = process.env.NEXT_PUBLIC_RECOMMENDATIONS_ENABLED === 'true'
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Read initial tab from URL query param
  const initialTab = searchParams.get('tab') || 'kampanyalar'
  const validTabs = ['kampanyalar', 'reklam-setleri', 'reklamlar']
  const [activeTab, setActiveTab] = useState(validTabs.includes(initialTab) ? initialTab : 'kampanyalar')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [adsets, setAdsets] = useState<AdSet[]>([])
  const [ads, setAds] = useState<Ad[]>([])
  // Last known good data (prevents table "disappearing" during refetch/errors)
  const lastGoodCampaignsRef = useRef<Campaign[] | null>(null)
  const lastGoodAdsetsRef = useRef<AdSet[] | null>(null)
  const lastGoodAdsRef = useRef<Ad[] | null>(null)
  const [isLoading, setIsLoading] = useState(true) // Initial load only
  const [insights, setInsights] = useState<InsightsData | null>(null)
  const [adAccountName, setAdAccountName] = useState<string>('')
  const [dateRange, setDateRange] = useState(() => {
    const toLocalISO = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    const end = new Date()
    const s = new Date(); s.setDate(s.getDate() - 30)
    return { preset: 'last_30d', start: toLocalISO(s), end: toLocalISO(end) }
  })
  const [showInactive, setShowInactive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showObjectiveSelector, setShowObjectiveSelector] = useState(false)
  const [showTrafficWizard, setShowTrafficWizard] = useState(false)
  const [showCampaignWizard, setShowCampaignWizard] = useState(false)
  const [selectedObjective, setSelectedObjective] = useState<string>('')
  const [opportunityScore, setOpportunityScore] = useState<number | null>(null)
  const lastGoodOpportunityScoreRef = useRef<number | null>(null)
  const [recommendations, setRecommendations] = useState<FlatRec[]>([])
  const [recsLoading, setRecsLoading] = useState(false)
  const [recsError, setRecsError] = useState<string | null>(null)
  const [resolvedMap, setResolvedMap] = useState<Record<string, { campaignId?: string; adsetId?: string }>>({})
  const [selectedEntity, setSelectedEntity] = useState<{ id: string; name: string; kind: 'campaigns' | 'adsets' | 'ads' } | null>(null)
  const [isRecPanelOpen, setIsRecPanelOpen] = useState(false)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [selectedRec, setSelectedRec] = useState<FlatRec | null>(null)
  const [budgetInput, setBudgetInput] = useState<string>('')
  const [isUpdatingBudget, setIsUpdatingBudget] = useState(false)
  const [performanceRecommendations, setPerformanceRecommendations] = useState<{
    items: any[]
    summary: { total: number; byCampaignId: Record<string, number> }
  } | null>(null)
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string | null>(null)
  const [metaCapabilities, setMetaCapabilities] = useState<MetaCapabilities | null>(null)
  const lastFetchAtRef = useRef<number>(0)
  const lastRecsFetchRef = useRef<number>(0)
  const recsAbortRef = useRef<AbortController | null>(null)
  
  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([])
  
  // Entity status update loading state (per-row)
  const [loadingCampaignStatus, setLoadingCampaignStatus] = useState<Record<string, boolean>>({})
  const [loadingAdSetStatus, setLoadingAdSetStatus] = useState<Record<string, boolean>>({})
  const [loadingAdStatus, setLoadingAdStatus] = useState<Record<string, boolean>>({})
  const [loadingCampaignBudget, setLoadingCampaignBudget] = useState<Record<string, boolean>>({})
  
  const [showEditBudgetModal, setShowEditBudgetModal] = useState(false)
  const [selectedAdsetForBudget, setSelectedAdsetForBudget] = useState<{ id: string; name: string; daily_budget?: number; lifetime_budget?: number } | null>(null)
  const [selectedCampaignForBudget, setSelectedCampaignForBudget] = useState<{ id: string; name: string; daily_budget?: number | null; lifetime_budget?: number | null } | null>(null)
  const [budgetEditInput, setBudgetEditInput] = useState<string>('')
  const [budgetEditType, setBudgetEditType] = useState<'daily' | 'lifetime'>('daily')
  const [isUpdatingAdsetBudget, setIsUpdatingAdsetBudget] = useState(false)
  const [isUpdatingCampaignBudget, setIsUpdatingCampaignBudget] = useState(false)
  
  // Rename state
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [selectedCampaignForRename, setSelectedCampaignForRename] = useState<{ id: string; name: string } | null>(null)
  const [selectedAdSetForRename, setSelectedAdSetForRename] = useState<{ id: string; name: string } | null>(null)
  const [selectedAdForRename, setSelectedAdForRename] = useState<{ id: string; name: string } | null>(null)
  const [renameInput, setRenameInput] = useState<string>('')
  const [renameType, setRenameType] = useState<'campaign' | 'adset' | 'ad'>('campaign')
  const [isRenaming, setIsRenaming] = useState(false)
  
  // Campaign row selection (for action bar + adset/ad filtering)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([])
  // Ad set row selection (for action bar + ad filtering)
  const [selectedAdsetId, setSelectedAdsetId] = useState<string | null>(null)
  const [selectedAdsetIds, setSelectedAdsetIds] = useState<string[]>([])

  // Delete campaign confirmation state
  const [deletingCampaign, setDeletingCampaign] = useState<{ id: string; name: string } | null>(null)
  const [isDeletingCampaign, setIsDeletingCampaign] = useState(false)

  // Delete adset confirmation state
  const [deletingAdset, setDeletingAdset] = useState<{ id: string; name: string } | null>(null)
  const [isDeletingAdset, setIsDeletingAdset] = useState(false)

  // Ad row selection
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null)
  const [selectedAdIds, setSelectedAdIds] = useState<string[]>([])
  // Delete ad confirmation state
  const [deletingAd, setDeletingAd] = useState<{ id: string; name: string } | null>(null)
  const [isDeletingAd, setIsDeletingAd] = useState(false)

  const [bulkDeleting, setBulkDeleting] = useState<{ ids: string[]; type: 'campaign' | 'adset' | 'ad' } | null>(null)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  // Duplicate state
  const [isDuplicatingCampaign, setIsDuplicatingCampaign] = useState(false)
  const [isDuplicatingAdset, setIsDuplicatingAdset] = useState(false)
  const [isDuplicatingAd, setIsDuplicatingAd] = useState(false)

  // Edit overlay state
  const [editingCampaign, setEditingCampaign] = useState<{ id: string; name: string } | null>(null)
  const [editingAdset, setEditingAdset] = useState<{ id: string; name: string; campaignId?: string } | null>(null)
  const [editingAd, setEditingAd] = useState<{ id: string; name: string; adsetId?: string; campaignId?: string } | null>(null)
  
  // Token expired banner (expired = token existed but is invalid; disconnected = no token at all)
  const [tokenExpired, setTokenExpired] = useState(false)
  const [metaDisconnected, setMetaDisconnected] = useState(false)

  // Client hydrated: account selection not evaluated until after first paint (prevents flicker)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  // Error state for API failures
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetchErrorKey, setFetchErrorKey] = useState<string | null>(null) // Track error key for conditional rendering
  const [rateLimitError, setRateLimitError] = useState<{
    message: string
    code?: number
    subcode?: number
    fbtrace_id?: string
    retryAfterMs?: number
  } | null>(null)
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number>(0)
  const rateLimitRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Refresh token to force refetch after mutations
  const [refreshToken, setRefreshToken] = useState(0)
  
  // Separate refetch counters for each tab (prevents isFetching from getting stuck)
  const refreshCountCampaignsRef = useRef(0)
  const refreshCountAdsetsRef = useRef(0)
  const refreshCountAdsRef = useRef(0)
  const budgetFailsafeTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  
  // Refreshing states for each tab (triggered by counter changes)
  const [isRefreshingCampaigns, setIsRefreshingCampaigns] = useState(false)
  const [isRefreshingAdsets, setIsRefreshingAdsets] = useState(false)
  const [isRefreshingAds, setIsRefreshingAds] = useState(false)

  // User-action loading: only true when user explicitly triggers a load (tab, date, budget, status)
  // NOT on page refresh or background refetch
  const [isUserLoading, setIsUserLoading] = useState(false)
  const userLoadTriggerRef = useRef(false)
  const hasExecutedLoadRef = useRef(false)
  
  // Client-side memoization cache (disabled - always fresh)
  const clientCache = useRef<Map<string, { data: any; timestamp: number }>>(new Map())
  const CACHE_TTL = 0 // Cache disabled
  
  // Handle tab change with URL update
  const handleTabChange = (newTab: string) => {
    if (validTabs.includes(newTab)) {
      userLoadTriggerRef.current = true
      setActiveTab(newTab)
      // Update URL without full navigation
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', newTab)
      router.push(`?${params.toString()}`, { scroll: false })
    }
  }

  // Trigger refresh after user actions (budget, status, etc.) - marks next load as user-initiated
  const triggerRefresh = useCallback(() => {
    userLoadTriggerRef.current = true
    setRefreshToken(v => v + 1)
  }, [])

  // Get locale from cookie
  const getLocale = (): string => {
    if (typeof document === 'undefined') return 'tr'
    const cookies = document.cookie.split(';')
    const localeCookie = cookies.find(c => c.trim().startsWith('NEXT_LOCALE='))
    const locale = localeCookie ? localeCookie.split('=')[1] : 'tr'
    return locale === 'en' ? 'en_US' : 'tr_TR'
  }

  // Get locale string for formatting (tr-TR or en-US) — set in effect to avoid document access during render
  const [localeString, setLocaleString] = useState('tr-TR')
  useEffect(() => {
    if (typeof document === 'undefined') return
    const cookies = document.cookie.split(';')
    const localeCookie = cookies.find(c => c.trim().startsWith('NEXT_LOCALE='))
    const locale = localeCookie ? localeCookie.split('=')[1] : 'tr'
    setLocaleString(locale === 'en' ? 'en-US' : 'tr-TR')
  }, [])

  // Listen for token expiry / missing events fired by metaFetch
  useEffect(() => {
    const expiredHandler = () => setTokenExpired(true)
    const missingHandler = () => {
      setMetaDisconnected(true)
      // When disconnected (no token), suppress error banners
      setFetchError(null)
      setFetchErrorKey(null)
    }
    window.addEventListener(TOKEN_EXPIRED_EVENT, expiredHandler)
    window.addEventListener(TOKEN_MISSING_EVENT, missingHandler)
    return () => {
      window.removeEventListener(TOKEN_EXPIRED_EVENT, expiredHandler)
      window.removeEventListener(TOKEN_MISSING_EVENT, missingHandler)
    }
  }, [])

  // Load recommendations from cache when adAccount changes
  useEffect(() => {
    if (!selectedAdAccountId) return
    const currentLocale = getLocale()
    const cacheKey = `recs:${selectedAdAccountId}:${currentLocale}`
    try {
      const raw = localStorage.getItem(cacheKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setRecommendations(parsed)
        }
      }
    } catch {
      // Ignore cache errors
    }
  }, [selectedAdAccountId])

  // Capabilities for UI gating (CTWA, Lead Forms, Website)
  useEffect(() => {
    let cancelled = false
    metaFetch('/api/meta/capabilities', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data) return
        if (data.ok === true && (data.connected === true || data.connected === false)) {
          setMetaCapabilities(data as MetaCapabilities)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [selectedAdAccountId, refreshToken])

  // Güvenli formatlama yardımcıları
  const num = (v: any, fb: number = 0): number => {
    return (typeof v === 'number' && Number.isFinite(v) ? v : fb)
  }

  const fmtTRY = (v: any): string => {
    return num(v).toLocaleString(localeString, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  }

  const fmtInt = (v: any): string => {
    return num(v).toLocaleString(localeString)
  }

  const fmtFixed = (v: any, digits: number = 0): string => {
    return num(v).toFixed(digits)
  }

  // Normalize spendTRY (number | string | null) to number; returns 0 if invalid. Never returns NaN.
  const parseSpendTRY = (raw: unknown): number => {
    const rawNum =
      raw == null ? null
      : typeof raw === 'number' ? raw
      : typeof raw === 'string' ? (raw.trim() === '' ? null : Number(raw))
      : null
    if (rawNum == null || Number.isNaN(rawNum)) return 0
    return rawNum
  }

  const getAmountSpentTRY = (insightsData: InsightsData | null): number => {
    return parseSpendTRY(insightsData?.spendTRY)
  }

  // Turkish Lira display: locale tr-TR, currency TRY, max 2 fraction digits
  const tryCurrencyFormatter = useMemo(
    () => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }),
    []
  )

  const amountSpentTRY = useMemo(() => getAmountSpentTRY(insights), [insights])

  // Dev-only: catch regressions when API returns spendTRY but we end up showing 0/NaN
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    const raw = insights?.spendTRY as unknown
    const rawNum =
      raw == null ? null
      : typeof raw === 'number' ? raw
      : typeof raw === 'string' ? (raw.trim() === '' ? null : Number(raw))
      : null
    if (rawNum == null || Number.isNaN(rawNum) || rawNum === 0) return
    const computed = getAmountSpentTRY(insights)
    if (computed === 0 || Number.isNaN(computed)) {
      console.warn('[Meta KPI] spendTRY exists but amountSpentTRY became 0 or NaN. Raw spendTRY:', raw)
    }
  }, [insights])


  /** Build date query params for Meta API.
   *  all_time  → {} (server defaults to date_preset=maximum)
   *  known preset → { date_preset }
   *  custom    → { since, until }
   *  unknown   → {} (safe fallback) */
  const buildDateParams = (preset: string, start?: string, end?: string): Record<string, string> => {
    if (preset === 'all_time') return {}
    const VALID_PRESETS: Record<string, string> = {
      'today': 'today', 'yesterday': 'yesterday',
      'last_7d': 'last_7d', 'last_30d': 'last_30d',
      'this_month': 'this_month', 'last_month': 'last_month',
    }
    const mapped = VALID_PRESETS[preset]
    if (mapped) return { date_preset: mapped }
    if (preset === 'custom' && start && end) return { since: start, until: end }
    return {}
  }

  const getDateRangeLabel = (): string => {
    if (dateRange.preset === 'custom' && dateRange.start && dateRange.end) {
      return `${dateRange.start} - ${dateRange.end}`
    }
    const presetLabels: Record<string, string> = {
      'all_time': t('dateRange.allTime'),
      'today': t('dateRange.today'),
      'yesterday': t('dateRange.yesterday'),
      'last_7d': t('dateRange.last7d'),
      'last_30d': t('dateRange.last30d'),
      'this_month': t('dateRange.thisMonth'),
      'last_month': t('dateRange.lastMonth'),
    }
    return presetLabels[dateRange.preset] || t('dateRange.allTime')
  }

  const fetchRecommendations = async () => {
    if (!selectedAdAccountId) return
    const now = Date.now()
    // Rate limit: 10 seconds
    if (now - lastRecsFetchRef.current < 10_000) return
    lastRecsFetchRef.current = now

    recsAbortRef.current?.abort()
    const ac = new AbortController()
    recsAbortRef.current = ac

    setRecsLoading(true)
    setRecsError(null)

    try {
      const currentLocale = getLocale()
      const localeParam = currentLocale === 'en_US' ? 'en_US' : 'tr_TR'
      const cacheKey = `recs:${selectedAdAccountId}:${currentLocale}`
      
      const res = await metaFetch(`/api/meta/recommendations?locale=${localeParam}`, {
        cache: 'no-store',
        signal: ac.signal,
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        setRecsError(json?.details || json?.error || 'recommendations_error')
        setRecsLoading(false)
        return
      }

      const list = Array.isArray(json?.recommendations) ? json.recommendations : []
      setRecommendations(list)
      const score = json?.opportunity_score
      if (score != null && typeof score === 'number') {
        lastGoodOpportunityScoreRef.current = score
        setOpportunityScore(score)
      }

      // Save to cache
      try {
        localStorage.setItem(cacheKey, JSON.stringify(list))
      } catch {
        // Ignore cache errors
      }

      // Resolve missing object_ids
      const campaignIds = new Set(campaigns.map((c: any) => String(c.id)))
      const adsetIds = new Set(adsets.map((a: any) => String(a.id)))
      const adIds = new Set(ads.map((a: any) => String(a.id)))

      const missing = list
        .flatMap((r: FlatRec) => r.object_ids || [])
        .filter((id: string) => {
          const idStr = String(id)
          return (
            !campaignIds.has(idStr) &&
            !adsetIds.has(idStr) &&
            !adIds.has(idStr) &&
            !resolvedMap[idStr]
          )
        })

      const missingUnique = Array.from(new Set(missing)).slice(0, 20)
      if (missingUnique.length) {
        try {
          const rr = await metaFetch('/api/meta/resolve-object-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: missingUnique }),
            cache: 'no-store',
          })
          const rj = await rr.json().catch(() => null)
          if (rr.ok && rj?.map) {
            setResolvedMap((prev) => ({ ...prev, ...rj.map }))
          }
        } catch {
          // Ignore resolve errors
        }
      }

      setRecsLoading(false)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was aborted, ignore
        return
      }
      setRecsError('fetch_failed')
      setRecsLoading(false)
    }
  }

  // Performance recommendations are now lazy-loaded (only fetched on-demand in Optimization section)
  // Function kept available for future use in Optimization page/section
  const fetchPerformanceRecommendations = async (adAccountId: string) => {
    try {
      const response = await metaFetch(`/api/meta/performance-recommendations?adAccountId=${encodeURIComponent(adAccountId)}`, { cache: 'no-store' })
      const responseText = await response.text().catch(() => '{}')
      const data = responseText ? (() => {
        try {
          return JSON.parse(responseText)
        } catch {
          return { ok: false, error: 'parse_error', message: 'Invalid JSON response' }
        }
      })() : { ok: false, error: 'empty_response' }

      if (response.ok && data.ok === true) {
        // Success
        setPerformanceRecommendations(data)
      } else {
        // Error - set fallback data (silent, no banner)
        setPerformanceRecommendations({ items: [], summary: { total: 0, byCampaignId: {} } })
        console.warn('Performance recommendations failed:', data.message || data.error)
      }
    } catch (error) {
      // Network or other error - set fallback data (silent, no banner)
      setPerformanceRecommendations({ items: [], summary: { total: 0, byCampaignId: {} } })
      console.warn('Performance recommendations: fetch failed', error)
    }
  }

  // Resolve account_id from status or active-account endpoint
  const resolveAccountId = async (): Promise<string | null> => {
    try {
      // Try /api/meta/status first (existing logic)
      const statusResponse = await metaFetch('/api/meta/status', { cache: 'no-store' })
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        if (statusData.connected === false) {
          // Explicitly disconnected — no token or expired
          setMetaDisconnected(true)
          return null
        }
        if (statusData.connected && statusData.adAccountId) {
          // Connected and has account — clear any stale disconnected state
          setMetaDisconnected(false)
          setTokenExpired(false)
          return statusData.adAccountId
        }
      }

      // Fallback to /api/active-account?platform=meta
      const activeAccountResponse = await fetch('/api/active-account?platform=meta', { cache: 'no-store' })
      if (activeAccountResponse.ok) {
        const activeAccountData = await activeAccountResponse.json()
        if (activeAccountData.ok && activeAccountData.account_id) {
          setMetaDisconnected(false)
          return activeAccountData.account_id
        }
      }
    } catch (error) {
      console.error('Failed to resolve account_id:', error)
    }
    return null
  }

  const fetchAdAccountsWithScore = async (accountId: string) => {
    try {
      const response = await metaFetch('/api/meta/adaccounts', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        const accounts = data.accounts || []
        const selectedAccount = accounts.find((acc: any) => acc.id === accountId)
        if (selectedAccount?.opportunity_score != null) {
          lastGoodOpportunityScoreRef.current = selectedAccount.opportunity_score
          setOpportunityScore(selectedAccount.opportunity_score)
          // Performance recommendations are now lazy-loaded (only fetched on-demand in Optimization section)
        }
      }
    } catch (error) {
      // Silent fallback
      console.warn('Failed to fetch ad accounts with score')
    }
  }

  // Client-side cache helper
  const getCachedData = (key: string): any | null => {
    const entry = clientCache.current.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      clientCache.current.delete(key)
      return null
    }
    return entry.data
  }

  const setCachedData = (key: string, data: any): void => {
    clientCache.current.set(key, { data, timestamp: Date.now() })
  }

  // Load data for a specific tab, ensuring account_id is available first
  const loadTabData = async (tab: string, forceRefresh: boolean = false) => {
    // Don't clear existing data - keep previous rows while loading
    const hasExistingData = 
      (tab === 'kampanyalar' && campaigns.length > 0) ||
      (tab === 'reklam-setleri' && adsets.length > 0) ||
      (tab === 'reklamlar' && ads.length > 0)
    
    // Only use isLoading for initial load (no data yet)
    // Use counter-based refreshing for background refetch (data exists)
    if (hasExistingData) {
      if (tab === 'kampanyalar') {
        refreshCountCampaignsRef.current++
        setIsRefreshingCampaigns(true)
      } else if (tab === 'reklam-setleri') {
        refreshCountAdsetsRef.current++
        setIsRefreshingAdsets(true)
      } else if (tab === 'reklamlar') {
        refreshCountAdsRef.current++
        setIsRefreshingAds(true)
      }
    } else {
      setIsLoading(true)
    }
    setFetchError(null)
    setFetchErrorKey(null)
    
    try {
      // Step 1: Resolve account_id first
      const accountId = await resolveAccountId()
      
      if (!accountId) {
        // If disconnected (no token), don't show error banners — clean state handles it
        if (metaDisconnected) {
          setFetchError(null)
          setFetchErrorKey(null)
        } else {
          // Has token but no account selected — show account selection prompt
          const errorKey = 'errors.noAdAccount'
          let errorMessage = t(errorKey)
          if (errorMessage === errorKey || errorMessage.includes('errors.noAdAccount')) {
            errorMessage = t('errors.noAdAccount')
          }
          setFetchError(errorMessage)
          setFetchErrorKey('errors.noAdAccount')
        }

        // Debug info in dev mode only
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Meta Ad Account] No account_id resolved:', {
            disconnected: metaDisconnected,
            timestamp: new Date().toISOString()
          })
        }
        setIsLoading(false)
        if (hasExistingData) {
          if (tab === 'kampanyalar') {
            refreshCountCampaignsRef.current = Math.max(0, refreshCountCampaignsRef.current - 1)
            setIsRefreshingCampaigns(refreshCountCampaignsRef.current > 0)
          } else if (tab === 'reklam-setleri') {
            refreshCountAdsetsRef.current = Math.max(0, refreshCountAdsetsRef.current - 1)
            setIsRefreshingAdsets(refreshCountAdsetsRef.current > 0)
          } else if (tab === 'reklamlar') {
            refreshCountAdsRef.current = Math.max(0, refreshCountAdsRef.current - 1)
            setIsRefreshingAds(refreshCountAdsRef.current > 0)
          }
        }
        return
      }

      // Hydrate from localStorage for instant display on refresh (before fetch)
      if (!hasExistingData && typeof localStorage !== 'undefined') {
        try {
          const cacheKey = `metaRows:${accountId}:${tab}`
          let cached = localStorage.getItem(cacheKey)
          if (!cached) cached = localStorage.getItem(`meta:list:${accountId}:${tab}`) // legacy
          if (cached) {
            const parsed = JSON.parse(cached)
            const arr = Array.isArray(parsed) ? parsed : parsed?.rows ?? parsed?.data
            const optScore = !Array.isArray(parsed) && parsed?.opportunityScore != null ? parsed.opportunityScore : null
            if (Array.isArray(arr) && arr.length > 0) {
              if (tab === 'kampanyalar') {
                setCampaigns(arr)
                lastGoodCampaignsRef.current = arr
              } else if (tab === 'reklam-setleri') {
                setAdsets(arr)
                lastGoodAdsetsRef.current = arr
              } else {
                setAds(arr)
                lastGoodAdsRef.current = arr
              }
              if (optScore != null && typeof optScore === 'number') {
                lastGoodOpportunityScoreRef.current = optScore
                setOpportunityScore(optScore)
              }
            }
          }
        } catch {
          // Ignore cache parse errors
        }
      }

      // Step 2: Set account state if not already set
      if (!selectedAdAccountId) {
        setSelectedAdAccountId(accountId)
        
        // Fetch account name and other metadata
        const statusResponse = await metaFetch('/api/meta/status', { cache: 'no-store' })
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          if (statusData.connected) {
            setAdAccountName(statusData.adAccountName || '')
            await fetchAdAccountsWithScore(accountId)
            if (recommendationsEnabled) {
              await fetchRecommendations()
            }
          }
        }
      }

      // Step 3: Fetch data for the specific tab
      const dateParams = buildDateParams(dateRange.preset, dateRange.start, dateRange.end)
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Meta] selectedDateFilter:', dateRange.preset, 'finalPayload:', dateParams, 'omittedDateParams:', Object.keys(dateParams).length === 0)
      }
      const params = new URLSearchParams()

      // adAccountId is required for all fetch requests
      if (!accountId) {
        setIsLoading(false)
        if (hasExistingData) {
          if (tab === 'kampanyalar') {
            refreshCountCampaignsRef.current = Math.max(0, refreshCountCampaignsRef.current - 1)
            setIsRefreshingCampaigns(refreshCountCampaignsRef.current > 0)
          } else if (tab === 'reklam-setleri') {
            refreshCountAdsetsRef.current = Math.max(0, refreshCountAdsetsRef.current - 1)
            setIsRefreshingAdsets(refreshCountAdsetsRef.current > 0)
          } else if (tab === 'reklamlar') {
            refreshCountAdsRef.current = Math.max(0, refreshCountAdsRef.current - 1)
            setIsRefreshingAds(refreshCountAdsRef.current > 0)
          }
        }
        return
      }
      
      params.set('adAccountId', accountId)
      Object.entries(dateParams).forEach(([k, v]) => params.set(k, v))

      // Cache disabled - always fetch fresh data
      
      let endpoint = ''
      if (tab === 'kampanyalar') {
        endpoint = `/api/meta/campaigns?${params.toString()}`
      } else if (tab === 'reklam-setleri') {
        endpoint = `/api/meta/adsets?${params.toString()}`
      } else if (tab === 'reklamlar') {
        endpoint = `/api/meta/ads?${params.toString()}`
      }

      if (!endpoint) {
        setIsLoading(false)
        if (hasExistingData) {
          if (tab === 'kampanyalar') {
            refreshCountCampaignsRef.current = Math.max(0, refreshCountCampaignsRef.current - 1)
            setIsRefreshingCampaigns(refreshCountCampaignsRef.current > 0)
          } else if (tab === 'reklam-setleri') {
            refreshCountAdsetsRef.current = Math.max(0, refreshCountAdsetsRef.current - 1)
            setIsRefreshingAdsets(refreshCountAdsetsRef.current > 0)
          } else if (tab === 'reklamlar') {
            refreshCountAdsRef.current = Math.max(0, refreshCountAdsRef.current - 1)
            setIsRefreshingAds(refreshCountAdsRef.current > 0)
          }
        }
        return
      }

      const response = await fetch(endpoint, { cache: 'no-store' })
      const responseText = await response.text().catch(() => '{}')
      const data = responseText ? (() => {
        try {
          return JSON.parse(responseText)
        } catch {
          return { ok: false, error: 'parse_error', message: 'Invalid JSON response' }
        }
      })() : { ok: false, error: 'empty_response' }

      if (response.status === 429) {
        const retryAfterMs = data.retryAfterMs ?? data.details?.retryAfterMs ?? 4000
        const until = Date.now() + retryAfterMs
        setRateLimitedUntil(until)
        setRateLimitError({
          message: data.message || 'Meta rate limit reached.',
          code: data.code,
          subcode: data.subcode,
          fbtrace_id: data.fbtrace_id,
          retryAfterMs,
        })
        setFetchError(null)
        setFetchErrorKey(null)
        if (rateLimitRetryTimeoutRef.current) clearTimeout(rateLimitRetryTimeoutRef.current)
        rateLimitRetryTimeoutRef.current = setTimeout(() => {
          rateLimitRetryTimeoutRef.current = null
          setRateLimitedUntil(0)
          setRateLimitError(null)
          loadTabData(tab, true)
        }, retryAfterMs)
        return
      }

      if (response.ok && data.ok !== false) {
        setRateLimitError(null)
        // Success - update state directly (no cache)
        const resultData = data.data || []
        
        // Empty response guard: don't overwrite rows if previous data exists and new data is empty
        if (tab === 'kampanyalar') {
          const prevRows = campaigns
          if (resultData.length === 0 && prevRows.length > 0 && selectedAdAccountId) {
            // Don't overwrite - keep existing rows
          } else {
            Object.values(budgetFailsafeTimeoutsRef.current).forEach(clearTimeout)
            budgetFailsafeTimeoutsRef.current = {}
            setCampaigns(prevCampaigns => {
              const loadingIds = new Set(Object.keys(loadingCampaignBudget))
              const merged = (resultData as Campaign[]).map(r => {
                const old = prevCampaigns.find(c => c.id === r.id)
                if (loadingIds.has(r.id) && old) {
                  return { ...old, ...r, budget: r.budget ?? old.budget, daily_budget: r.daily_budget ?? old.daily_budget, lifetime_budget: r.lifetime_budget ?? old.lifetime_budget } as Campaign
                }
                return { ...old, ...r } as Campaign
              })
              lastGoodCampaignsRef.current = merged
              return merged
            })
            setLoadingCampaignBudget({})
          }
        } else if (tab === 'reklam-setleri') {
          const prevRows = adsets
          if (resultData.length === 0 && prevRows.length > 0 && selectedAdAccountId) {
            // Don't overwrite - keep existing rows
          } else {
            setAdsets(prev => {
              if (resultData.length === 0) return prev
              const merged = (resultData as AdSet[]).map(r => {
                const old = prev.find(a => a.id === r.id)
                return { ...old, ...r } as AdSet
              })
              lastGoodAdsetsRef.current = merged
              return merged
            })
          }
        } else if (tab === 'reklamlar') {
          const prevRows = ads
          if (resultData.length === 0 && prevRows.length > 0 && selectedAdAccountId) {
            // Don't overwrite - keep existing rows
          } else {
            setAds(prev => {
              if (resultData.length === 0) return prev
              const merged = (resultData as Ad[]).map(r => {
                const old = prev.find(a => a.id === r.id)
                return { ...old, ...r } as Ad
              })
              lastGoodAdsRef.current = merged
              return merged
            })
          }
        }
        // Persist to localStorage for instant display on next refresh (incl. optScore)
        if (typeof localStorage !== 'undefined' && resultData.length > 0) {
          try {
            const optScore = opportunityScore ?? lastGoodOpportunityScoreRef.current
            const toStore = optScore != null
              ? { rows: resultData, opportunityScore: optScore }
              : resultData
            localStorage.setItem(`metaRows:${accountId}:${tab}`, JSON.stringify(toStore))
          } catch {
            // Ignore quota errors
          }
        }
      } else {
        // Error handling
        // Check for MISSING_AD_ACCOUNT_ID - don't clear table, just show toast
        if (data.error === 'MISSING_AD_ACCOUNT_ID' || data.code === 'MISSING_AD_ACCOUNT_ID') {
          addToast(t('errors.noAdAccount') || 'Please select an ad account', 'error')
          // Keep existing data - don't clear
          setIsLoading(false)
          if (hasExistingData) {
            if (tab === 'kampanyalar') {
              refreshCountCampaignsRef.current = Math.max(0, refreshCountCampaignsRef.current - 1)
              setIsRefreshingCampaigns(refreshCountCampaignsRef.current > 0)
            } else if (tab === 'reklam-setleri') {
              refreshCountAdsetsRef.current = Math.max(0, refreshCountAdsetsRef.current - 1)
              setIsRefreshingAdsets(refreshCountAdsetsRef.current > 0)
            } else if (tab === 'reklamlar') {
              refreshCountAdsRef.current = Math.max(0, refreshCountAdsRef.current - 1)
              setIsRefreshingAds(refreshCountAdsRef.current > 0)
            }
          }
          return
        }
        
        const isRateLimit = data.error === 'rate_limit_exceeded' || 
                           data.code === 17 || 
                           data.subcode === 2446079

        if (isRateLimit) {
          const retryMs = data.retryAfterMs ?? data.details?.retryAfterMs ?? 4000
          const until = Date.now() + retryMs
          setRateLimitedUntil(until)
          setRateLimitError({
            message: data.message || 'Meta rate limit reached. Please wait and retry.',
            code: data.code,
            subcode: data.subcode,
            fbtrace_id: data.fbtrace_id,
            retryAfterMs: retryMs,
          })
          setFetchError(null)
          setFetchErrorKey(null)
          if (rateLimitRetryTimeoutRef.current) clearTimeout(rateLimitRetryTimeoutRef.current)
          rateLimitRetryTimeoutRef.current = setTimeout(() => {
            rateLimitRetryTimeoutRef.current = null
            setRateLimitedUntil(0)
            setRateLimitError(null)
            loadTabData(activeTab, true)
          }, retryMs)
        } else if (data.error === 'missing_token' || data.error === 'token_expired' || response.status === 401) {
          // Auth errors — metaFetch already dispatched events, don't show duplicate error banner
          setFetchError(null)
          setFetchErrorKey(null)
          setRateLimitError(null)
        } else {
          const errorMsg = data.message || data.error || `HTTP ${response.status}`
          const errorDetails = [
            data.details?.message && `message: ${data.details.message}`,
            data.code && `code: ${data.code}`,
            data.subcode && `subcode: ${data.subcode}`,
            data.fbtrace_id && `fbtrace: ${data.fbtrace_id}`,
          ].filter(Boolean).join(' | ')
          const fullError = errorDetails ? `${errorMsg} (${errorDetails})` : errorMsg
          if (process.env.NODE_ENV !== 'production') {
            console.error('[Meta Error]', { message: errorMsg, code: data.code, subcode: data.subcode, fbtrace_id: data.fbtrace_id, details: data.details })
          }
          const fetchErrorKey = tab === 'kampanyalar' ? 'fetchErrors.campaignsLoadFailed' :
            tab === 'reklam-setleri' ? 'fetchErrors.adsetsLoadFailed' : 'fetchErrors.adsLoadFailed'
          setFetchError(t(fetchErrorKey, { error: fullError }))
          setFetchErrorKey(null)
          setRateLimitError(null)
        }
        // Keep existing data - don't clear
      }

      // Step 4: Fetch insights (non-blocking)
      fetchInsights()
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : t('fetchErrors.unknownError')
      console.error('Failed to load tab data:', error)
      setFetchError(t('fetchErrors.dataLoadFailed', { error: errorMsg }))
      setFetchErrorKey(null)
      setRateLimitError(null)
      // Keep existing data - don't clear
    } finally {
      setIsLoading(false)
      if (hasExistingData) {
        if (tab === 'kampanyalar') {
          refreshCountCampaignsRef.current = Math.max(0, refreshCountCampaignsRef.current - 1)
          setIsRefreshingCampaigns(refreshCountCampaignsRef.current > 0)
        } else if (tab === 'reklam-setleri') {
          refreshCountAdsetsRef.current = Math.max(0, refreshCountAdsetsRef.current - 1)
          setIsRefreshingAdsets(refreshCountAdsetsRef.current > 0)
        } else if (tab === 'reklamlar') {
          refreshCountAdsRef.current = Math.max(0, refreshCountAdsRef.current - 1)
          setIsRefreshingAds(refreshCountAdsRef.current > 0)
        }
      }
    }
  }

  // Initial load: read tab from URL and load data for that tab
  useEffect(() => {
    const init = async () => {
      // activeTab is already set from URL in useState initialization
      await loadTabData(activeTab)
      // KPI kartları için kampanya verisini arka planda yükle
      if (activeTab !== 'kampanyalar') {
        loadTabData('kampanyalar')
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // When tab, date range, or refreshToken changes, load data for the new tab
  useEffect(() => {
    if (!selectedAdAccountId) return
    if (rateLimitedUntil > Date.now()) return
    const isUserInitiated = userLoadTriggerRef.current
    if (isUserInitiated) {
      userLoadTriggerRef.current = false
      setIsUserLoading(true)
    } else if (!hasExecutedLoadRef.current) {
      hasExecutedLoadRef.current = true
    }
    loadTabData(activeTab, true)
      .finally(() => setIsUserLoading(false))
    if (activeTab !== 'kampanyalar') {
      loadTabData('kampanyalar', true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, activeTab, selectedAdAccountId, refreshToken, rateLimitedUntil])
  
  // Sync activeTab with URL on mount/URL change
  useEffect(() => {
    const urlTab = searchParams.get('tab')
    if (urlTab && validTabs.includes(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab)
    }
  }, [searchParams])

  // Reset optScore ref when account/tab changes (prevent wrong tab/account score)
  useEffect(() => {
    lastGoodOpportunityScoreRef.current = null
  }, [selectedAdAccountId, activeTab])

  // Fetch recommendations when adAccount changes
  useEffect(() => {
    if (recommendationsEnabled && selectedAdAccountId) {
      fetchRecommendations()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAdAccountId, recommendationsEnabled])

  const fetchInsights = async () => {
    try {
      const dateParams = buildDateParams(dateRange.preset, dateRange.start, dateRange.end)
      const params = new URLSearchParams()
      // insights route uses 'datePreset' (camelCase) instead of 'date_preset'
      if (dateParams.date_preset) params.set('datePreset', dateParams.date_preset)
      if (dateParams.since) params.set('since', dateParams.since)
      if (dateParams.until) params.set('until', dateParams.until)

      const response = await metaFetch(`/api/meta/insights?${params.toString()}`, { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        setInsights(normalizeInsightsResponse(data))
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error)
    }
  }

  const fetchData = async (tab: string) => {
    const hasExistingData = 
      (tab === 'kampanyalar' && campaigns.length > 0) ||
      (tab === 'reklam-setleri' && adsets.length > 0) ||
      (tab === 'reklamlar' && ads.length > 0)
    
    if (hasExistingData) {
      if (tab === 'kampanyalar') {
        refreshCountCampaignsRef.current++
        setIsRefreshingCampaigns(true)
      } else if (tab === 'reklam-setleri') {
        refreshCountAdsetsRef.current++
        setIsRefreshingAdsets(true)
      } else if (tab === 'reklamlar') {
        refreshCountAdsRef.current++
        setIsRefreshingAds(true)
      }
    } else {
      setIsLoading(true)
    }
    setFetchError(null)
    setFetchErrorKey(null)
    try {
      // adAccountId is required for all fetch requests
      if (!selectedAdAccountId) {
        setIsLoading(false)
        if (hasExistingData) {
          if (tab === 'kampanyalar') {
            refreshCountCampaignsRef.current = Math.max(0, refreshCountCampaignsRef.current - 1)
            setIsRefreshingCampaigns(refreshCountCampaignsRef.current > 0)
          } else if (tab === 'reklam-setleri') {
            refreshCountAdsetsRef.current = Math.max(0, refreshCountAdsetsRef.current - 1)
            setIsRefreshingAdsets(refreshCountAdsetsRef.current > 0)
          } else if (tab === 'reklamlar') {
            refreshCountAdsRef.current = Math.max(0, refreshCountAdsRef.current - 1)
            setIsRefreshingAds(refreshCountAdsRef.current > 0)
          }
        }
        return
      }
      
      const dateParams = buildDateParams(dateRange.preset, dateRange.start, dateRange.end)
      const params = new URLSearchParams()

      params.set('adAccountId', selectedAdAccountId)
      Object.entries(dateParams).forEach(([k, v]) => params.set(k, v))

      if (tab === 'kampanyalar') {
        const response = await metaFetch(`/api/meta/campaigns?${params.toString()}`, { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json().catch(() => null)
          if (data && data.ok !== false && Array.isArray(data.data)) {
            // Empty response guard: don't overwrite rows if previous data exists and new data is empty
            const prevRows = campaigns
            if (data.data.length === 0 && prevRows.length > 0 && selectedAdAccountId) {
              console.error('[REFETCH_RETURNED_EMPTY_KEEPING_LAST_GOOD] Campaigns refetch returned empty array, keeping previous rows to prevent table blanking')
              // Don't overwrite - keep existing rows
            } else {
              Object.values(budgetFailsafeTimeoutsRef.current).forEach(clearTimeout)
              budgetFailsafeTimeoutsRef.current = {}
              setCampaigns(prevCampaigns => {
                const loadingIds = Object.keys(loadingCampaignBudget).filter(id => loadingCampaignBudget[id])
                if (loadingIds.length === 0) {
                  lastGoodCampaignsRef.current = data.data
                  return data.data
                }
                const merged = data.data.map((apiCampaign: Campaign) => {
                  if (loadingIds.includes(apiCampaign.id)) {
                    const existing = prevCampaigns.find(c => c.id === apiCampaign.id)
                    return existing || apiCampaign
                  }
                  return apiCampaign
                })
                lastGoodCampaignsRef.current = merged
                return merged
              })
            }
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          if (errorData.error === 'MISSING_AD_ACCOUNT_ID' || errorData.code === 'MISSING_AD_ACCOUNT_ID') {
            addToast(t('errors.noAdAccount') || 'Please select an ad account', 'error')
          } else if (errorData.error === 'missing_token' || errorData.error === 'token_expired' || response.status === 401) {
            // Auth errors — handled by token banner, don't show duplicate
          } else {
            const errorMsg = errorData.message || errorData.error || `HTTP ${response.status}`
            console.error('Failed to fetch campaigns:', errorMsg)
            setFetchError(t('fetchErrors.campaignsLoadFailed', { error: errorMsg }))
            setFetchErrorKey(null)
          }
        }
      } else if (tab === 'reklam-setleri') {
        const response = await metaFetch(`/api/meta/adsets?${params.toString()}`, { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json().catch(() => null)
          if (data && data.ok !== false && Array.isArray(data.data)) {
            // Empty response guard: don't overwrite rows if previous data exists and new data is empty
            const prevRows = adsets
            if (data.data.length === 0 && prevRows.length > 0 && selectedAdAccountId) {
              console.error('[REFETCH_RETURNED_EMPTY_KEEPING_LAST_GOOD] Ad sets refetch returned empty array, keeping previous rows to prevent table blanking')
              // Don't overwrite - keep existing rows
            } else {
              setAdsets(data.data)
              lastGoodAdsetsRef.current = data.data
            }
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          if (errorData.error === 'MISSING_AD_ACCOUNT_ID' || errorData.code === 'MISSING_AD_ACCOUNT_ID') {
            addToast(t('errors.noAdAccount') || 'Please select an ad account', 'error')
          } else if (errorData.error === 'missing_token' || errorData.error === 'token_expired' || response.status === 401) {
            // Auth errors — handled by token banner, don't show duplicate
          } else {
            const errorMsg = errorData.message || errorData.error || `HTTP ${response.status}`
            console.error('Failed to fetch adsets:', errorMsg)
            setFetchError(t('fetchErrors.adsetsLoadFailed', { error: errorMsg }))
            setFetchErrorKey(null)
          }
        }
      } else if (tab === 'reklamlar') {
        const response = await metaFetch(`/api/meta/ads?${params.toString()}`, { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json().catch(() => null)
          if (data && data.ok !== false && Array.isArray(data.data)) {
            // Empty response guard: don't overwrite rows if previous data exists and new data is empty
            const prevRows = ads
            if (data.data.length === 0 && prevRows.length > 0 && selectedAdAccountId) {
              console.error('[REFETCH_RETURNED_EMPTY_KEEPING_LAST_GOOD] Ads refetch returned empty array, keeping previous rows to prevent table blanking')
              // Don't overwrite - keep existing rows
            } else {
              setAds(data.data)
              lastGoodAdsRef.current = data.data
            }
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          if (errorData.error === 'MISSING_AD_ACCOUNT_ID' || errorData.code === 'MISSING_AD_ACCOUNT_ID') {
            addToast(t('errors.noAdAccount') || 'Please select an ad account', 'error')
          } else if (errorData.error === 'missing_token' || errorData.error === 'token_expired' || response.status === 401) {
            // Auth errors — handled by token banner, don't show duplicate
          } else {
            const errorMsg = errorData.message || errorData.error || `HTTP ${response.status}`
            console.error('Failed to fetch ads:', errorMsg)
            setFetchError(t('fetchErrors.adsLoadFailed', { error: errorMsg }))
            setFetchErrorKey(null)
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : t('fetchErrors.unknownError')
      console.error('Failed to fetch data:', error)
      setFetchError(t('fetchErrors.dataLoadFailed', { error: errorMsg }))
      setFetchErrorKey(null)
      // Keep existing data - don't clear
    } finally {
      setIsLoading(false)
      if (hasExistingData) {
        if (tab === 'kampanyalar') {
          refreshCountCampaignsRef.current = Math.max(0, refreshCountCampaignsRef.current - 1)
          setIsRefreshingCampaigns(refreshCountCampaignsRef.current > 0)
        } else if (tab === 'reklam-setleri') {
          refreshCountAdsetsRef.current = Math.max(0, refreshCountAdsetsRef.current - 1)
          setIsRefreshingAdsets(refreshCountAdsetsRef.current > 0)
        } else if (tab === 'reklamlar') {
          refreshCountAdsRef.current = Math.max(0, refreshCountAdsRef.current - 1)
          setIsRefreshingAds(refreshCountAdsRef.current > 0)
        }
      }
    }
  }

  // Toast helper functions
  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(7)
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const updateCampaignStatus = async (campaignId: string, currentStatus: string) => {
    if (loadingCampaignStatus[campaignId]) return
    const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    const previousCampaigns = campaigns
    // Optimistic update - hemen UI'da göster (Google gibi)
    setCampaigns(prev => prev.map(c =>
      c.id === campaignId ? { ...c, status: nextStatus, effective_status: nextStatus } : c
    ))
    setLoadingCampaignStatus(prev => ({ ...prev, [campaignId]: true }))

    try {
      const response = await metaFetch('/api/meta/campaigns/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, status: nextStatus }),
        cache: 'no-store',
      })
      const data = await response.json()

      if (response.ok && data.ok === true) {
        const toastKey = nextStatus === 'PAUSED' ? 'toast.campaignPaused' : 'toast.campaignResumed'
        addToast(t(toastKey), 'success')
        setCampaigns(prev => prev.map(c =>
          c.id === campaignId ? { ...c, status: nextStatus, effective_status: nextStatus } : c
        ))
        // Clear budget loading so filter respects new status
        setLoadingCampaignBudget(prev => {
          const next = { ...prev }
          delete next[campaignId]
          return next
        })
        // Clear failsafe timeout if exists
        const tid = budgetFailsafeTimeoutsRef.current[campaignId]
        if (tid) {
          clearTimeout(tid)
          delete budgetFailsafeTimeoutsRef.current[campaignId]
        }
      } else {
        setCampaigns(previousCampaigns)
        addToast(data.message || t('errors.updateStatusFailed'), 'error')
      }
    } catch (error) {
      setCampaigns(previousCampaigns)
      console.error('Campaign status update error:', error)
      addToast(t('errors.updateStatusFailed'), 'error')
    }

    setLoadingCampaignStatus(prev => {
      const next = { ...prev }
      delete next[campaignId]
      return next
    })
  }

  const handleDeleteCampaignConfirm = async () => {
    if (!deletingCampaign || isDeletingCampaign) return
    const { id: campaignId } = deletingCampaign
    setIsDeletingCampaign(true)
    const previousCampaigns = campaigns
    // Optimistic remove
    setCampaigns(prev => prev.filter(c => c.id !== campaignId))
    try {
      const response = await metaFetch('/api/meta/campaigns/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.ok && data.ok) {
        addToast(t('toastMessages.campaignDeleted'), 'success')
      } else {
        setCampaigns(previousCampaigns)
        addToast(data.message || t('toastMessages.campaignDeleteFailed'), 'error')
      }
    } catch {
      setCampaigns(previousCampaigns)
      addToast(t('toastMessages.campaignDeleteFailed'), 'error')
    } finally {
      setIsDeletingCampaign(false)
      setDeletingCampaign(null)
      setSelectedCampaignId(prev => prev === campaignId ? null : prev)
    }
  }

  const handleBulkDeleteConfirm = async () => {
    if (!bulkDeleting || isBulkDeleting) return
    const { ids, type } = bulkDeleting
    setIsBulkDeleting(true)
    let successCount = 0
    for (const id of ids) {
      try {
        const endpoint = type === 'campaign' ? '/api/meta/campaigns/delete'
          : type === 'adset' ? '/api/meta/adsets/delete'
          : '/api/meta/ads/delete'
        const bodyKey = type === 'campaign' ? 'campaignId' : type === 'adset' ? 'adsetId' : 'adId'
        const response = await metaFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [bodyKey]: id }),
          cache: 'no-store',
        })
        const data = await response.json()
        if (response.ok && data.ok) {
          successCount++
          if (type === 'campaign') setCampaigns(prev => prev.filter(c => c.id !== id))
          else if (type === 'adset') setAdsets(prev => prev.filter(a => a.id !== id))
          else setAds(prev => prev.filter(a => a.id !== id))
        }
      } catch { /* continue */ }
    }
    addToast(`${successCount}/${ids.length} öğe silindi`, successCount === ids.length ? 'success' : 'error')
    setIsBulkDeleting(false)
    setBulkDeleting(null)
    setSelectedCampaignIds([])
    setSelectedAdsetIds([])
    setSelectedAdIds([])
  }

  const handleDeleteAdConfirm = async () => {
    if (!deletingAd || isDeletingAd) return
    const { id: adId } = deletingAd
    setIsDeletingAd(true)
    const previousAds = ads
    setAds(prev => prev.filter(a => a.id !== adId))
    try {
      const response = await metaFetch('/api/meta/ads/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId }),
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.ok && data.ok) {
        addToast(t('toastMessages.adDeleted'), 'success')
      } else {
        setAds(previousAds)
        addToast(data.message || t('toastMessages.adDeleteFailed'), 'error')
      }
    } catch {
      setAds(previousAds)
      addToast(t('toastMessages.adDeleteFailed'), 'error')
    } finally {
      setIsDeletingAd(false)
      setDeletingAd(null)
      setSelectedAdId(prev => prev === adId ? null : prev)
    }
  }

  const handleDuplicateCampaign = async (campaignId: string) => {
    if (isDuplicatingCampaign) return
    setIsDuplicatingCampaign(true)
    try {
      const response = await metaFetch('/api/meta/campaigns/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.ok && data.ok) {
        addToast(t('toastMessages.campaignDuplicated'), 'success')
        triggerRefresh()
      } else {
        addToast(data.message || t('toastMessages.campaignDuplicateFailed'), 'error')
      }
    } catch {
      addToast(t('toastMessages.campaignDuplicateFailed'), 'error')
    } finally {
      setIsDuplicatingCampaign(false)
    }
  }

  const handleDuplicateAdset = async (adsetId: string) => {
    if (isDuplicatingAdset) return
    setIsDuplicatingAdset(true)
    try {
      const response = await metaFetch('/api/meta/adsets/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adsetId }),
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.ok && data.ok) {
        addToast(t('toastMessages.adsetDuplicated'), 'success')
        triggerRefresh()
      } else {
        addToast(data.message || t('toastMessages.adsetDuplicateFailed'), 'error')
      }
    } catch {
      addToast(t('toastMessages.adsetDuplicateFailed'), 'error')
    } finally {
      setIsDuplicatingAdset(false)
    }
  }

  const handleDuplicateAd = async (adId: string) => {
    if (isDuplicatingAd) return
    setIsDuplicatingAd(true)
    try {
      const response = await metaFetch('/api/meta/ads/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId }),
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.ok && data.ok) {
        addToast(t('toastMessages.adDuplicated'), 'success')
        triggerRefresh()
      } else {
        addToast(data.message || t('toastMessages.adDuplicateFailed'), 'error')
      }
    } catch {
      addToast(t('toastMessages.adDuplicateFailed'), 'error')
    } finally {
      setIsDuplicatingAd(false)
    }
  }

  const handleDeleteAdsetConfirm = async () => {
    if (!deletingAdset || isDeletingAdset) return
    const { id: adsetId } = deletingAdset
    setIsDeletingAdset(true)
    const previousAdsets = adsets
    setAdsets(prev => prev.filter(a => a.id !== adsetId))
    try {
      const response = await metaFetch('/api/meta/adsets/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adsetId }),
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.ok && data.ok) {
        addToast(t('toastMessages.adsetDeleted'), 'success')
      } else {
        setAdsets(previousAdsets)
        addToast(data.message || t('toastMessages.adsetDeleteFailed'), 'error')
      }
    } catch {
      setAdsets(previousAdsets)
      addToast(t('toastMessages.adsetDeleteFailed'), 'error')
    } finally {
      setIsDeletingAdset(false)
      setDeletingAdset(null)
      setSelectedAdsetId(prev => prev === adsetId ? null : prev)
    }
  }

  const updateAdSetStatus = async (adSetId: string, currentStatus: string) => {
    if (loadingAdSetStatus[adSetId]) return
    const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    setLoadingAdSetStatus(prev => ({ ...prev, [adSetId]: true }))
    setAdsets(prev => prev.map(a => a.id === adSetId ? { ...a, status: nextStatus, effective_status: nextStatus } : a))
    try {
      const response = await metaFetch('/api/meta/adsets/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adSetId, status: nextStatus }),
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.ok && data.ok === true && data.status === nextStatus) {
        const toastKey = nextStatus === 'PAUSED' ? 'toast.adSetPaused' : 'toast.adSetResumed'
        addToast(t(toastKey), 'success')
        triggerRefresh()
      } else {
        setAdsets(prev => prev.map(a => a.id === adSetId ? { ...a, status: currentStatus, effective_status: currentStatus } : a))
        addToast(data?.message || t('errors.updateStatusFailed'), 'error')
      }
    } catch (error) {
      setAdsets(prev => prev.map(a => a.id === adSetId ? { ...a, status: currentStatus, effective_status: currentStatus } : a))
      console.error('Ad set status update error:', error)
      addToast(t('errors.updateStatusFailed'), 'error')
    } finally {
      setLoadingAdSetStatus(prev => {
        const next = { ...prev }
        delete next[adSetId]
        return next
      })
    }
  }

  const updateAdStatus = async (adId: string, currentStatus: string) => {
    if (loadingAdStatus[adId]) return
    const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    setLoadingAdStatus(prev => ({ ...prev, [adId]: true }))
    setAds(prev => prev.map(a => a.id === adId ? { ...a, status: nextStatus, effective_status: nextStatus } : a))
    try {
      const response = await metaFetch('/api/meta/ads/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId, status: nextStatus }),
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.ok && data.ok === true && data.status === nextStatus) {
        const toastKey = nextStatus === 'PAUSED' ? 'toast.adPaused' : 'toast.adResumed'
        addToast(t(toastKey), 'success')
        triggerRefresh()
      } else {
        setAds(prev => prev.map(a => a.id === adId ? { ...a, status: currentStatus, effective_status: currentStatus } : a))
        addToast(data?.message || t('errors.updateStatusFailed'), 'error')
      }
    } catch (error) {
      setAds(prev => prev.map(a => a.id === adId ? { ...a, status: currentStatus, effective_status: currentStatus } : a))
      console.error('Ad status update error:', error)
      addToast(t('errors.updateStatusFailed'), 'error')
    } finally {
      setLoadingAdStatus(prev => {
        const next = { ...prev }
        delete next[adId]
        return next
      })
    }
  }

  // Handle campaign budget edit
  const handleEditCampaignBudgetClick = (campaign: Campaign) => {
    const hasDaily = campaign.daily_budget != null && campaign.daily_budget > 0
    const hasLifetime = campaign.lifetime_budget != null && campaign.lifetime_budget > 0
    const budgetType = hasDaily ? 'daily' : (hasLifetime ? 'lifetime' : 'daily')
    const currentBudget = hasDaily ? campaign.daily_budget! : (hasLifetime ? campaign.lifetime_budget! : (campaign.budget || 0))
    
    setSelectedCampaignForBudget({
      id: campaign.id,
      name: campaign.name,
      daily_budget: campaign.daily_budget,
      lifetime_budget: campaign.lifetime_budget,
    })
    setBudgetEditType(budgetType)
    setBudgetEditInput(currentBudget > 0 ? currentBudget.toString() : '')
    setSelectedAdsetForBudget(null)
    setShowEditBudgetModal(true)
  }

  // Handle campaign rename
  const handleRenameClick = (campaign: Campaign) => {
    setSelectedCampaignForRename({ id: campaign.id, name: campaign.name })
    setSelectedAdSetForRename(null)
    setSelectedAdForRename(null)
    setRenameInput(campaign.name)
    setRenameType('campaign')
    setShowRenameModal(true)
  }

  // Handle ad set rename
  const handleAdSetRenameClick = (adset: AdSet) => {
    setSelectedAdSetForRename({ id: adset.id, name: adset.name })
    setSelectedCampaignForRename(null)
    setSelectedAdForRename(null)
    setRenameInput(adset.name)
    setRenameType('adset')
    setShowRenameModal(true)
  }

  // Handle ad rename
  const handleAdRenameClick = (ad: Ad) => {
    setSelectedAdForRename({ id: ad.id, name: ad.name })
    setSelectedCampaignForRename(null)
    setSelectedAdSetForRename(null)
    setRenameInput(ad.name)
    setRenameType('ad')
    setShowRenameModal(true)
  }

  const handleConfirmRename = async () => {
    if (!renameInput.trim()) return

    let endpoint = ''
    let entityId = ''
    let successToastKey = ''

    if (renameType === 'campaign' && selectedCampaignForRename) {
      endpoint = '/api/meta/campaigns/rename'
      entityId = selectedCampaignForRename.id
      successToastKey = 'toast.renameSuccess'
    } else if (renameType === 'adset' && selectedAdSetForRename) {
      endpoint = '/api/meta/adsets/rename'
      entityId = selectedAdSetForRename.id
      successToastKey = 'toast.renameAdSetSuccess'
    } else if (renameType === 'ad' && selectedAdForRename) {
      endpoint = '/api/meta/ads/rename'
      entityId = selectedAdForRename.id
      successToastKey = 'toast.renameAdSuccess'
    } else {
      return
    }

    setIsRenaming(true)
    try {
      const body: any = { name: renameInput.trim() }
      if (renameType === 'campaign') {
        body.campaignId = entityId
      } else if (renameType === 'adset') {
        body.adSetId = entityId
      } else if (renameType === 'ad') {
        body.adId = entityId
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      })

      const data = await response.json()

        if (response.ok && data.ok === true) {
          // Optimistic update: update name immediately
          if (renameType === 'campaign') {
            setCampaigns(prev => prev.map(c => 
              c.id === entityId ? { ...c, name: renameInput.trim() } : c
            ))
          } else if (renameType === 'adset') {
            setAdsets(prev => prev.map(a => 
              a.id === entityId ? { ...a, name: renameInput.trim() } : a
            ))
          } else if (renameType === 'ad') {
            setAds(prev => prev.map(a => 
              a.id === entityId ? { ...a, name: renameInput.trim() } : a
            ))
          }
          
          // Success toast with i18n
          addToast(t(successToastKey), 'success')
          
          // Force refetch to ensure consistency
          triggerRefresh()
          
          setShowRenameModal(false)
        setSelectedCampaignForRename(null)
        setSelectedAdSetForRename(null)
        setSelectedAdForRename(null)
        setRenameInput('')
      } else {
        // Error handling with i18n
        const errorType = data.error || 'unknown'
        let errorMessage = t('errors.unknown.title')

        if (errorType === 'permission_denied') {
          errorMessage = t('errors.metaApi.title') + ': ' + (data.message || t('errors.metaApi.desc'))
        } else if (errorType === 'rate_limit_exceeded') {
          errorMessage = t('errors.metaApi.title') + ': ' + (data.message || t('errors.metaApi.desc'))
        } else if (errorType === 'validation_error') {
          errorMessage = t('errors.invalidForm.title') + ': ' + (data.message || t('errors.invalidForm.desc'))
        } else if (data.message) {
          errorMessage = data.message
        }

        addToast(errorMessage, 'error')
      }
    } catch (error) {
      console.error('Rename error:', error)
      addToast(t('errors.unknown.title') + ': ' + t('errors.unknown.desc'), 'error')
    } finally {
      setIsRenaming(false)
    }
  }

  // Handle adset budget edit
  const handleEditBudgetClick = (adset: AdSet) => {
    const hasDaily = adset.daily_budget != null && adset.daily_budget > 0
    const hasLifetime = adset.lifetime_budget != null && adset.lifetime_budget > 0
    const budgetType = hasDaily ? 'daily' : (hasLifetime ? 'lifetime' : 'daily')
    const currentBudget = hasDaily ? adset.daily_budget! : (hasLifetime ? adset.lifetime_budget! : 0)
    
    setSelectedAdsetForBudget({
      id: adset.id,
      name: adset.name,
      daily_budget: adset.daily_budget,
      lifetime_budget: adset.lifetime_budget,
    })
    setSelectedCampaignForBudget(null)
    setBudgetEditType(budgetType)
    setBudgetEditInput(currentBudget > 0 ? currentBudget.toString() : '')
    setShowEditBudgetModal(true)
  }

  const handleConfirmBudgetEdit = async () => {
    if ((!selectedAdsetForBudget && !selectedCampaignForBudget) || !selectedAdAccountId) return

    const budgetValue = parseFloat(budgetEditInput)
    if (!Number.isFinite(budgetValue) || budgetValue <= 0) {
      addToast(t('fetchErrors.invalidBudget'), 'error')
      return
    }

    if (selectedCampaignForBudget) {
      // Update campaign budget — set loading FIRST so filteredCampaigns keeps the row visible
      const campaignId = selectedCampaignForBudget.id
      const prev = campaigns.find((c) => c.id === campaignId)
      const prevDaily = prev?.daily_budget ?? null
      const prevLifetime = prev?.lifetime_budget ?? null
      const prevBudget = prev?.budget ?? null
      setLoadingCampaignBudget((p) => ({ ...p, [campaignId]: true }))
      setIsUpdatingCampaignBudget(true)

      // Optimistic update AFTER loading flag so filter keeps campaign in list
      // Do NOT override status — keep configured status (ACTIVE/PAUSED); IN_PROCESS is temporary delivery state
      setCampaigns((prevList) =>
        prevList.map((c) => {
          if (c.id !== campaignId) return c
          const updated: Campaign = { ...c }
          if (budgetEditType === 'daily') {
            updated.daily_budget = budgetValue
            updated.budget = budgetValue
          } else {
            updated.lifetime_budget = budgetValue
            updated.budget = budgetValue
          }
          return updated
        })
      )

      try {
        const response = await metaFetch('/api/meta/campaigns/budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId,
            dailyBudget: budgetEditType === 'daily' ? budgetValue : undefined,
            lifetimeBudget: budgetEditType === 'lifetime' ? budgetValue : undefined,
          }),
          cache: 'no-store',
        })

        let data: any = {}
        try {
          data = await response.json()
        } catch (parseError) {
          console.error('[Budget Update] Response parse error:', parseError)
          // Revert optimistic update on parse error
          setCampaigns((prevList) =>
            prevList.map((c) => {
              if (c.id !== campaignId) return c
              return {
                ...c,
                daily_budget: prevDaily,
                lifetime_budget: prevLifetime,
                budget: prevBudget,
              }
            })
          )
          const tid = budgetFailsafeTimeoutsRef.current[campaignId]
          if (tid) {
            clearTimeout(tid)
            delete budgetFailsafeTimeoutsRef.current[campaignId]
          }
          setLoadingCampaignBudget((p) => {
            const next = { ...p }
            delete next[campaignId]
            return next
          })
          setIsUpdatingCampaignBudget(false)
          addToast(t('errors.budgetUpdateFailed') || 'Budget update failed.', 'error')
          return
        }

        if (response.ok && data.ok === true) {
          // Success toast with i18n
          addToast(t('toast.budgetSuccess'), 'success')
          // Staggered refetch so effective_status can stabilize (Meta may return IN_PROCESS briefly)
          ;[2000, 5000, 10000].forEach((delay) => {
            setTimeout(() => {
              triggerRefresh()
            }, delay)
          })
          // "Güncelleniyor" badge for 15s; then clear loading
          const existing = budgetFailsafeTimeoutsRef.current[campaignId]
          if (existing) clearTimeout(existing)
          budgetFailsafeTimeoutsRef.current[campaignId] = setTimeout(() => {
            setLoadingCampaignBudget((prev) => {
              const next = { ...prev }
              delete next[campaignId]
              return next
            })
            delete budgetFailsafeTimeoutsRef.current[campaignId]
          }, 15000)
          setShowEditBudgetModal(false)
          setSelectedCampaignForBudget(null)
          setBudgetEditInput('')
        } else {
          // Revert optimistic update on error
          setCampaigns((prevList) =>
            prevList.map((c) => {
              if (c.id !== campaignId) return c
              return {
                ...c,
                daily_budget: prevDaily,
                lifetime_budget: prevLifetime,
                budget: prevBudget,
              }
            })
          )
          const tid = budgetFailsafeTimeoutsRef.current[campaignId]
          if (tid) {
            clearTimeout(tid)
            delete budgetFailsafeTimeoutsRef.current[campaignId]
          }
          setLoadingCampaignBudget((p) => {
            const next = { ...p }
            delete next[campaignId]
            return next
          })

          // Error handling with i18n - prioritize Meta error message
          let errorMessage = t('errors.budgetUpdateFailed') || 'Budget update failed.'
          
          if (data.code === 'META_API_ERROR' && data.meta?.message) {
            // Use Meta's error message directly (it's already user-friendly)
            errorMessage = data.meta.message
          } else if (data.message) {
            errorMessage = data.message
          } else {
            // Fallback to i18n based on error type
            const errorType = data.error || 'unknown'
            if (errorType === 'permission_denied') {
              errorMessage = t('errors.metaApi.title') + ': ' + (t('errors.metaApi.desc'))
            } else if (errorType === 'rate_limit_exceeded') {
              errorMessage = t('errors.metaApi.title') + ': ' + (t('errors.metaApi.desc'))
            } else if (errorType === 'validation_error') {
              errorMessage = t('errors.invalidForm.title') + ': ' + (t('errors.invalidForm.desc'))
            }
          }

          addToast(errorMessage, 'error')
        }
      } catch (error) {
        // Revert optimistic update on error
        setCampaigns((prevList) =>
          prevList.map((c) => {
            if (c.id !== campaignId) return c
            return {
              ...c,
              daily_budget: prevDaily,
              lifetime_budget: prevLifetime,
              budget: prevBudget,
            }
          })
        )
        const tid = budgetFailsafeTimeoutsRef.current[campaignId]
        if (tid) {
          clearTimeout(tid)
          delete budgetFailsafeTimeoutsRef.current[campaignId]
        }
        setLoadingCampaignBudget((p) => {
          const next = { ...p }
          delete next[campaignId]
          return next
        })
        console.error('Campaign budget update error:', error)
        addToast(t('errors.unknown.title') + ': ' + t('errors.unknown.desc'), 'error')
      } finally {
        setIsUpdatingCampaignBudget(false)
      }
    } else if (selectedAdsetForBudget) {
      // Update adset budget
      setIsUpdatingAdsetBudget(true)
      try {
        const response = await metaFetch('/api/meta/adset-budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_id: selectedAdAccountId,
            adset_id: selectedAdsetForBudget.id,
            budgetTL: budgetValue,
            budgetType: budgetEditType,
          }),
          cache: 'no-store',
        })

        if (response.ok) {
          const data = await response.json()
          
          // Optimistic update: update adset budget immediately
          setAdsets(prev => prev.map(a => {
            if (a.id === selectedAdsetForBudget.id) {
              const updated = { ...a }
              if (budgetEditType === 'daily') {
                updated.daily_budget = budgetValue
              } else {
                updated.lifetime_budget = budgetValue
              }
              return updated
            }
            return a
          }))
          
          addToast(t('actions.budgetUpdated', { name: selectedAdsetForBudget.name }), 'success')
          
          // Force refetch to ensure consistency
          triggerRefresh()
          
          setShowEditBudgetModal(false)
          setSelectedAdsetForBudget(null)
          setBudgetEditInput('')
        } else {
          // Safe error handling: read as text first to avoid JSON parse errors
          let errorMessage = t('fetchErrors.budgetUpdateFailed')
          try {
            const errorText = await response.text()
            if (errorText) {
              try {
                const errorData = JSON.parse(errorText)
                errorMessage =
                  errorData.message ||
                  (errorData.error === 'permission_denied'
                    ? t('fetchErrors.permissionDenied')
                    : errorData.error === 'rate_limit_exceeded'
                    ? t('fetchErrors.tooManyRequests')
                    : errorData.error === 'validation_error'
                    ? t('fetchErrors.invalidBudgetValue')
                    : errorData.error === 'missing_token'
                    ? t('fetchErrors.sessionExpired')
                    : errorData.error || t('fetchErrors.genericError'))
              } catch {
                // If not JSON, use the text as error message (truncate if too long)
                errorMessage = errorText.length > 200 ? errorText.substring(0, 200) + '...' : errorText
              }
            }
          } catch (textError) {
            console.error('Failed to read error response:', textError)
            errorMessage = `HTTP ${response.status}: ${response.statusText}`
          }
          addToast(errorMessage, 'error')
        }
      } catch (error) {
        console.error('Budget update error:', error)
        addToast(t('fetchErrors.tryAgain'), 'error')
      } finally {
        setIsUpdatingAdsetBudget(false)
      }
    }
  }

  const isStatusToggleable = (s: string) => s === 'ACTIVE' || s === 'PAUSED'

  const handlePublishToggle = (type: 'campaign' | 'adset' | 'ad', id: string, currentStatus: string) => {
    if (!isStatusToggleable(currentStatus)) return
    if (type === 'campaign') updateCampaignStatus(id, currentStatus)
    else if (type === 'adset') updateAdSetStatus(id, currentStatus)
    else updateAdStatus(id, currentStatus)
  }

  const handleDateChange = (startDate: string, endDate: string, preset?: string) => {
    userLoadTriggerRef.current = true
    setDateRange({ preset: preset || 'custom', start: startDate, end: endDate })
  }

  const recCountForCampaign = (campaignId: string): number => {
    let n = 0
    for (const r of recommendations) {
      for (const id of r.object_ids || []) {
        const idStr = String(id)
        if (idStr === campaignId) {
          n++
          continue
        }
        const resolved = resolvedMap[idStr]
        if (resolved?.campaignId && String(resolved.campaignId) === campaignId) {
          n++
          continue
        }
      }
    }
    return n
  }

  const recCountForAdset = (adsetId: string): number => {
    let n = 0
    for (const r of recommendations) {
      for (const id of r.object_ids || []) {
        const idStr = String(id)
        if (idStr === adsetId) {
          n++
          continue
        }
        const resolved = resolvedMap[idStr]
        if (resolved?.adsetId && String(resolved.adsetId) === adsetId) {
          n++
          continue
        }
        // Also check if resolved campaign matches adset's campaign
        if (resolved?.campaignId) {
          const adset = adsets.find((a: any) => String(a.id) === adsetId)
          if (adset && String(adset.campaignId) === String(resolved.campaignId)) {
            n++
            continue
          }
        }
      }
    }
    return n
  }

  const recCountForAd = (adId: string): number => {
    let n = 0
    for (const r of recommendations) {
      for (const id of r.object_ids || []) {
        const idStr = String(id)
        if (idStr === adId) {
          n++
          continue
        }
        const resolved = resolvedMap[idStr]
        if (resolved?.adsetId) {
          const ad = ads.find((a: any) => String(a.id) === adId)
          if (ad && String(ad.adsetId) === String(resolved.adsetId)) {
            n++
            continue
          }
        }
      }
    }
    return n
  }

  const getRecommendationCount = (itemId: string): number => {
    // Use performance recommendations if available
    if (performanceRecommendations?.summary?.byCampaignId) {
      const count = performanceRecommendations.summary.byCampaignId[itemId]
      if (count !== undefined) {
        return count
      }
    }

    // Use resolved recommendations with rollup
    if (activeTab === 'kampanyalar') {
      return recCountForCampaign(itemId)
    } else if (activeTab === 'reklam-setleri') {
      return recCountForAdset(itemId)
    } else {
      return recCountForAd(itemId)
    }
  }

  const handleRecommendationClick = (item: any) => {
    const kind = activeTab === 'kampanyalar' ? 'campaigns' : activeTab === 'reklam-setleri' ? 'adsets' : 'ads'
    setSelectedEntity({ id: item.id, name: item.name, kind })
    setIsRecPanelOpen(true)
  }

  const getEntityRecommendations = (): FlatRec[] => {
    if (!selectedEntity) return []
    
    // Use performance recommendations if available
    if (performanceRecommendations?.items) {
      const perfRecs = performanceRecommendations.items.filter(
        (item: any) => item.entityId === selectedEntity.id && item.entityType === 'CAMPAIGN'
      )
      if (perfRecs.length > 0) {
        // Convert to FlatRec format
        return perfRecs.map((item: any) => ({
          type: item.type || 'UNKNOWN',
          object_ids: item.entityId ? [item.entityId] : [],
          title: item.title || null,
          description: item.message || null,
          points: null,
          impact: item.impact || null,
          deep_link: null,
        }))
      }
    }
    
    // Use recommendations with resolvedMap rollup
    const entityId = selectedEntity.id
    const matching: FlatRec[] = []
    
    for (const r of recommendations) {
      let matches = false
      for (const id of r.object_ids || []) {
        const idStr = String(id)
        if (idStr === entityId) {
          matches = true
          break
        }
        const resolved = resolvedMap[idStr]
        if (selectedEntity.kind === 'campaigns' && resolved?.campaignId && String(resolved.campaignId) === entityId) {
          matches = true
          break
        }
        if (selectedEntity.kind === 'adsets' && resolved?.adsetId && String(resolved.adsetId) === entityId) {
          matches = true
          break
        }
        if (selectedEntity.kind === 'ads') {
          const ad = ads.find((a: any) => String(a.id) === entityId)
          if (ad && resolved?.adsetId && String(ad.adsetId) === String(resolved.adsetId)) {
            matches = true
            break
          }
        }
      }
      if (matches) {
        matching.push(r)
      }
    }
    
    return matching
  }

  const handleApplyRecommendation = (rec: FlatRec) => {
    if (rec.type === 'BUDGET_LIMITED' || rec.type === 'SCALE_GOOD_CAMPAIGN') {
      setSelectedRec(rec)
      setBudgetInput('')
      setShowBudgetModal(true)
    } else if (rec.type === 'CTX_CREATION_PACKAGE') {
      setShowCreateModal(true)
    } else {
      // Diğer tipler için bilgi mesajı gösterilecek (UI'da)
    }
  }

  const handleBudgetUpdate = async () => {
    if (!selectedEntity || !selectedRec) return
    
    const budgetValue = parseFloat(budgetInput)
    if (!Number.isFinite(budgetValue) || budgetValue <= 0) {
      addToast(t('errors.invalidForm.title') + ': ' + t('errors.invalidForm.desc'), 'error')
      return
    }

    setIsUpdatingBudget(true)
    try {
      if (selectedEntity.kind === 'campaigns') {
        const response = await metaFetch('/api/meta/campaigns/budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            campaignId: selectedEntity.id, 
            dailyBudget: budgetValue 
          }),
          cache: 'no-store',
        })

        let data: any = {}
        try {
          data = await response.json()
        } catch (parseError) {
          console.error('[Budget Update] Response parse error:', parseError)
          addToast(t('errors.budgetUpdateFailed') || 'Budget update failed.', 'error')
          return
        }

        if (response.ok && data.ok === true) {
          addToast(t('toast.budgetSuccess'), 'success')
          triggerRefresh()
          setShowBudgetModal(false)
          setBudgetInput('')
        } else {
          // Error handling with i18n - prioritize Meta error message
          let errorMessage = t('errors.budgetUpdateFailed') || 'Budget update failed.'
          
          if (data.code === 'META_API_ERROR' && data.meta?.message) {
            errorMessage = data.meta.message
          } else if (data.message) {
            errorMessage = data.message
          } else {
            const errorType = data.error || 'unknown'
            if (errorType === 'permission_denied') {
              errorMessage = t('errors.metaApi.title') + ': ' + (t('errors.metaApi.desc'))
            } else if (errorType === 'rate_limit_exceeded') {
              errorMessage = t('errors.metaApi.title') + ': ' + (t('errors.metaApi.desc'))
            } else if (errorType === 'validation_error') {
              errorMessage = t('errors.invalidForm.title') + ': ' + (t('errors.invalidForm.desc'))
            }
          }

          addToast(errorMessage, 'error')
        }
      } else if (selectedEntity.kind === 'adsets') {
        const response = await metaFetch('/api/meta/adset-budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adsetId: selectedEntity.id, dailyBudget: budgetValue }),
          cache: 'no-store',
        })

        let data: any = {}
        try {
          data = await response.json()
        } catch (parseError) {
          console.error('[AdSet Budget Update] Response parse error:', parseError)
          addToast(t('errors.budgetUpdateFailed') || 'Budget update failed.', 'error')
          return
        }

        if (response.ok && data.ok === true) {
          addToast(t('toast.budgetSuccess'), 'success')
          triggerRefresh()
          setShowBudgetModal(false)
          setBudgetInput('')
        } else {
          let errorMessage = t('errors.budgetUpdateFailed') || 'Budget update failed.'
          if (data.message) {
            errorMessage = data.message
          }
          addToast(errorMessage, 'error')
        }
      }
    } catch (error) {
      console.error('Budget update error:', error)
      addToast(t('errors.budgetUpdateFailed') || 'Budget update failed.', 'error')
    } finally {
      setIsUpdatingBudget(false)
    }
  }

  const getRecommendationTypeLabel = (type: string): string => {
    try {
      const translated = t(`recommendationTypes.${type}` as any, { defaultValue: type })
      // Eğer translation bulunamazsa (aynı string dönerse), orijinal type'ı göster
      if (translated && !translated.includes('recommendationTypes.')) {
        return translated
      }
    } catch {
      // Translation key bulunamadı
    }
    return type
  }

  // DELETED/ARCHIVED items are always hidden regardless of showInactive toggle
  const ALWAYS_HIDDEN = ['DELETED', 'ARCHIVED']
  // These statuses are hidden when showInactive=false:
  // CAMPAIGN_PAUSED = adset/ad inactive because parent campaign is paused
  // ADSET_PAUSED = ad inactive because parent adset is paused
  const HIDDEN_WHEN_INACTIVE = ['PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'WITH_ISSUES']

  // Base dataset: date + ALWAYS_HIDDEN rules only (search-independent, showInactive-independent).
  // KPI cards aggregate from this layer.
  const campaignsForKpi = useMemo(() => {
    const rows =
      (isRefreshingCampaigns && (!campaigns || campaigns.length === 0) && lastGoodCampaignsRef.current)
        ? lastGoodCampaignsRef.current
        : campaigns
    return (rows || []).filter(c => !ALWAYS_HIDDEN.includes(c.status ?? ''))
  }, [campaigns, isRefreshingCampaigns])

  // Table rows: campaignsForKpi + showInactive toggle + text search
  const filteredCampaigns = useMemo(() => {
    let filtered = campaignsForKpi
    if (!showInactive) {
      filtered = filtered.filter(c => !HIDDEN_WHEN_INACTIVE.includes(c.status ?? '') || loadingCampaignBudget[c.id] || loadingCampaignStatus[c.id])
    }
    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    return filtered
  }, [campaignsForKpi, showInactive, searchQuery, loadingCampaignBudget, loadingCampaignStatus])

  // KPI cards: active-only aggregate from campaignsForKpi.
  // Independent of search query and showInactive toggle.
  const campaignKpis = useMemo(() => {
    const active = campaignsForKpi.filter(c => !HIDDEN_WHEN_INACTIVE.includes(c.status ?? ''))
    const totals = { spent: 0, reach: 0, impressions: 0, engagement: 0, clicks: 0 }
    for (const c of active) {
      totals.spent += c.spent || 0
      totals.reach += c.reach || 0
      totals.impressions += c.impressions || 0
      totals.engagement += c.engagement || 0
      totals.clicks += c.clicks || 0
    }
    return totals
  }, [campaignsForKpi])

  const filteredAdsets = useMemo(() => {
    const rows =
      (isRefreshingAdsets && (!adsets || adsets.length === 0) && lastGoodAdsetsRef.current)
        ? lastGoodAdsetsRef.current
        : adsets
    let filtered = rows || []
    if (selectedCampaignId) {
      filtered = filtered.filter(a => a.campaignId === selectedCampaignId)
    }
    filtered = filtered.filter(a => !ALWAYS_HIDDEN.includes(a.effective_status ?? a.status ?? '') || loadingAdSetStatus[a.id])
    if (!showInactive) {
      filtered = filtered.filter(a => !HIDDEN_WHEN_INACTIVE.includes(a.effective_status ?? a.status ?? '') || loadingAdSetStatus[a.id])
    }
    if (searchQuery) {
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    return filtered
  }, [adsets, selectedCampaignId, showInactive, searchQuery, isRefreshingAdsets, loadingAdSetStatus])

  const filteredAds = useMemo(() => {
    const rows =
      (isRefreshingAds && (!ads || ads.length === 0) && lastGoodAdsRef.current)
        ? lastGoodAdsRef.current
        : ads
    let filtered = rows || []
    if (selectedAdsetId) {
      filtered = filtered.filter(a => a.adsetId === selectedAdsetId)
    } else if (selectedCampaignId) {
      filtered = filtered.filter(a => a.campaignId === selectedCampaignId)
    }
    filtered = filtered.filter(a => !ALWAYS_HIDDEN.includes(a.effective_status ?? a.status ?? '') || loadingAdStatus[a.id])
    if (!showInactive) {
      filtered = filtered.filter(a => !HIDDEN_WHEN_INACTIVE.includes(a.effective_status ?? a.status ?? '') || loadingAdStatus[a.id])
    }
    if (searchQuery) {
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    return filtered
  }, [ads, selectedAdsetId, selectedCampaignId, showInactive, searchQuery, isRefreshingAds, loadingAdStatus])

  // When any edit overlay opens, preload missing tab data so sidebar tree is complete
  useEffect(() => {
    const isEditing = editingCampaign || editingAdset || editingAd
    if (!isEditing) return
    const loadMissing = async () => {
      if (campaigns.length === 0) await loadTabData('kampanyalar')
      if (adsets.length === 0) await loadTabData('reklam-setleri')
      if (ads.length === 0) await loadTabData('reklamlar')
    }
    loadMissing()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCampaign, editingAdset, editingAd])

  // Tree data for edit overlay sidebar
  const treeData = useMemo(() => ({
    campaigns: campaigns.map(c => ({ id: c.id, name: c.name, status: c.status })),
    adsets: adsets.map(a => ({ id: a.id, name: a.name, status: a.status, campaignId: a.campaignId })),
    ads: ads.map(a => ({ id: a.id, name: a.name, status: a.status, adsetId: a.adsetId, campaignId: a.campaignId })),
  }), [campaigns, adsets, ads])

  const handleEntitySelect = useCallback((type: 'campaign' | 'adset' | 'ad', id: string, name: string) => {
    setEditingCampaign(null)
    setEditingAdset(null)
    setEditingAd(null)
    if (type === 'campaign') {
      setEditingCampaign({ id, name })
    } else if (type === 'adset') {
      // Look up campaignId from both main state and treeData (sidebar may have data that main state lacks)
      const adset = adsets.find(a => a.id === id) || treeData.adsets.find(a => a.id === id)
      setEditingAdset({ id, name, campaignId: adset?.campaignId })
    } else {
      const ad = ads.find(a => a.id === id) || treeData.ads.find(a => a.id === id)
      setEditingAd({ id, name, adsetId: ad?.adsetId, campaignId: ad?.campaignId })
    }
  }, [adsets, ads, treeData])

  const getCurrentData = () => {
    if (activeTab === 'kampanyalar') return filteredCampaigns
    if (activeTab === 'reklam-setleri') return filteredAdsets
    return filteredAds
  }

  // Generate table columns based on active tab
  const getTableColumns = () => {
    const baseCols = [
      { key: 'checkbox', label: '' },
      { key: 'publish', label: t('table.status') },
      { key: 'effectiveStatus', label: t('table.statusColumn') },
    ]

    // Only add recommendations column if enabled
    if (recommendationsEnabled) {
      baseCols.push({ key: 'recommendations', label: t('table.recommendations') })
    }

    if (activeTab === 'kampanyalar') {
      return [
        ...baseCols,
        { key: 'campaign', label: t('table.campaign') },
        { key: 'budget', label: t('table.budget') },
        { key: 'spent', label: t('table.spent') },
        { key: 'impressions', label: t('table.impressions') },
        { key: 'clicks', label: t('table.clicks') },
        { key: 'ctr', label: t('table.ctr') },
        { key: 'cpc', label: t('table.cpc') },
      ]
    } else if (activeTab === 'reklam-setleri') {
      return [
        ...baseCols,
        { key: 'adset', label: t('table.adset') },
        { key: 'budget', label: t('table.budget') },
        { key: 'spent', label: t('table.spent') },
        { key: 'impressions', label: t('table.impressions') },
        { key: 'clicks', label: t('table.clicks') },
        { key: 'ctr', label: t('table.ctr') },
        { key: 'cpc', label: t('table.cpc') },
      ]
    } else {
      return [
        ...baseCols,
        { key: 'ad', label: t('table.ad') },
        { key: 'spent', label: t('table.spent') },
        { key: 'impressions', label: t('table.impressions') },
        { key: 'clicks', label: t('table.clicks') },
        { key: 'ctr', label: t('table.ctr') },
        { key: 'cpc', label: t('table.cpc') },
      ]
    }
  }

  const tabs = [
    { id: 'kampanyalar', label: t('tabs.campaigns') },
    { id: 'reklam-setleri', label: t('tabs.adsets') },
    { id: 'reklamlar', label: t('tabs.ads') },
  ]

  const mockChartData = useMemo(() => Array.from({ length: 10 }, () => Math.random() * 100 + 50), [])
  // Single source of truth: account status. metaLoaded = hydrated (account selection ready to evaluate).
  const metaLoaded = hydrated
  const hasSelectedAccount = !!selectedAdAccountId
  const metaAccountStatus = !metaLoaded ? 'unknown' : (hasSelectedAccount ? 'ready' : 'empty')
  // Banner/KPI/CTA: empty state when status is not ready OR disconnected/expired
  const isMetaEmptyState = metaAccountStatus !== 'ready' || metaDisconnected || tokenExpired

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log('META_STATUS', metaAccountStatus, { selectedAdAccountId, hydrated })
  }

  const currentData = getCurrentData()
  const selectedIds = activeTab === 'kampanyalar' ? selectedCampaignIds
    : activeTab === 'reklam-setleri' ? selectedAdsetIds : selectedAdIds
  const setSelectedIds = activeTab === 'kampanyalar' ? setSelectedCampaignIds
    : activeTab === 'reklam-setleri' ? setSelectedAdsetIds : setSelectedAdIds
  const toolbarCurrentData = activeTab === 'kampanyalar' ? filteredCampaigns
    : activeTab === 'reklam-setleri' ? filteredAdsets : filteredAds
  const isFetchingActiveTab =
    activeTab === 'kampanyalar'
      ? isRefreshingCampaigns
      : activeTab === 'reklam-setleri'
        ? isRefreshingAdsets
        : isRefreshingAds
  const tableColumns = getTableColumns()

  // Shimmer ONLY on list panel (table) during fetch/update - nowhere else
  const hasBudgetUpdating = Object.values(loadingCampaignBudget).some(Boolean)
  const hasRowUpdating =
    Object.values(loadingCampaignStatus).some(Boolean) ||
    Object.values(loadingAdSetStatus).some(Boolean) ||
    Object.values(loadingAdStatus).some(Boolean)
  const showTableShimmer = (isLoading || isFetchingActiveTab) || hasBudgetUpdating || hasRowUpdating

  return (
    <>
      <Topbar
        title={t('title')}
        description={t('description')}
        actionButton={{
          label: t('createCampaign'),
          onClick: () => setShowObjectiveSelector(true),
          disabled: isMetaEmptyState,
          title: isMetaEmptyState ? t('fetchErrors.selectAdAccount') : undefined,
        }}
        adAccountName={adAccountName}
        showMetaSection
      />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-6 space-y-6">
          {/* Quick Actions placeholder */}
          {/* KPI Cards — isMetaEmptyState => value "—", delta "—", placeholder sparkline (no ₺0/0); component empty prop enforces override */}
          {(() => {
            const metaDates = insights?.series?.dates ?? []
            const metaLocale = localeString === 'en-US' ? 'en' : 'tr'
            const mFmtSpend = insights?.series?.spend?.map(v => tryCurrencyFormatter.format(v)) ?? []
            const mFmtReach = insights?.series?.reach?.map(v => fmtInt(v)) ?? []
            const mFmtImpressions = insights?.series?.impressions?.map(v => fmtInt(v)) ?? []
            const mFmtClicks = insights?.series?.clicks?.map(v => fmtInt(v)) ?? []
            return (
          <div className="grid grid-cols-5 gap-4">
            <DashboardKpiCard
              label={tMetrics('amountSpent')}
              periodLabel={getDateRangeLabel()}
              value={tryCurrencyFormatter.format(campaignKpis.spent)}
              deltaDisplay=""
              chartData={insights?.series?.spend && insights.series.spend.length >= 2 ? insights.series.spend : [0, 0]}
              chartColor="red"
              empty={isMetaEmptyState}
              chartLabels={metaDates}
              chartTooltipValues={mFmtSpend}
              locale={metaLocale}
            />
            <DashboardKpiCard
              label={tMetrics('reach')}
              periodLabel={getDateRangeLabel()}
              value={fmtInt(campaignKpis.reach)}
              deltaDisplay=""
              chartData={insights?.series?.reach && insights.series.reach.length >= 2 ? insights.series.reach : [0, 0]}
              chartColor="green"
              empty={isMetaEmptyState}
              chartLabels={metaDates}
              chartTooltipValues={mFmtReach}
              locale={metaLocale}
            />
            <DashboardKpiCard
              label={tMetrics('impressions')}
              periodLabel={getDateRangeLabel()}
              value={fmtInt(campaignKpis.impressions)}
              deltaDisplay=""
              chartData={insights?.series?.impressions && insights.series.impressions.length >= 2 ? insights.series.impressions : [0, 0]}
              chartColor="green"
              empty={isMetaEmptyState}
              chartLabels={metaDates}
              chartTooltipValues={mFmtImpressions}
              locale={metaLocale}
            />
            <DashboardKpiCard
              label={tMetrics('engagement')}
              periodLabel={getDateRangeLabel()}
              value={fmtInt(campaignKpis.engagement)}
              deltaDisplay=""
              chartData={insights?.series?.spend && insights.series.spend.length >= 2 ? insights.series.spend : [0, 0]}
              chartColor="green"
              empty={isMetaEmptyState}
              chartLabels={metaDates}
              chartTooltipValues={mFmtSpend}
              locale={metaLocale}
            />
            <DashboardKpiCard
              label={tMetrics('clicks')}
              periodLabel={getDateRangeLabel()}
              value={fmtInt(campaignKpis.clicks)}
              deltaDisplay=""
              chartData={insights?.series?.clicks && insights.series.clicks.length >= 2 ? insights.series.clicks : [0, 0]}
              chartColor="green"
              empty={isMetaEmptyState}
              chartLabels={metaDates}
              chartTooltipValues={mFmtClicks}
              locale={metaLocale}
            />
          </div>
            )
          })()}

          {/* Rate Limit Error Banner */}
          {rateLimitError && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800 mb-1">
                  {rateLimitError.retryAfterMs
                    ? t('fetchErrors.rateLimitRetry', { seconds: Math.ceil(rateLimitError.retryAfterMs / 1000) })
                    : rateLimitError.message}
                </p>
                {rateLimitError.fbtrace_id && (
                  <p className="text-caption text-yellow-600">Trace ID: {rateLimitError.fbtrace_id}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setRateLimitedUntil(0)
                    setRateLimitError(null)
                    loadTabData(activeTab, true)
                  }}
                  className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  {t('fetchErrors.retryNow')}
                </button>
                <button
                  onClick={() => {
                    setRateLimitedUntil(0)
                    setRateLimitError(null)
                  }}
                  className="text-yellow-600 hover:text-yellow-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Disconnected / Expired / No-account — single AlertBanner in content area (same position as Google Ads) */}
          {(metaDisconnected || tokenExpired) && (
            <AlertBanner
              title={t('fetchErrors.notConnectedTitle')}
              description={t('fetchErrors.notConnectedHint')}
              onClose={() => { setMetaDisconnected(false); setTokenExpired(false); resetTokenExpiredFlag() }}
            >
              <a
                href="/api/meta/login"
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                onClick={() => { resetTokenExpiredFlag(); setMetaDisconnected(false); setTokenExpired(false) }}
              >
                {t('fetchErrors.connectMeta')}
              </a>
            </AlertBanner>
          )}
          {/* General Error Banner — only for non-auth errors */}
          {fetchError && !rateLimitError && !metaDisconnected && !tokenExpired && (
            <AlertBanner
              title={fetchErrorKey === 'errors.noAdAccount' ? t('errors.noAdAccount') : fetchError}
              description={fetchErrorKey === 'errors.noAdAccount' ? t('errors.noAdAccountDesc') : undefined}
              onClose={() => { setFetchError(null); setFetchErrorKey(null) }}
            >
              {fetchErrorKey === 'errors.noAdAccount' && (
                <a
                  href="/connect/meta"
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  {t('errors.connectAccount')}
                </a>
              )}
            </AlertBanner>
          )}

          {/* Performance Recommendations banner removed - now lazy-loaded only in Optimization section */}

          <div className="bg-white rounded-xl border border-gray-200">
            <Tabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
            {/* Unified toolbar: actions + search + filters in single row */}
            {(() => {
              // Multi-select: selectedIds array'i öncelikli, yoksa tek seçim
              const _singleSel = activeTab === 'kampanyalar' ? (selectedCampaignId ? campaigns.find(c => c.id === selectedCampaignId) : null)
                : activeTab === 'reklam-setleri' ? (selectedAdsetId ? adsets.find(a => a.id === selectedAdsetId) : null)
                : (selectedAdId ? ads.find(a => a.id === selectedAdId) : null)

              const _multiFirstId = selectedIds.length >= 1 ? selectedIds[0] : null
              const sel = _multiFirstId
                ? (activeTab === 'kampanyalar' ? campaigns.find(c => c.id === _multiFirstId)
                  : activeTab === 'reklam-setleri' ? filteredAdsets.find(a => a.id === _multiFirstId)
                  : filteredAds.find(a => a.id === _multiFirstId)) ?? _singleSel
                : _singleSel
              const hasSelection = !!sel || selectedIds.length > 0
              const isDuplicating = activeTab === 'kampanyalar' ? isDuplicatingCampaign : activeTab === 'reklam-setleri' ? isDuplicatingAdset : isDuplicatingAd

              const handleDuplicate = () => {
                if (!sel) return
                if (activeTab === 'kampanyalar') handleDuplicateCampaign(sel.id)
                else if (activeTab === 'reklam-setleri') handleDuplicateAdset(sel.id)
                else handleDuplicateAd(sel.id)
              }
              const handleDelete = () => {
                if (selectedIds.length > 1) {
                  const type = activeTab === 'kampanyalar' ? 'campaign' as const
                    : activeTab === 'reklam-setleri' ? 'adset' as const : 'ad' as const
                  setBulkDeleting({ ids: selectedIds, type })
                  return
                }
                const target = sel
                if (!target) return
                if (activeTab === 'kampanyalar') setDeletingCampaign({ id: target.id, name: target.name })
                else if (activeTab === 'reklam-setleri') setDeletingAdset({ id: target.id, name: target.name })
                else setDeletingAd({ id: target.id, name: target.name })
              }
              const handleEditAction = async () => {
                const targetId = selectedIds.length > 0 ? selectedIds[0] : sel?.id
                if (!targetId) return
                // Overlay açılmadan önce tüm data'yı yükle
                const loadPromises: Promise<void>[] = []
                if (adsets.length === 0) loadPromises.push(loadTabData('reklam-setleri'))
                if (ads.length === 0) loadPromises.push(loadTabData('reklamlar'))
                if (loadPromises.length > 0) await Promise.all(loadPromises)
                const item = activeTab === 'kampanyalar' ? campaigns.find(c => c.id === targetId)
                  : activeTab === 'reklam-setleri' ? filteredAdsets.find(a => a.id === targetId)
                  : filteredAds.find(a => a.id === targetId)
                if (!item) return
                if (activeTab === 'kampanyalar') setEditingCampaign({ id: item.id, name: item.name })
                else if (activeTab === 'reklam-setleri') setEditingAdset({ id: item.id, name: item.name, campaignId: (item as { campaignId?: string }).campaignId })
                else setEditingAd({ id: item.id, name: item.name, adsetId: (item as { adsetId?: string }).adsetId, campaignId: (item as { campaignId?: string }).campaignId })
              }
              const clearSelection = () => {
                if (activeTab === 'kampanyalar') { setSelectedCampaignId(null); setSelectedCampaignIds([]) }
                else if (activeTab === 'reklam-setleri') { setSelectedAdsetId(null); setSelectedAdsetIds([]) }
                else { setSelectedAdId(null); setSelectedAdIds([]) }
              }

              return (
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
                  {/* Action icons */}
                  <button onClick={() => triggerRefresh()} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors" title={t('toolbar.refresh')}>
                    <RefreshCw className={`w-4 h-4 transition-transform ${showTableShimmer ? 'animate-spin' : ''}`} />
                  </button>
                  <button onClick={handleEditAction} disabled={!hasSelection} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title={t('actions.edit')}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={handleDelete} disabled={!hasSelection} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title={t('actions.delete')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={handleDuplicate} disabled={!hasSelection || isDuplicating} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title={t('actions.duplicate')}>
                    <Copy className="w-4 h-4" />
                  </button>

                  {/* Search */}
                  <div className="relative ml-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder={t('toolbar.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 w-48 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-300 focus:border-green-300"
                    />
                  </div>

                  {/* Clear selection */}
                  {hasSelection && (
                    <button onClick={clearSelection} className="p-1 text-gray-400 hover:text-gray-600 transition-colors ml-1" title={t('actions.clearSelection')}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Show inactive */}
                  <button
                    onClick={() => setShowInactive(!showInactive)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      showInactive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {showInactive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {t('showInactive')}
                  </button>

                  {/* Date range picker */}
                  <DateRangePicker onDateChange={handleDateChange} locale={localeString === 'en-US' ? 'en' : 'tr'} />
                </div>
              )
            })()}

            {/* Adset filter context banner on reklamlar tab */}
            {selectedAdsetId && !selectedAdId && activeTab === 'reklamlar' && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm text-blue-700">
                <span className="text-blue-500">{t('actions.1adsetSelected')}</span>
                <button onClick={() => setSelectedAdsetId(null)} className="ml-auto text-blue-500 hover:text-blue-700 transition-colors">
                  × {t('actions.removeFilter')}
                </button>
              </div>
            )}

            {/* List panel: Real table only when status==="ready" (mount-level switch = no flicker) */}
            <TableShimmer isRefreshing={showTableShimmer}>
              {metaAccountStatus === 'ready' ? (
                <MetaTableReal
                  key={`meta-${selectedAdAccountId}-${refreshToken}`}
                  columns={tableColumns}
                  data={currentData}
                  activeTab={activeTab}
                  getRecommendationCount={getRecommendationCount}
                  loadingCampaignStatus={loadingCampaignStatus}
                  loadingAdSetStatus={loadingAdSetStatus}
                  loadingAdStatus={loadingAdStatus}
                  loadingCampaignBudget={loadingCampaignBudget}
                  onPublishToggle={handlePublishToggle}
                  displayOptScore={opportunityScore ?? lastGoodOpportunityScoreRef.current ?? null}
                  performanceRecommendations={performanceRecommendations}
                  recommendationsEnabled={recommendationsEnabled}
                  recsLoading={recsLoading}
                  onRecommendationClick={handleRecommendationClick}
                  t={t}
                  selectedCampaignId={selectedCampaignId}
                  onCampaignSelect={setSelectedCampaignId}
                  selectedAdsetId={selectedAdsetId}
                  onAdsetSelect={setSelectedAdsetId}
                  selectedAdId={selectedAdId}
                  onAdSelect={setSelectedAdId}
                  onEditBudgetAdset={handleEditBudgetClick}
                  onEditCampaignBudgetClick={handleEditCampaignBudgetClick}
                  localeString={localeString}
                  num={num}
                  fmtInt={fmtInt}
                  fmtFixed={fmtFixed}
                  isStatusToggleable={isStatusToggleable}
                  onDuplicate={() => {}}
                  onDelete={() => {}}
                  onEdit={() => {}}
                  selectedIds={selectedIds}
                  onSelectAll={(ids) => (setSelectedIds as React.Dispatch<React.SetStateAction<string[]>>)(ids)}
                  onDeselectAll={() => (setSelectedIds as React.Dispatch<React.SetStateAction<string[]>>)([])}
                  onRowSelect={(id: string, checked: boolean) => {
                    (setSelectedIds as React.Dispatch<React.SetStateAction<string[]>>)(prev =>
                      checked ? [...prev, id] : prev.filter(x => x !== id)
                    )
                  }}
                />
              ) : (
                <MetaTableSkeleton key="skeleton" columns={tableColumns} />
              )}
            </TableShimmer>
          </div>
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <MetaObjectiveSelector
        isOpen={showObjectiveSelector}
        onClose={() => setShowObjectiveSelector(false)}
        onSelectObjective={(obj) => {
          setShowObjectiveSelector(false)
          setSelectedObjective(obj)
          // Use CampaignWizard for all objectives (including Traffic)
          setShowCampaignWizard(true)
        }}
      />
      <TrafficWizard
        isOpen={showTrafficWizard}
        onClose={() => setShowTrafficWizard(false)}
      />
      <CampaignWizard
        isOpen={showCampaignWizard}
        onClose={() => setShowCampaignWizard(false)}
        onSuccess={() => { triggerRefresh(); setShowCampaignWizard(false) }}
        onToast={addToast}
        initialObjective={selectedObjective}
        capabilities={metaCapabilities}
      />
      <CampaignCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          triggerRefresh()
        }}
        onToast={(message, type) => addToast(message, type)}
      />

      {bulkDeleting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Toplu Silme</h3>
            <p className="text-sm text-gray-600 mb-6">
              {bulkDeleting.ids.length} öğeyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBulkDeleting(null)}
                disabled={isBulkDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                İptal
              </button>
              <button
                onClick={handleBulkDeleteConfirm}
                disabled={isBulkDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isBulkDeleting ? 'Siliniyor...' : `${bulkDeleting.ids.length} Öğeyi Sil`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Campaign Confirmation */}
      {deletingCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('deleteDialog.campaignTitle')}</h3>
            <p className="text-sm text-gray-600 mb-1">
              {t('deleteDialog.campaignConfirm', { name: deletingCampaign.name })}
            </p>
            <p className="text-sm text-red-600 mb-6">
              {t('deleteDialog.campaignWarning')}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingCampaign(null)}
                disabled={isDeletingCampaign}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 transition-colors"
              >
                {t('deleteDialog.cancel')}
              </button>
              <button
                onClick={handleDeleteCampaignConfirm}
                disabled={isDeletingCampaign}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {isDeletingCampaign ? t('deleteDialog.deleting') : t('deleteDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Ad Set Confirmation */}
      {deletingAdset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('deleteDialog.adsetTitle')}</h3>
            <p className="text-sm text-gray-600 mb-1">
              {t('deleteDialog.adsetConfirm', { name: deletingAdset.name })}
            </p>
            <p className="text-sm text-red-600 mb-6">
              {t('deleteDialog.adsetWarning')}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingAdset(null)}
                disabled={isDeletingAdset}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 transition-colors"
              >
                {t('deleteDialog.cancel')}
              </button>
              <button
                onClick={handleDeleteAdsetConfirm}
                disabled={isDeletingAdset}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {isDeletingAdset ? t('deleteDialog.deleting') : t('deleteDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Ad Confirmation */}
      {deletingAd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('deleteDialog.adTitle')}</h3>
            <p className="text-sm text-gray-600 mb-6">
              {t('deleteDialog.adConfirm', { name: deletingAd.name })}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingAd(null)}
                disabled={isDeletingAd}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 transition-colors"
              >
                {t('deleteDialog.cancel')}
              </button>
              <button
                onClick={handleDeleteAdConfirm}
                disabled={isDeletingAd}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {isDeletingAd ? t('deleteDialog.deleting') : t('deleteDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && (selectedCampaignForRename || selectedAdSetForRename || selectedAdForRename) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {renameType === 'campaign' ? (t('actions.renameCampaign') || 'Rename Campaign') :
               renameType === 'adset' ? (t('actions.renameAdSet') || 'Rename Ad Set') :
               (t('actions.renameAd') || 'Rename Ad')}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {renameType === 'campaign' ? (t('actions.campaignName') || 'Campaign Name') :
                 renameType === 'adset' ? (t('actions.adSetName') || 'Ad Set Name') :
                 (t('actions.adName') || 'Ad Name')}
              </label>
              <input
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder={
                  selectedCampaignForRename?.name || 
                  selectedAdSetForRename?.name || 
                  selectedAdForRename?.name || 
                  ''
                }
                maxLength={256}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleConfirmRename}
                disabled={
                  isRenaming || 
                  !renameInput.trim() || 
                  renameInput.trim() === (selectedCampaignForRename?.name || selectedAdSetForRename?.name || selectedAdForRename?.name || '')
                }
                className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRenaming ? t('actions.processing') : t('common.update')}
              </button>
              <button
                onClick={() => {
                  setShowRenameModal(false)
                  setSelectedCampaignForRename(null)
                  setSelectedAdSetForRename(null)
                  setSelectedAdForRename(null)
                  setRenameInput('')
                }}
                disabled={isRenaming}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Budget Confirm Modal */}
      {showEditBudgetModal && (selectedAdsetForBudget || selectedCampaignForBudget) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('common.editBudget')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedAdsetForBudget 
                ? t('common.updateBudgetDescriptionAdset', { name: selectedAdsetForBudget.name })
                : t('common.updateBudgetDescriptionCampaign', { name: selectedCampaignForBudget?.name || '' })
              }
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('common.budgetType')}
              </label>
              <select
                value={budgetEditType}
                onChange={(e) => setBudgetEditType(e.target.value as 'daily' | 'lifetime')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
              >
                <option value="daily">{t('common.dailyBudget')}</option>
                <option value="lifetime">{t('common.lifetimeBudget')}</option>
              </select>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('common.newBudget')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={budgetEditInput}
                onChange={(e) => setBudgetEditInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder={t('recommendations.budgetPlaceholder')}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleConfirmBudgetEdit}
                disabled={(isUpdatingAdsetBudget || isUpdatingCampaignBudget) || !budgetEditInput || parseFloat(budgetEditInput) <= 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(isUpdatingAdsetBudget || isUpdatingCampaignBudget) ? t('common.updating') : t('common.update')}
              </button>
              <button
                onClick={() => {
                  setShowEditBudgetModal(false)
                  setSelectedAdsetForBudget(null)
                  setSelectedCampaignForBudget(null)
                  setBudgetEditInput('')
                }}
                disabled={isUpdatingAdsetBudget || isUpdatingCampaignBudget}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Budget Update Modal */}
      {showBudgetModal && selectedEntity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('recommendations.updateBudget')}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('recommendations.newBudget')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder={t('recommendations.budgetPlaceholder')}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleBudgetUpdate}
                disabled={isUpdatingBudget || !budgetInput || parseFloat(budgetInput) <= 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingBudget ? t('recommendations.updating') : t('recommendations.update')}
              </button>
              <button
                onClick={() => {
                  setShowBudgetModal(false)
                  setBudgetInput('')
                  setSelectedRec(null)
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
              >
                {t('recommendations.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations Panel */}
      {recommendationsEnabled && isRecPanelOpen && selectedEntity && (
        <div className="fixed right-0 top-0 h-full w-full max-w-[420px] bg-white shadow-2xl z-50 overflow-y-auto" style={{ pointerEvents: 'auto' }}>
          <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedEntity.name} - {t('recommendations.title')}
            </h2>
            <button
              onClick={() => {
                setIsRecPanelOpen(false)
                setSelectedEntity(null)
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          <div className="p-6">
            {getEntityRecommendations().length === 0 ? (
              <p className="text-gray-400 text-sm">{t('recommendations.noRecommendations')}</p>
            ) : (
              <div className="space-y-4">
                {getEntityRecommendations().map((rec, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">{getRecommendationTypeLabel(rec.type)}</h4>
                    {rec.description && (
                      <p className="text-sm text-gray-600 mb-3">{rec.description}</p>
                    )}
                    <div className="flex items-center gap-4 mb-4 text-caption text-gray-500">
                      {rec.impact && (
                        <span>Etki: {rec.impact}</span>
                      )}
                      {rec.points !== null && (
                        <span>Puan: {rec.points}</span>
                      )}
                    </div>
                    {(rec.type === 'BUDGET_LIMITED' || rec.type === 'SCALE_GOOD_CAMPAIGN' || rec.type === 'CTX_CREATION_PACKAGE') ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApplyRecommendation(rec)}
                          className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors border-2 border-green-600 border-glow-animate"
                        >
                          {t('recommendations.apply')}
                        </button>
                        <button
                          onClick={() => {
                            setIsRecPanelOpen(false)
                            setSelectedEntity(null)
                          }}
                          className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                        >
                          {t('recommendations.later')}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-caption text-gray-500">
                          {t('recommendations.autoNotAvailable')}
                        </p>
                        <button
                          onClick={() => {
                            setIsRecPanelOpen(false)
                            setSelectedEntity(null)
                          }}
                          className="w-full px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                        >
                          {t('recommendations.later')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Campaign Edit Overlay */}
      {editingCampaign && (
        <CampaignEditOverlay
          campaignId={editingCampaign.id}
          campaignName={editingCampaign.name}
          open={!!editingCampaign}
          onClose={() => setEditingCampaign(null)}
          onSuccess={() => { triggerRefresh(); setEditingCampaign(null) }}
          onToast={addToast}
          campaigns={treeData.campaigns}
          adsets={treeData.adsets}
          highlightedIds={selectedIds.length > 1 ? selectedIds : undefined}
          ads={treeData.ads}
          onEntitySelect={handleEntitySelect}
        />
      )}

      {/* Adset Edit Overlay */}
      {editingAdset && (
        <AdsetEditDrawer
          adsetId={editingAdset.id}
          adsetName={editingAdset.name}
          relatedCampaignId={editingAdset.campaignId}
          open={!!editingAdset}
          onClose={() => setEditingAdset(null)}
          onSuccess={() => { triggerRefresh(); setEditingAdset(null) }}
          onToast={addToast}
          campaigns={treeData.campaigns}
          adsets={treeData.adsets}
          highlightedIds={selectedIds.length > 1 ? selectedIds : undefined}
          ads={treeData.ads}
          onEntitySelect={handleEntitySelect}
        />
      )}

      {/* Ad Edit Overlay */}
      {editingAd && (
        <AdEditDrawer
          adId={editingAd.id}
          adName={editingAd.name}
          relatedCampaignId={editingAd.campaignId}
          open={!!editingAd}
          onClose={() => setEditingAd(null)}
          highlightedIds={selectedIds.length > 1 ? selectedIds : undefined}
          onSuccess={(data) => {
            if (data?.adId && data?.name) {
              setAds(prev => prev.map(a => a.id === data!.adId ? { ...a, name: data.name } : a))
            }
            setEditingAd(null)
            setTimeout(() => loadTabData('reklamlar', true), 10_000)
          }}
          onToast={addToast}
          campaigns={treeData.campaigns}
          adsets={treeData.adsets}
          ads={treeData.ads}
          onEntitySelect={handleEntitySelect}
        />
      )}
    </>
  )
}
