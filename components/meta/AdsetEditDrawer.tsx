'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Loader2, Search, MapPin, Target } from 'lucide-react'
import { getWizardTranslations, getLocaleFromCookie } from '@/lib/i18n/wizardTranslations'
import MetaEditOverlay from './MetaEditOverlay'
import type { TreeCampaign, TreeAdset, TreeAd } from './CampaignTreeSidebar'

interface AdsetEditDrawerProps {
  adsetId: string
  adsetName: string
  relatedCampaignId?: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
  campaigns: TreeCampaign[]
  adsets: TreeAdset[]
  ads: TreeAd[]
  onEntitySelect: (type: 'campaign' | 'adset' | 'ad', id: string, name: string) => void
  highlightedIds?: string[]
}

interface LocationResult {
  key: string
  name: string
  type: string
  country_code: string
  country_name: string
}

// Map ISO country codes to readable names (used when API returns only codes)
const COUNTRY_NAMES: Record<string, string> = {
  TR: 'Türkiye', US: 'ABD', GB: 'Birleşik Krallık', DE: 'Almanya', FR: 'Fransa',
  IT: 'İtalya', ES: 'İspanya', NL: 'Hollanda', BE: 'Belçika', AT: 'Avusturya',
  CH: 'İsviçre', SE: 'İsveç', NO: 'Norveç', DK: 'Danimarka', FI: 'Finlandiya',
  PL: 'Polonya', CZ: 'Çekya', RO: 'Romanya', BG: 'Bulgaristan', GR: 'Yunanistan',
  PT: 'Portekiz', IE: 'İrlanda', RU: 'Rusya', UA: 'Ukrayna', JP: 'Japonya',
  CN: 'Çin', KR: 'Güney Kore', IN: 'Hindistan', BR: 'Brezilya', MX: 'Meksika',
  CA: 'Kanada', AU: 'Avustralya', NZ: 'Yeni Zelanda', AE: 'BAE', SA: 'Suudi Arabistan',
  EG: 'Mısır', ZA: 'Güney Afrika', AR: 'Arjantin', CL: 'Şili', CO: 'Kolombiya',
  AZ: 'Azerbaycan', GE: 'Gürcistan', IL: 'İsrail', IQ: 'Irak', IR: 'İran',
  SY: 'Suriye', LB: 'Lübnan', JO: 'Ürdün', KZ: 'Kazakistan', UZ: 'Özbekistan',
  TM: 'Türkmenistan', KG: 'Kırgızistan', PK: 'Pakistan', AF: 'Afganistan',
}

interface InterestResult {
  id: string
  name: string
  audience_size_lower_bound?: number
  audience_size_upper_bound?: number
  path?: string[]
}

const OPTIMIZATION_GOAL_VALUES = [
  'LINK_CLICKS', 'IMPRESSIONS', 'REACH', 'LANDING_PAGE_VIEWS',
  'OFFSITE_CONVERSIONS', 'POST_ENGAGEMENT', 'THRUPLAY', 'LEAD_GENERATION',
]

export default function AdsetEditDrawer({ adsetId, adsetName, relatedCampaignId, open, onClose, onSuccess, onToast, campaigns, adsets, ads, onEntitySelect, highlightedIds }: AdsetEditDrawerProps) {
  const locale = getLocaleFromCookie()
  const t = getWizardTranslations(locale)
  const metaLocale = locale === 'en' ? 'en_US' : 'tr_TR'
  const OPTIMIZATION_GOALS = OPTIMIZATION_GOAL_VALUES.map((value) => ({
    value,
    label: (t[value as keyof typeof t] as string) ?? value,
  }))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [budgetType, setBudgetType] = useState<'daily' | 'lifetime'>('daily')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [ageMin, setAgeMin] = useState(18)
  const [ageMax, setAgeMax] = useState(65)
  const [genders, setGenders] = useState<number[]>([])
  const [countries, setCountries] = useState<{ key: string; name: string; type: string }[]>([])
  const [interests, setInterests] = useState<{ id: string; name: string; category: string }[]>([])
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [optimizationGoal, setOptimizationGoal] = useState('')
  const [originalOptimizationGoal, setOriginalOptimizationGoal] = useState('')
  const [accountCurrency, setAccountCurrency] = useState<string>('')
  const [fxRate, setFxRate] = useState<number | null>(null)
  const [fxLoading, setFxLoading] = useState(false)
  // Store the original targeting object from Meta so we can merge user changes on top
  const [originalTargeting, setOriginalTargeting] = useState<Record<string, unknown>>({})
  // Track original targeting values to detect actual changes (avoids triggering Meta re-review)
  const [originalAgeMin, setOriginalAgeMin] = useState(18)
  const [originalAgeMax, setOriginalAgeMax] = useState(65)
  const [originalGenders, setOriginalGenders] = useState<number[]>([])
  const [originalCountryKeys, setOriginalCountryKeys] = useState<string[]>([])
  const [originalInterestIds, setOriginalInterestIds] = useState<string[]>([])
  // Store raw adCurrency budget from Meta to convert to TRY when fxRate is available
  const [rawBudgetAdCurrency, setRawBudgetAdCurrency] = useState<number | null>(null)
  const [rawBudgetConverted, setRawBudgetConverted] = useState(false)

  // Autocomplete state
  const [locationQuery, setLocationQuery] = useState('')
  const [locationResults, setLocationResults] = useState<LocationResult[]>([])
  const [locationSearching, setLocationSearching] = useState(false)
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const [interestQuery, setInterestQuery] = useState('')
  const [interestResults, setInterestResults] = useState<InterestResult[]>([])
  const [interestSearching, setInterestSearching] = useState(false)
  const [showInterestDropdown, setShowInterestDropdown] = useState(false)
  const [interestTab, setInterestTab] = useState<'search' | 'browse'>('search')
  const [browseData, setBrowseData] = useState<InterestResult[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseFetched, setBrowseFetched] = useState(false)

  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Placements state (real Meta API fields)
  const [publisherPlatforms, setPublisherPlatforms] = useState<string[]>([])
  const [facebookPositions, setFacebookPositions] = useState<string[]>([])
  const [instagramPositions, setInstagramPositions] = useState<string[]>([])
  const [messengerPositions, setMessengerPositions] = useState<string[]>([])
  const [audienceNetworkPositions, setAudienceNetworkPositions] = useState<string[]>([])
  const [originalPublisherPlatforms, setOriginalPublisherPlatforms] = useState<string[]>([])
  const [originalFacebookPositions, setOriginalFacebookPositions] = useState<string[]>([])
  const [originalInstagramPositions, setOriginalInstagramPositions] = useState<string[]>([])
  const [originalMessengerPositions, setOriginalMessengerPositions] = useState<string[]>([])
  const [originalAudienceNetworkPositions, setOriginalAudienceNetworkPositions] = useState<string[]>([])
  // Placement mode: 'advantage' (Meta decides) or 'manual' (user picks)
  const [placementMode, setPlacementMode] = useState<'advantage' | 'manual'>('manual')
  // Active platform tab for placements
  const [activePlacementPlatform, setActivePlacementPlatform] = useState<'facebook' | 'instagram' | 'audience_network' | 'messenger'>('facebook')

  // Auto-select first available platform tab when publisher platforms change
  useEffect(() => {
    const platformOrder: Array<'facebook' | 'instagram' | 'audience_network' | 'messenger'> = ['facebook', 'instagram', 'audience_network', 'messenger']
    if (publisherPlatforms.length > 0 && !publisherPlatforms.includes(activePlacementPlatform)) {
      const first = platformOrder.find(p => publisherPlatforms.includes(p))
      if (first) setActivePlacementPlatform(first)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publisherPlatforms])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch('/api/meta/ad-account-currency')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.ok && typeof data.currency === 'string') setAccountCurrency(data.currency)
        else if (!cancelled) setAccountCurrency('')
      })
      .catch(() => { if (!cancelled) setAccountCurrency('') })
    return () => { cancelled = true }
  }, [open])

  // Fetch FX rate when accountCurrency changes
  useEffect(() => {
    if (!accountCurrency) { setFxRate(null); return }
    if (accountCurrency === 'TRY') { setFxRate(1); return }
    let cancelled = false
    setFxLoading(true)
    fetch(`/api/fx?base=${encodeURIComponent(accountCurrency)}&quote=TRY`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.ok && typeof data.rate === 'number' && data.rate > 0) setFxRate(data.rate)
        else setFxRate(null)
      })
      .catch(() => { if (!cancelled) setFxRate(null) })
      .finally(() => { if (!cancelled) setFxLoading(false) })
    return () => { cancelled = true }
  }, [accountCurrency])

  // Convert raw adCurrency budget to TRY when fxRate becomes available
  useEffect(() => {
    if (rawBudgetAdCurrency != null && fxRate != null && !rawBudgetConverted) {
      const tryVal = Math.round(rawBudgetAdCurrency * fxRate * 100) / 100
      setBudgetAmount(String(tryVal))
      setRawBudgetConverted(true)
    }
  }, [rawBudgetAdCurrency, fxRate, rawBudgetConverted])

  // Fetch adset details on mount
  useEffect(() => {
    if (!open || !adsetId) return
    let cancelled = false

    const fetchDetails = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/meta/adsets/details?adsetId=${adsetId}`)
        const json = await res.json()
        if (!json.ok || cancelled) return

        const d = json.data
        setName(d.name || '')

        // Budget: Meta returns minor units in adCurrency. Store raw (main unit) for TRY conversion.
        if (d.daily_budget) {
          setBudgetType('daily')
          const mainUnit = Number(d.daily_budget) / 100
          setRawBudgetAdCurrency(mainUnit)
          setRawBudgetConverted(false)
        } else if (d.lifetime_budget) {
          setBudgetType('lifetime')
          const mainUnit = Number(d.lifetime_budget) / 100
          setRawBudgetAdCurrency(mainUnit)
          setRawBudgetConverted(false)
        }

        const t = d.targeting || {}

        console.log('[AdsetEditDrawer] Full targeting object:', JSON.stringify(t, null, 2))
        setOriginalTargeting(t)

        if (t.age_min) { const clamped = Math.max(18, t.age_min); setAgeMin(clamped); setOriginalAgeMin(clamped) }
        if (t.age_max) { const clamped = Math.max(18, t.age_max); setAgeMax(clamped); setOriginalAgeMax(clamped) }
        if (t.genders && Array.isArray(t.genders)) { setGenders(t.genders); setOriginalGenders(t.genders) }

        // Locations - handle all geo_locations types (preserve type for correct API payload)
        const geo = t.geo_locations
        if (geo) {
          const allLocations: { key: string; name: string; type: string }[] = []
          if (Array.isArray(geo.countries)) {
            geo.countries.forEach((c: string) => allLocations.push({ key: c, name: COUNTRY_NAMES[c] || c, type: 'country' }))
          }
          if (Array.isArray(geo.regions)) {
            geo.regions.forEach((r: { key: string; name?: string }) => allLocations.push({ key: r.key, name: r.name || r.key, type: 'region' }))
          }
          if (Array.isArray(geo.cities)) {
            geo.cities.forEach((c: { key: string; name?: string }) => allLocations.push({ key: c.key, name: c.name || c.key, type: 'city' }))
          }
          if (Array.isArray(geo.zips)) {
            geo.zips.forEach((z: { key: string; name?: string }) => allLocations.push({ key: z.key, name: z.name || z.key, type: 'zip' }))
          }
          if (Array.isArray(geo.geo_markets)) {
            geo.geo_markets.forEach((m: { key: string; name?: string }) => allLocations.push({ key: m.key, name: m.name || m.key, type: 'geo_market' }))
          }
          if (allLocations.length > 0) {
            setCountries(allLocations)
            setOriginalCountryKeys(allLocations.map(l => l.key))
          }
        }

        // Interests - check both direct and flexible_spec (preserve category for correct API payload)
        const allInterests: { id: string; name: string; category: string }[] = []
        if (Array.isArray(t.interests)) {
          t.interests.forEach((int: { id: string; name: string }) => {
            if (int.id && int.name) allInterests.push({ id: int.id, name: int.name, category: 'interests' })
          })
        }
        if (Array.isArray(t.flexible_spec)) {
          for (const spec of t.flexible_spec) {
            const categoryMap: [string, unknown][] = [
              ['interests', spec.interests],
              ['behaviors', spec.behaviors],
              ['work_positions', spec.work_positions],
              ['industries', spec.industries],
            ]
            for (const [category, source] of categoryMap) {
              if (Array.isArray(source)) {
                for (const item of source as Array<{ id: string; name: string }>) {
                  if (item.id && item.name && !allInterests.find(i => i.id === item.id)) {
                    allInterests.push({ id: item.id, name: item.name, category })
                  }
                }
              }
            }
          }
        }
        if (allInterests.length > 0) {
          setInterests(allInterests)
          setOriginalInterestIds(allInterests.map(i => i.id))
        }

        // Schedule
        if (d.start_time) {
          setStartTime(toLocalDatetime(d.start_time))
        }
        if (d.end_time) {
          setEndTime(toLocalDatetime(d.end_time))
        }

        setOptimizationGoal(d.optimization_goal || '')
        setOriginalOptimizationGoal(d.optimization_goal || '')

        // Placements
        if (Array.isArray(t.publisher_platforms)) {
          setPublisherPlatforms(t.publisher_platforms)
          setOriginalPublisherPlatforms(t.publisher_platforms)
        }
        if (Array.isArray(t.facebook_positions)) {
          setFacebookPositions(t.facebook_positions)
          setOriginalFacebookPositions(t.facebook_positions)
        }
        if (Array.isArray(t.instagram_positions)) {
          setInstagramPositions(t.instagram_positions)
          setOriginalInstagramPositions(t.instagram_positions)
        }
        if (Array.isArray(t.messenger_positions)) {
          setMessengerPositions(t.messenger_positions)
          setOriginalMessengerPositions(t.messenger_positions)
        }
        if (Array.isArray(t.audience_network_positions)) {
          setAudienceNetworkPositions(t.audience_network_positions)
          setOriginalAudienceNetworkPositions(t.audience_network_positions)
        }
        // Detect placement mode
        if (!t.publisher_platforms && !t.facebook_positions && !t.instagram_positions && !t.messenger_positions && !t.audience_network_positions) {
          setPlacementMode('advantage')
        } else {
          setPlacementMode('manual')
        }
      } catch (err) {
        console.error('AdSet details fetch error:', err)
        onToast('Reklam seti bilgileri alınamadı', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchDetails()
    return () => { cancelled = true }
  }, [adsetId, open, onToast])

  // Location search
  const searchLocations = useCallback(async (query: string) => {
    if (query.length < 2) {
      setLocationResults([])
      setShowLocationDropdown(false)
      return
    }
    setLocationSearching(true)
    try {
      const res = await fetch(`/api/meta/targeting/locations?q=${encodeURIComponent(query)}`)
      const json = await res.json()
      if (json.ok && json.data) {
        setLocationResults(json.data)
        setShowLocationDropdown(true)
      }
    } catch {
      // Silently fail
    } finally {
      setLocationSearching(false)
    }
  }, [])

  const handleLocationQueryChange = (val: string) => {
    setLocationQuery(val)
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current)
    locationDebounceRef.current = setTimeout(() => searchLocations(val), 200)
  }

  const addLocation = (loc: LocationResult) => {
    if (countries.find(c => c.key === loc.key)) {
      setLocationQuery('')
      setShowLocationDropdown(false)
      return
    }
    setCountries(prev => {
      let next = [...prev, { key: loc.key, name: loc.name, type: loc.type }]
      // Meta Ads logic: when adding a city/region, auto-remove the parent country
      if (loc.type === 'city' || loc.type === 'region' || loc.type === 'zip') {
        const parentCode = loc.country_code
        if (parentCode) {
          next = next.filter(c => !(c.type === 'country' && c.key === parentCode))
        }
      }
      return next
    })
    setLocationQuery('')
    setShowLocationDropdown(false)
  }

  const removeLocation = (key: string) => {
    setCountries(prev => prev.filter(c => c.key !== key))
  }

  // Interest search
  const searchInterests = useCallback(async (query: string) => {
    if (query.length < 2) {
      setInterestResults([])
      setShowInterestDropdown(false)
      return
    }
    setInterestSearching(true)
    try {
      const res = await fetch(`/api/meta/targeting/interests?q=${encodeURIComponent(query)}&locale=${metaLocale}`)
      const json = await res.json()
      if (json.ok && json.data) {
        setInterestResults(json.data)
        setShowInterestDropdown(true)
      }
    } catch {
      // Silently fail
    } finally {
      setInterestSearching(false)
    }
  }, [])

  const handleInterestQueryChange = (val: string) => {
    setInterestQuery(val)
    if (interestDebounceRef.current) clearTimeout(interestDebounceRef.current)
    interestDebounceRef.current = setTimeout(() => searchInterests(val), 200)
  }

  const addInterest = (int: InterestResult) => {
    if (!interests.find(i => i.id === int.id)) {
      setInterests(prev => [...prev, { id: int.id, name: int.name, category: 'interests' }])
    }
    setInterestQuery('')
    setShowInterestDropdown(false)
  }

  const removeInterest = (id: string) => {
    setInterests(prev => prev.filter(i => i.id !== id))
  }

  // Pre-fetch browse data on mount
  useEffect(() => {
    if (browseFetched) return
    const fetchBrowse = async () => {
      setBrowseLoading(true)
      try {
        const res = await fetch('/api/meta/targeting/browse')
        const json = await res.json()
        if (json.ok && Array.isArray(json.data)) {
          setBrowseData(json.data)
        }
      } catch { /* silently fail */ }
      setBrowseLoading(false)
      setBrowseFetched(true)
    }
    fetchBrowse()
  }, [browseFetched])

  // Save handler
  const handleSave = async () => {
    setSaving(true)
    try {
      // Detect if targeting has actually changed to avoid triggering Meta re-review
      const currentCountryKeys = countries.map(c => c.key).sort()
      const currentInterestIds = interests.map(i => i.id).sort()
      const placementsChanged =
        JSON.stringify([...publisherPlatforms].sort()) !== JSON.stringify([...originalPublisherPlatforms].sort()) ||
        JSON.stringify([...facebookPositions].sort()) !== JSON.stringify([...originalFacebookPositions].sort()) ||
        JSON.stringify([...instagramPositions].sort()) !== JSON.stringify([...originalInstagramPositions].sort()) ||
        JSON.stringify([...messengerPositions].sort()) !== JSON.stringify([...originalMessengerPositions].sort()) ||
        JSON.stringify([...audienceNetworkPositions].sort()) !== JSON.stringify([...originalAudienceNetworkPositions].sort())

      const targetingChanged =
        ageMin !== originalAgeMin ||
        ageMax !== originalAgeMax ||
        JSON.stringify([...genders].sort()) !== JSON.stringify([...originalGenders].sort()) ||
        JSON.stringify(currentCountryKeys) !== JSON.stringify([...originalCountryKeys].sort()) ||
        JSON.stringify(currentInterestIds) !== JSON.stringify([...originalInterestIds].sort()) ||
        placementsChanged

      // Build targeting from scratch — ONLY include writable fields we manage.
      // Cloning the entire original targeting causes "Invalid parameter" errors
      // because Meta returns many read-only/deprecated fields in GET responses.
      const targeting: Record<string, unknown> = {}

      // Age
      targeting.age_min = ageMin
      targeting.age_max = ageMax

      // Genders
      if (genders.length > 0) {
        targeting.genders = genders
      }

      // Geo locations: build from UI state, keep original location_types
      const origGeo = (originalTargeting.geo_locations || {}) as Record<string, unknown>

      const cleanCity = (orig: Record<string, unknown>) => {
        const clean: Record<string, unknown> = { key: String(orig.key) }
        if (orig.radius != null) clean.radius = orig.radius
        if (orig.distance_unit != null) clean.distance_unit = orig.distance_unit
        return clean
      }
      const getOrig = (arr: unknown, key: string): Record<string, unknown> | undefined => {
        if (!Array.isArray(arr)) return undefined
        return arr.find((item: Record<string, unknown>) => String(item.key) === key)
      }

      const userCountries = countries.filter(c => c.type === 'country')
      const userCities = countries.filter(c => c.type === 'city')
      const userRegions = countries.filter(c => c.type === 'region')
      const userZips = countries.filter(c => c.type === 'zip')
      const userGeoMarkets = countries.filter(c => c.type === 'geo_market')

      const geo: Record<string, unknown> = {}
      // Preserve location_types from original (e.g. ["home", "recent"])
      if (origGeo.location_types) geo.location_types = origGeo.location_types

      if (userCountries.length > 0) geo.countries = userCountries.map(c => c.key)
      if (userCities.length > 0) {
        geo.cities = userCities.map(c => {
          const orig = getOrig(origGeo.cities, c.key)
          return orig ? cleanCity(orig) : { key: c.key }
        })
      }
      if (userRegions.length > 0) geo.regions = userRegions.map(c => ({ key: c.key }))
      if (userZips.length > 0) geo.zips = userZips.map(c => ({ key: c.key }))
      if (userGeoMarkets.length > 0) geo.geo_markets = userGeoMarkets.map(c => ({ key: c.key }))

      targeting.geo_locations = geo

      // Excluded geo: keep original if exists
      if (originalTargeting.excluded_geo_locations) {
        targeting.excluded_geo_locations = originalTargeting.excluded_geo_locations
      }

      // Flexible spec (interests/behaviors): rebuild from UI state
      if (interests.length > 0) {
        const spec: Record<string, Array<{ id: string; name: string }>> = {}
        for (const item of interests) {
          const cat = item.category || 'interests'
          if (!spec[cat]) spec[cat] = []
          spec[cat].push({ id: item.id, name: item.name })
        }
        targeting.flexible_spec = [spec]
      }

      // Custom audiences: preserve from original
      if (originalTargeting.custom_audiences) {
        targeting.custom_audiences = originalTargeting.custom_audiences
      }
      if (originalTargeting.excluded_custom_audiences) {
        targeting.excluded_custom_audiences = originalTargeting.excluded_custom_audiences
      }

      // Locales: preserve from original
      if (originalTargeting.locales) {
        targeting.locales = originalTargeting.locales
      }

      // Device platforms: preserve from original
      if (originalTargeting.device_platforms) {
        targeting.device_platforms = originalTargeting.device_platforms
      }

      // Placements
      if (placementMode === 'manual') {
        if (publisherPlatforms.length > 0) {
          targeting.publisher_platforms = publisherPlatforms
        }
        if (publisherPlatforms.includes('facebook') && facebookPositions.length > 0) {
          targeting.facebook_positions = facebookPositions
        }
        if (publisherPlatforms.includes('instagram') && instagramPositions.length > 0) {
          targeting.instagram_positions = instagramPositions
        }
        if (publisherPlatforms.includes('messenger') && messengerPositions.length > 0) {
          targeting.messenger_positions = messengerPositions
        }
        if (publisherPlatforms.includes('audience_network') && audienceNetworkPositions.length > 0) {
          targeting.audience_network_positions = audienceNetworkPositions
        }
      }
      // Advantage+ mode: don't include any placement fields (Meta auto-optimizes)

      if (targetingChanged) {
        console.log('[AdsetEditDrawer] Targeting changed, sending to Meta:', JSON.stringify(targeting, null, 2))
      } else {
        console.log('[AdsetEditDrawer] Targeting unchanged, skipping to avoid Meta re-review')
      }

      const payload: Record<string, unknown> = {
        adsetId,
        name: name.trim(),
        // Only send targeting if it actually changed — sending unchanged targeting triggers
        // a Meta re-review which temporarily pauses all child ads
        ...(targetingChanged ? { targeting } : {}),
        // Only send optimizationGoal if it actually changed
        optimizationGoal: optimizationGoal && optimizationGoal !== originalOptimizationGoal ? optimizationGoal : undefined,
      }

      // Budget: user enters TRY, convert to adCurrency for API
      const effectiveFxRate = fxRate || 1
      const budgetNumTRY = Number(budgetAmount)
      const budgetAd = budgetNumTRY > 0 ? budgetNumTRY / effectiveFxRate : 0
      if (budgetType === 'daily' && budgetAd > 0) {
        payload.dailyBudget = budgetAd
      } else if (budgetType === 'lifetime' && budgetAd > 0) {
        payload.lifetimeBudget = budgetAd
      }

      // Schedule: only send endTime (startTime cannot be changed on active adsets)
      if (endTime) {
        payload.endTime = new Date(endTime).toISOString()
      }

      const res = await fetch('/api/meta/adsets/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!json.ok) {
        const detail = json.subcode ? ` (code: ${json.code}, subcode: ${json.subcode})` : ''
        throw new Error((json.message || 'Güncelleme başarısız') + detail)
      }

      onToast('Reklam seti başarıyla güncellendi', 'success')
      onSuccess()
    } catch (err) {
      console.error('AdSet update error:', err)
      onToast(err instanceof Error ? err.message : 'Güncelleme başarısız', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <MetaEditOverlay
      open={open}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveDisabled={!name.trim() || (accountCurrency !== 'TRY' && !fxRate)}
      title={t.adsetEditTitle}
      subtitle="Reklam setini buradan düzenleyebilirsiniz."
      campaigns={campaigns}
      adsets={adsets}
      ads={ads}
      editingEntity={{ type: 'adset', id: adsetId }}
      relatedCampaignId={relatedCampaignId}
      onEntitySelect={onEntitySelect}
      highlightedIds={highlightedIds}
    >
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-8 p-8">
            {/* ═══════ LEFT COLUMN ═══════ */}
            <div className="col-span-2 space-y-6">
              {/* Reklam Seti Adı */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Reklam Seti Adı</h3>
                <p className="text-sm text-gray-500 mt-1 mb-3">Reklam setinize bir isim verin.</p>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  maxLength={256}
                  placeholder="Reklam seti adı..."
                />
              </div>

              {/* ── Hedef Kitle ── */}
              <div className="border border-gray-200 rounded-xl bg-white">
                <div className="px-5 pt-5 pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Target className="w-5 h-5 text-gray-600" />
                    Hedef Kitle
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Reklamlarınızın kimler tarafından görüleceğini belirleyin.</p>
                </div>
                <div className="px-5 pb-5 space-y-4">
                  {/* Yaş Aralığı */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {t.ageRange}: {ageMin} - {ageMax === 65 ? '65+' : ageMax}
                    </label>
                    <div className="flex items-center gap-3">
                      <input type="range" min={18} max={65} value={ageMin}
                        onChange={(e) => { const v = Math.max(18, Number(e.target.value)); if (v < ageMax) setAgeMin(v) }}
                        className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600" />
                      <input type="range" min={18} max={65} value={ageMax}
                        onChange={(e) => { const v = Math.max(18, Number(e.target.value)); if (v > ageMin) setAgeMax(v) }}
                        className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600" />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                      <span>18</span><span>65+</span>
                    </div>
                  </div>

                  {/* Cinsiyet */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">{t.gender}</label>
                    <select
                      value={genders.length === 0 ? 'all' : genders.length === 1 && genders[0] === 1 ? 'male' : genders.length === 1 && genders[0] === 2 ? 'female' : 'all'}
                      onChange={(e) => {
                        const v = e.target.value
                        if (v === 'male') setGenders([1])
                        else if (v === 'female') setGenders([2])
                        else setGenders([])
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm"
                    >
                      <option value="all">{t.genderAll}</option>
                      <option value="male">{t.genderMale}</option>
                      <option value="female">{t.genderFemale}</option>
                    </select>
                  </div>

                  {/* Konumlar */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      <MapPin className="w-3.5 h-3.5 inline mr-1" />{t.locationsLabel}
                    </label>
                    {countries.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {countries.map(c => (
                          <span key={c.key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                            {c.name}
                            <button onClick={() => removeLocation(c.key)} className="hover:text-blue-900"><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input type="text" value={locationQuery}
                        onChange={(e) => handleLocationQueryChange(e.target.value)}
                        onFocus={() => { if (locationResults.length > 0) setShowLocationDropdown(true) }}
                        onBlur={() => setTimeout(() => setShowLocationDropdown(false), 200)}
                        placeholder="Ülke veya şehir ara..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm" />
                      {locationSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />}
                    </div>
                    {showLocationDropdown && locationResults.length > 0 && (
                      <div data-ignore-close className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[200] max-h-48 overflow-y-auto">
                        {locationResults.map(loc => (
                          <button key={loc.key} onMouseDown={() => addLocation(loc)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between">
                            <span>{loc.name}</span>
                            <span className="text-xs text-gray-400">{loc.type}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* İlgi Alanları */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-600 mb-1">{t.interestsLabel}</label>
                    {interests.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {interests.map(int => (
                          <span key={int.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-caption rounded-full">
                            {int.name}
                            <button onClick={() => removeInterest(int.id)} className="hover:text-purple-900"><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Arama / Gözat tabs */}
                    <div className="flex border-b border-gray-200 mb-2">
                      <button type="button" onClick={() => setInterestTab('search')}
                        className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${interestTab === 'search' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        Arama
                      </button>
                      <button type="button" onClick={() => setInterestTab('browse')}
                        className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${interestTab === 'browse' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        Gözat
                      </button>
                    </div>

                    {interestTab === 'search' && (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <input type="text" value={interestQuery}
                            onChange={(e) => handleInterestQueryChange(e.target.value)}
                            onFocus={() => { if (interestResults.length > 0) setShowInterestDropdown(true) }}
                            onBlur={() => setTimeout(() => setShowInterestDropdown(false), 200)}
                            placeholder="İlgi alanı ara..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                          {interestSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />}
                        </div>
                        {showInterestDropdown && interestResults.length > 0 && (
                          <div data-ignore-close className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[200] max-h-48 overflow-y-auto">
                            {interestResults.map(int => (
                              <button key={int.id} onMouseDown={() => addInterest(int)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between">
                                <div>
                                  <span>{int.name}</span>
                                  {int.path && <span className="text-caption text-gray-400 ml-2">{int.path.join(' > ')}</span>}
                                </div>
                                {int.audience_size_lower_bound != null && (
                                  <span className="text-caption text-gray-400 ml-2">{(int.audience_size_lower_bound / 1_000_000).toFixed(1)}M+</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                        {!interestSearching && interestQuery.length >= 2 && !showInterestDropdown && interestResults.length === 0 && (
                          <p className="mt-2 text-sm text-gray-400 text-center py-2">Sonuç bulunamadı</p>
                        )}
                      </>
                    )}

                    {interestTab === 'browse' && (
                      <div>
                        {browseLoading && (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-2" />
                            <span className="text-sm text-gray-500">Kategoriler yükleniyor...</span>
                          </div>
                        )}
                        {!browseLoading && browseData.length === 0 && browseFetched && (
                          <p className="text-sm text-gray-400 py-4 text-center">Kategori bulunamadı</p>
                        )}
                        {!browseLoading && browseData.length > 0 && (
                          <div className="border border-gray-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-gray-100">
                            {browseData
                              .filter((item) => !interests.some((i) => i.id === item.id))
                              .map((item) => (
                                <button key={item.id} type="button" onClick={() => addInterest(item)}
                                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 flex items-center justify-between">
                                  <div>
                                    <span>{item.name}</span>
                                    {item.path && item.path.length > 0 && (
                                      <span className="text-caption text-gray-400 ml-2">{item.path.join(' > ')}</span>
                                    )}
                                  </div>
                                  {item.audience_size_lower_bound != null && (
                                    <span className="text-caption text-gray-400 ml-2 whitespace-nowrap">{(item.audience_size_lower_bound / 1_000_000).toFixed(1)}M+</span>
                                  )}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Bütçe ve Plan ── */}
              <div className="border border-gray-200 rounded-xl bg-white">
                <div className="px-5 pt-5 pb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Bütçe ve Plan</h3>
                  <p className="text-sm text-gray-500 mt-1">Bütçenizi ve zaman çizelgenizi belirleyin.</p>
                </div>
                <div className="px-5 pb-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Bütçe Tipi</label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="budgetType" checked={budgetType === 'daily'} onChange={() => setBudgetType('daily')} className="accent-green-600" />
                        <span className="text-sm text-gray-700">{t.daily}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="budgetType" checked={budgetType === 'lifetime'} onChange={() => setBudgetType('lifetime')} className="accent-green-600" />
                        <span className="text-sm text-gray-700">{t.lifetime}</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Tutar</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">TRY</span>
                      <input type="number" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)}
                        min="1" step="0.01"
                        className="w-full pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm pl-12"
                        placeholder="0.00" />
                    </div>
                    {accountCurrency && accountCurrency !== 'TRY' && fxRate && (
                      <p className="text-xs text-gray-500 mt-1">Hesap: {accountCurrency}. Kur: 1 {accountCurrency} = {fxRate.toFixed(2)} TRY</p>
                    )}
                    {accountCurrency && accountCurrency !== 'TRY' && !fxRate && fxLoading && (
                      <p className="text-xs text-gray-400 mt-1">{t.fxLoading}</p>
                    )}
                    {accountCurrency && accountCurrency !== 'TRY' && !fxRate && !fxLoading && (
                      <p className="text-xs text-red-500 mt-1">{t.fxError}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">{t.schedule}</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t.startDate}</label>
                        <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t.endDate}</label>
                        <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Reklam Alanları ── */}
              <div className="border border-gray-200 rounded-xl bg-white">
                <div className="px-5 pt-5 pb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Reklam Alanları</h3>
                  <p className="text-sm text-gray-500 mt-1">Reklamınızın hangi platformlarda gösterileceğini seçin.</p>
                </div>
                <div className="px-5 pb-5 space-y-4">
                  {/* Advantage+ vs Manuel */}
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50"
                      style={{ borderColor: placementMode === 'advantage' ? '#2BB673' : '#e5e7eb' }}>
                      <input type="radio" name="placementMode" checked={placementMode === 'advantage'}
                        onChange={() => setPlacementMode('advantage')}
                        className="mt-0.5 accent-[#2BB673]" />
                      <div>
                        <span className="text-sm font-medium text-gray-900">Advantage+ Reklam Alanları</span>
                        <p className="text-xs text-gray-500 mt-0.5">Bütçenize en iyi dönüşe ulaşmak ve reklamınızı daha fazla kişiye göstermek için Advantage+ reklam alanlarını kullanın.</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50"
                      style={{ borderColor: placementMode === 'manual' ? '#2BB673' : '#e5e7eb' }}>
                      <input type="radio" name="placementMode" checked={placementMode === 'manual'}
                        onChange={() => setPlacementMode('manual')}
                        className="mt-0.5 accent-[#2BB673]" />
                      <div>
                        <span className="text-sm font-medium text-gray-900">Manuel Reklam Alanları</span>
                        <p className="text-xs text-gray-500 mt-0.5">Reklamınızın gösterileceği yerleri manuel olarak seçin.</p>
                      </div>
                    </label>
                  </div>

                  {placementMode === 'manual' && (
                    <>
                      {/* Platform tabs */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                        <p className="text-xs text-gray-500 mb-3">Reklamınızın hangi platformlarda gösterileceğini seçin.</p>
                        <div className="flex gap-2 flex-wrap">
                          {([
                            { key: 'facebook' as const, label: 'Facebook' },
                            { key: 'instagram' as const, label: 'Instagram' },
                            { key: 'audience_network' as const, label: 'Audience Network' },
                            { key: 'messenger' as const, label: 'Messenger' },
                          ]).map(pl => {
                            const isActive = publisherPlatforms.includes(pl.key)
                            return (
                              <button key={pl.key} type="button"
                                onClick={() => {
                                  if (isActive) {
                                    setPublisherPlatforms(prev => prev.filter(p => p !== pl.key))
                                  } else {
                                    setPublisherPlatforms(prev => [...prev, pl.key])
                                  }
                                }}
                                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                                  isActive
                                    ? 'bg-[#2BB673] text-white border-[#2BB673]'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                {pl.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Placement platform tab selector */}
                      <div>
                        <div className="flex border-b border-gray-200">
                          {([
                            { key: 'facebook' as const, label: 'Facebook' },
                            { key: 'instagram' as const, label: 'Instagram' },
                            { key: 'audience_network' as const, label: 'Audience Network' },
                            { key: 'messenger' as const, label: 'Messenger' },
                          ]).filter(pl => publisherPlatforms.includes(pl.key)).map(pl => (
                            <button key={pl.key} type="button"
                              onClick={() => setActivePlacementPlatform(pl.key)}
                              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                                activePlacementPlatform === pl.key
                                  ? 'border-[#2BB673] text-[#2BB673]'
                                  : 'border-transparent text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              {pl.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Placement checkboxes by category */}
                      <div className="space-y-4">
                        {/* Helper: render a placement row */}
                        {(() => {
                          const getPositionState = (platform: string) => {
                            switch (platform) {
                              case 'facebook': return { positions: facebookPositions, setter: setFacebookPositions }
                              case 'instagram': return { positions: instagramPositions, setter: setInstagramPositions }
                              case 'messenger': return { positions: messengerPositions, setter: setMessengerPositions }
                              case 'audience_network': return { positions: audienceNetworkPositions, setter: setAudienceNetworkPositions }
                              default: return { positions: [] as string[], setter: (() => {}) as React.Dispatch<React.SetStateAction<string[]>> }
                            }
                          }

                          const PlacementRow = ({ label, platform, position }: { label: string; platform: string; position: string }) => {
                            const { positions, setter } = getPositionState(platform)
                            const isChecked = positions.includes(position)
                            return (
                              <label className="flex items-center justify-between py-2 px-1 hover:bg-gray-50 rounded cursor-pointer">
                                <span className="text-sm text-gray-700">{label}</span>
                                <input type="checkbox" checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setter(prev => [...prev, position])
                                    } else {
                                      setter(prev => prev.filter(p => p !== position))
                                    }
                                  }}
                                  className="w-4 h-4 accent-[#2BB673] cursor-pointer" />
                              </label>
                            )
                          }

                          const CategoryHeader = ({ title }: { title: string }) => (
                            <div className="pt-2 pb-1 border-b border-gray-100">
                              <span className="text-sm font-semibold text-gray-800">{title}</span>
                            </div>
                          )

                          // ───── Facebook placements ─────
                          if (activePlacementPlatform === 'facebook' && publisherPlatforms.includes('facebook')) {
                            return (
                              <div className="space-y-1">
                                <CategoryHeader title="Akış" />
                                <PlacementRow label="Facebook Akışı" platform="facebook" position="feed" />
                                <PlacementRow label="Facebook profil akışı" platform="facebook" position="profile_feed" />
                                <PlacementRow label="Facebook Marketplace" platform="facebook" position="marketplace" />
                                <PlacementRow label="Facebook Video Akışları" platform="facebook" position="video_feeds" />
                                <PlacementRow label="Facebook Sağ Sütun" platform="facebook" position="right_hand_column" />
                                <PlacementRow label="Facebook İşletme Keşfi" platform="facebook" position="biz_disco_feed" />

                                <CategoryHeader title="Hikayeler ve Reels" />
                                <PlacementRow label="Facebook Hikaye" platform="facebook" position="story" />
                                <PlacementRow label="Facebook Reels" platform="facebook" position="facebook_reels" />

                                <CategoryHeader title="Yayın İçi" />
                                <PlacementRow label="Facebook Yayın İçi Video" platform="facebook" position="instream_video" />
                                <PlacementRow label="Facebook Reels Üzerinden Reklamlar" platform="facebook" position="reels_overlay" />

                                <CategoryHeader title="Ara" />
                                <PlacementRow label="Facebook Arama Sonuçları" platform="facebook" position="search" />
                              </div>
                            )
                          }

                          // ───── Instagram placements ─────
                          if (activePlacementPlatform === 'instagram' && publisherPlatforms.includes('instagram')) {
                            return (
                              <div className="space-y-1">
                                <CategoryHeader title="Akış" />
                                <PlacementRow label="Instagram Akışı" platform="instagram" position="stream" />
                                <PlacementRow label="Instagram profil akışı" platform="instagram" position="profile_feed" />
                                <PlacementRow label="Instagram Keşfet" platform="instagram" position="explore" />
                                <PlacementRow label="Instagram Keşfet Ana Sayfası" platform="instagram" position="explore_home" />

                                <CategoryHeader title="Hikayeler ve Reels" />
                                <PlacementRow label="Instagram Hikaye" platform="instagram" position="story" />
                                <PlacementRow label="Instagram Reels" platform="instagram" position="reels" />
                                <PlacementRow label="Instagram profil Reels" platform="instagram" position="profile_reels" />

                                <CategoryHeader title="Ara" />
                                <PlacementRow label="Instagram Arama Sonuçları" platform="instagram" position="ig_search" />
                              </div>
                            )
                          }

                          // ───── Audience Network placements ─────
                          if (activePlacementPlatform === 'audience_network' && publisherPlatforms.includes('audience_network')) {
                            return (
                              <div className="space-y-1">
                                <CategoryHeader title="Uygulamalar ve Siteler" />
                                <PlacementRow label="Audience Network Klasik" platform="audience_network" position="classic" />
                                <PlacementRow label="Audience Network Ödüllü Video" platform="audience_network" position="rewarded_video" />
                                <PlacementRow label="Audience Network Yayın İçi" platform="audience_network" position="instream_video" />
                              </div>
                            )
                          }

                          // ───── Messenger placements ─────
                          if (activePlacementPlatform === 'messenger' && publisherPlatforms.includes('messenger')) {
                            return (
                              <div className="space-y-1">
                                <CategoryHeader title="Mesajlar" />
                                <PlacementRow label="Messenger Gelen Kutusu" platform="messenger" position="messenger_home" />
                                <PlacementRow label="Messenger Hikaye" platform="messenger" position="story" />
                                <PlacementRow label="Messenger Sponsorlu Mesajlar" platform="messenger" position="sponsored_messages" />
                              </div>
                            )
                          }

                          // No platform selected or active tab not in publisher_platforms
                          return (
                            <p className="text-sm text-gray-400 py-4 text-center">Yukarıdan bir platform seçin.</p>
                          )
                        })()}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ═══════ RIGHT COLUMN ═══════ */}
            <div className="col-span-1 space-y-6">
              {/* Performans Hedefi */}
              <div className="border border-gray-200 rounded-xl bg-white">
                <div className="px-5 pt-5 pb-3">
                  <h3 className="text-base font-semibold text-gray-900">Performans Hedefi</h3>
                  <p className="text-xs text-gray-500 mt-1">Reklam setinizin optimize edileceği hedef.</p>
                </div>
                <div className="px-5 pb-5">
                  <select
                    value={optimizationGoal}
                    onChange={(e) => setOptimizationGoal(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm"
                  >
                    {OPTIMIZATION_GOALS.map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Seçilen Kitle Özeti */}
              {(countries.length > 0 || interests.length > 0) && (
                <div className="border border-gray-200 rounded-xl bg-white">
                  <div className="px-5 pt-5 pb-3">
                    <h3 className="text-base font-semibold text-gray-900">Seçilen Kitle</h3>
                  </div>
                  <div className="px-5 pb-5 space-y-2 text-sm text-gray-600">
                    <div>Yaş: {ageMin} - {ageMax === 65 ? '65+' : ageMax}</div>
                    <div>Cinsiyet: {genders.length === 0 ? 'Tümü' : genders.includes(1) ? 'Erkek' : 'Kadın'}</div>
                    {countries.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                        <span>{countries.map(c => c.name).join(', ')}</span>
                      </div>
                    )}
                    {interests.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <Target className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                        <span>{interests.map(i => i.name).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
    </MetaEditOverlay>
  )
}

/** Convert ISO date string to datetime-local format */
function toLocalDatetime(isoString: string): string {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}
