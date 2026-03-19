'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronUp, ChevronDown, Plus, X, Clock, Search, MapPin, Loader2, Shield, Info } from 'lucide-react'
import type { PMaxStepProps, PMaxScheduleEntry, PMaxDayOfWeek, PMaxMinute, PMaxDeviceType, PMaxSelectedLocation, PMaxProximityLocation, PMaxRadiusUnit } from '../shared/PMaxWizardTypes'
import { inputCls, PMaxLanguageOptions, PMaxCountryOptions, PMaxDaysOfWeek, PMaxAllDevices } from '../shared/PMaxWizardTypes'

const EU_POLICY_URL = 'https://support.google.com/adspolicy/answer/6014595'
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const END_HOURS = Array.from({ length: 25 }, (_, i) => i)
const MINUTES: PMaxMinute[] = ['ZERO', 'FIFTEEN', 'THIRTY', 'FORTY_FIVE']
const MINUTE_LABELS: Record<PMaxMinute, string> = { ZERO: '00', FIFTEEN: '15', THIRTY: '30', FORTY_FIVE: '45' }

const DEVICE_LABELS: Record<PMaxDeviceType, string> = {
  COMPUTERS: 'devices.computers',
  MOBILE: 'devices.mobile',
  TABLETS: 'devices.tablets',
  TV_SCREENS: 'devices.tvScreens',
}

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'UNKNOWN']
const GENDERS = ['MALE', 'FEMALE', 'UNKNOWN']

function CollapsibleSection({
  id,
  title,
  defaultOpen = true,
  children,
}: {
  id?: string
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div id={id} className="border border-gray-200 rounded-lg bg-white scroll-mt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-5 py-4 text-left"
      >
        <h4 className="text-[15px] font-semibold text-gray-900">{title}</h4>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 pt-0">{children}</div>}
    </div>
  )
}

interface GeoSuggestion {
  id: string
  name: string
  countryCode: string
  targetType: string
}

export default function PMaxStepCampaignSettings({ state, update, t }: PMaxStepProps) {
  const [geoQuery, setGeoQuery] = useState('')
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoSuggestions, setGeoSuggestions] = useState<GeoSuggestion[]>([])
  const [showGeoDropdown, setShowGeoDropdown] = useState(false)
  // Location scope: 'all' | 'turkey' | 'custom'
  const [locationScope, setLocationScope] = useState<'all' | 'turkey' | 'custom'>(
    state.locations.length > 0 || state.proximityLocations.length > 0 ? 'custom'
      : state.geoSearchCountry === 'TR' ? 'turkey'
      : 'all'
  )
  // Advanced location dialog state
  const [showAdvancedLocation, setShowAdvancedLocation] = useState(false)
  const [advancedLocationTab, setAdvancedLocationTab] = useState<'location' | 'radius'>('location')
  const [advGeoQuery, setAdvGeoQuery] = useState('')
  const [advGeoResults, setAdvGeoResults] = useState<GeoSuggestion[]>([])
  const [advGeoLoading, setAdvGeoLoading] = useState(false)
  const [radiusPlaceName, setRadiusPlaceName] = useState('')
  const [radiusValue, setRadiusValue] = useState('20')
  const [radiusUnit, setRadiusUnit] = useState<PMaxRadiusUnit>('KILOMETERS')
  const [pinMode, setPinMode] = useState(false)
  const [radiusSearchResults, setRadiusSearchResults] = useState<GeoSuggestion[]>([])
  const geoDropdownRef = useRef<HTMLDivElement>(null)
  const [addingDay, setAddingDay] = useState<PMaxDayOfWeek | null>(null)
  const [newStart, setNewStart] = useState(0)
  const [newStartMin, setNewStartMin] = useState<PMaxMinute>('ZERO')
  const [newEnd, setNewEnd] = useState(0)
  const [newEndMin, setNewEndMin] = useState<PMaxMinute>('ZERO')

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (geoDropdownRef.current && !geoDropdownRef.current.contains(e.target as Node)) {
        setShowGeoDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Refs to avoid stale closures in useEffect
  const locationsRef = useRef(state.locations)
  locationsRef.current = state.locations
  const countryRef = useRef(state.geoSearchCountry)
  countryRef.current = state.geoSearchCountry

  // Debounced geo search — only re-runs when geoQuery changes
  useEffect(() => {
    if (geoQuery.trim().length < 2) {
      setGeoSuggestions([])
      setShowGeoDropdown(false)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setGeoLoading(true)
      try {
        const params = new URLSearchParams({ q: geoQuery })
        if (countryRef.current) params.set('country', countryRef.current)
        const res = await fetch(`/api/integrations/google-ads/geo-targets?${params}`, { signal: controller.signal })
        if (!res.ok) { setGeoLoading(false); return }
        const data = await res.json()
        const results: GeoSuggestion[] = data.results ?? []
        const filtered = results.filter(r => !locationsRef.current.some(l => l.id === r.id))
        setGeoSuggestions(filtered.slice(0, 10))
        setShowGeoDropdown(filtered.length > 0)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setGeoSuggestions([])
          setShowGeoDropdown(false)
        }
      } finally {
        setGeoLoading(false)
      }
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoQuery])

  // Advanced dialog — location search
  useEffect(() => {
    if (advGeoQuery.trim().length < 2) { setAdvGeoResults([]); return }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setAdvGeoLoading(true)
      try {
        const params = new URLSearchParams({ q: advGeoQuery })
        const res = await fetch(`/api/integrations/google-ads/geo-targets?${params}`, { signal: controller.signal })
        if (!res.ok) { setAdvGeoLoading(false); return }
        const data = await res.json()
        setAdvGeoResults((data.results ?? []).slice(0, 15))
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setAdvGeoResults([])
      } finally {
        setAdvGeoLoading(false)
      }
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  }, [advGeoQuery])

  // Advanced dialog — radius search
  useEffect(() => {
    if (radiusPlaceName.trim().length < 2) { setRadiusSearchResults([]); return }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: radiusPlaceName })
        const res = await fetch(`/api/integrations/google-ads/geo-targets?${params}`, { signal: controller.signal })
        if (!res.ok) return
        const data = await res.json()
        setRadiusSearchResults((data.results ?? []).slice(0, 10))
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setRadiusSearchResults([])
      }
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  }, [radiusPlaceName])

  const selectGeoSuggestion = (suggestion: GeoSuggestion) => {
    if (!state.locations.some(l => l.id === suggestion.id)) {
      update({ locations: [...state.locations, { ...suggestion, isNegative: false }] })
    }
    setGeoQuery('')
    setGeoSuggestions([])
    setShowGeoDropdown(false)
  }

  const removeLocation = (id: string) => {
    update({ locations: state.locations.filter(l => l.id !== id) })
  }

  const toggleLanguage = (langId: string) => {
    const has = state.languageIds.includes(langId)
    update({ languageIds: has ? state.languageIds.filter(id => id !== langId) : [...state.languageIds, langId] })
  }

  const toggleDevice = (device: PMaxDeviceType) => {
    const has = state.devices.includes(device)
    update({ devices: has ? state.devices.filter(d => d !== device) : [...state.devices, device] })
  }

  const addScheduleEntry = () => {
    if (!addingDay) return
    const entry: PMaxScheduleEntry = {
      dayOfWeek: addingDay,
      startHour: newStart,
      startMinute: newStartMin,
      endHour: newEnd,
      endMinute: newEndMin,
    }
    update({ adSchedule: [...state.adSchedule, entry] })
    setAddingDay(null)
  }

  const removeScheduleEntry = (idx: number) => {
    update({ adSchedule: state.adSchedule.filter((_, i) => i !== idx) })
  }

  const applyAllDay = () => {
    update({ adSchedule: [] })
  }

  const entriesForDay = (day: PMaxDayOfWeek) => state.adSchedule.filter(e => e.dayOfWeek === day)

  const addCustomParam = () => {
    update({ customParameters: [...state.customParameters, { key: '', value: '' }] })
  }

  const removeCustomParam = (idx: number) => {
    update({ customParameters: state.customParameters.filter((_, i) => i !== idx) })
  }

  const updateCustomParam = (idx: number, field: 'key' | 'value', val: string) => {
    const next = [...state.customParameters]
    next[idx] = { ...next[idx], [field]: val }
    update({ customParameters: next })
  }

  return (
    <div className="space-y-4 pt-2">
      {/* 1. Konumlar */}
      <CollapsibleSection id="pmax-settings-section-0" title={t('settings.locationsTitle')}>
        <div className="space-y-3">
          <p className="text-[13px] text-gray-500 mb-2">{t('settings.locationsLabel')}</p>

          {/* Radio options */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="pmaxLocScope" checked={locationScope === 'all'} onChange={() => { setLocationScope('all'); update({ locations: [], proximityLocations: [], geoSearchCountry: '' }) }} className="text-blue-600" />
              <span className="text-[13px] font-medium text-gray-900">{t('settings.locationsAllCountries')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="pmaxLocScope" checked={locationScope === 'turkey'} onChange={() => { setLocationScope('turkey'); update({ geoSearchCountry: 'TR', locations: [], proximityLocations: [] }) }} className="text-blue-600" />
              <span className="text-[13px] font-medium text-gray-900">{t('location.countryTR')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="pmaxLocScope" checked={locationScope === 'custom'} onChange={() => { setLocationScope('custom'); update({ geoSearchCountry: '' }) }} className="text-blue-600" />
              <span className="text-[13px] font-medium text-gray-900">{t('settings.locationsCustom')}</span>
            </label>
          </div>

          {/* Search + locations — only visible when "Başka bir yer girin" selected */}
          {locationScope === 'custom' && (<>
          <div className="relative" ref={geoDropdownRef}>
            <div className="flex items-center gap-2">
              <div className="flex items-center flex-1 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                <Search className="w-4 h-4 text-gray-400 ml-3 shrink-0" />
                <input
                  className="w-full px-2 py-2 text-[13px] focus:outline-none bg-transparent"
                  value={geoQuery}
                  onChange={e => setGeoQuery(e.target.value)}
                  onFocus={() => { if (geoSuggestions.length > 0) setShowGeoDropdown(true) }}
                  placeholder={t('settings.locationSearchPlaceholder')}
                />
                {geoLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-500 mr-3 shrink-0" />}
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedLocation(true)}
                className="text-[13px] text-blue-600 hover:underline whitespace-nowrap shrink-0"
              >
                {t('settings.advancedSearch')}
              </button>
            </div>

            {/* Autocomplete dropdown with actions */}
            {showGeoDropdown && geoSuggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-gray-500">{t('settings.locationMatches')}</span>
                  <span className="text-[12px] text-gray-400">{t('settings.locationReach')}</span>
                </div>
                {geoSuggestions.map((s, idx) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between px-3 py-2 hover:bg-blue-50 group ${idx === 0 ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-gray-900 truncate">{s.name} <span className="text-gray-400">{s.targetType.toLowerCase()}</span></p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => { selectGeoSuggestion(s); }}
                        className="text-[12px] text-blue-600 hover:underline font-medium"
                      >
                        {t('settings.locationInclude')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!state.locations.some(l => l.id === s.id)) {
                            update({ locations: [...state.locations, { ...s, isNegative: true }] })
                          }
                          setGeoQuery('')
                          setGeoSuggestions([])
                          setShowGeoDropdown(false)
                        }}
                        className="text-[12px] text-gray-500 hover:text-red-600 hover:underline font-medium"
                      >
                        {t('settings.locationExclude')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!state.locations.some(l => l.id === s.id)) {
                            update({ locations: [...state.locations, { ...s, isNegative: false, action: 'NEARBY' as const }] })
                          }
                          setGeoQuery('')
                          setGeoSuggestions([])
                          setShowGeoDropdown(false)
                        }}
                        className="text-[12px] text-gray-500 hover:text-blue-600 hover:underline font-medium"
                      >
                        {t('settings.locationNearby')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400">{t('settings.locationSearchHint')}</p>

          {/* Selected locations */}
          {(state.locations.length > 0 || state.proximityLocations.length > 0) && (
            <div className="space-y-1.5">
              {state.locations.map(l => (
                <div key={l.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-[13px] ${l.isNegative ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-gray-900">{l.name}</span>
                    <span className="text-[11px] text-gray-400">{l.targetType}</span>
                    {l.isNegative && <span className="text-[11px] text-red-600 font-medium">{t('settings.locationExcluded')}</span>}
                    {l.action === 'NEARBY' && <span className="text-[11px] text-blue-600 font-medium">{t('settings.locationNearbyTag')}</span>}
                  </div>
                  <button type="button" onClick={() => removeLocation(l.id)} className="text-gray-400 hover:text-red-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {state.proximityLocations.map(p => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-[13px]">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-gray-900">{p.label}</span>
                    <span className="text-[11px] text-blue-600">{p.radiusInUnits} {p.radiusUnits === 'KILOMETERS' ? 'km' : 'mil'} {t('settings.locationRadius')}</span>
                  </div>
                  <button type="button" onClick={() => update({ proximityLocations: state.proximityLocations.filter(x => x.id !== p.id) })} className="text-gray-400 hover:text-red-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Yer seçenekleri — Location targeting mode */}
          <details className="text-sm">
            <summary className="text-blue-600 cursor-pointer hover:underline">{t('settings.locationOptionsToggle')}</summary>
            <div className="mt-3 space-y-3 pl-1">
              <p className="text-[12px] font-medium text-gray-600 mb-1">{t('settings.locationModeTitle')}</p>
              <label className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer ${state.locationTargetingMode === 'PRESENCE_OR_INTEREST' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <input type="radio" name="pmaxLocationMode" checked={state.locationTargetingMode === 'PRESENCE_OR_INTEREST'} onChange={() => update({ locationTargetingMode: 'PRESENCE_OR_INTEREST' })} className="mt-0.5 text-blue-600" />
                <span className="text-[13px] font-medium text-gray-900">{t('settings.locationModePresenceInterest')}</span>
              </label>
              <label className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer ${state.locationTargetingMode === 'PRESENCE_ONLY' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <input type="radio" name="pmaxLocationMode" checked={state.locationTargetingMode === 'PRESENCE_ONLY'} onChange={() => update({ locationTargetingMode: 'PRESENCE_ONLY' })} className="mt-0.5 text-blue-600" />
                <span className="text-[13px] font-medium text-gray-900">{t('settings.locationModePresenceOnly')}</span>
              </label>
            </div>
          </details>
          </>)}
        </div>
      </CollapsibleSection>

      {/* Gelişmiş Arama Dialog — Konum / Yarıçap */}
      {showAdvancedLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
              <button type="button" onClick={() => setShowAdvancedLocation(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
              <span className="text-[15px] font-semibold text-gray-900">{t('settings.advancedLocationTitle')}</span>
            </div>

            {/* Konum / Yarıçap tabs */}
            <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-200">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="advLocTab" checked={advancedLocationTab === 'location'} onChange={() => setAdvancedLocationTab('location')} className="text-blue-600" />
                <span className="text-[13px] font-medium text-gray-900">{t('settings.advancedTabLocation')}</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="advLocTab" checked={advancedLocationTab === 'radius'} onChange={() => setAdvancedLocationTab('radius')} className="text-blue-600" />
                <span className="text-[13px] font-medium text-gray-900">{t('settings.advancedTabRadius')}</span>
              </label>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-5">
              {advancedLocationTab === 'location' && (
                <div className="space-y-4">
                  <div className="relative" ref={geoDropdownRef}>
                    <div className="flex items-center border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
                      <Search className="w-4 h-4 text-gray-400 ml-3 shrink-0" />
                      <input
                        className="w-full px-2 py-2.5 text-[13px] focus:outline-none bg-transparent"
                        value={advGeoQuery}
                        onChange={e => setAdvGeoQuery(e.target.value)}
                        placeholder={t('settings.advancedSearchPlaceholder')}
                      />
                      {advGeoLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-500 mr-3 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">{t('settings.advancedSearchHint')}</p>

                    {/* Results */}
                    {advGeoResults.length > 0 && (
                      <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex justify-between">
                          <span className="text-[12px] font-medium text-gray-500">{t('settings.locationMatches')}</span>
                          <span className="text-[12px] text-gray-400">{t('settings.locationReach')}</span>
                        </div>
                        {advGeoResults.map(s => (
                          <div key={s.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0">
                            <span className="text-[13px] text-gray-900">{s.name} <span className="text-gray-400">{s.targetType.toLowerCase()}</span></span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!state.locations.some(l => l.id === s.id)) {
                                    update({ locations: [...state.locations, { ...s, isNegative: false }] })
                                  }
                                }}
                                className="text-[12px] text-blue-600 hover:underline font-medium"
                              >
                                {t('settings.locationInclude')}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!state.locations.some(l => l.id === s.id)) {
                                    update({ locations: [...state.locations, { ...s, isNegative: true }] })
                                  }
                                }}
                                className="text-[12px] text-gray-500 hover:text-red-600 hover:underline font-medium"
                              >
                                {t('settings.locationExclude')}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!state.locations.some(l => l.id === s.id)) {
                                    update({ locations: [...state.locations, { ...s, isNegative: false, action: 'NEARBY' as const }] })
                                  }
                                }}
                                className="text-[12px] text-gray-500 hover:text-blue-600 hover:underline font-medium"
                              >
                                {t('settings.locationNearby')}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-[12px] text-gray-500">{t('settings.advancedLocationNote')}</p>
                </div>
              )}

              {advancedLocationTab === 'radius' && (
                <div className="space-y-4">
                  {/* Radius: yer adı + mesafe + birim — Google Ads layout */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center flex-1 min-w-0 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                      <Search className="w-4 h-4 text-gray-400 ml-3 shrink-0" />
                      <input
                        className="w-full px-2 py-2.5 text-[13px] focus:outline-none bg-transparent"
                        value={radiusPlaceName}
                        onChange={e => setRadiusPlaceName(e.target.value)}
                        placeholder={t('settings.radiusPlaceholder')}
                      />
                    </div>
                    <input
                      type="number"
                      className="w-16 px-2 py-2.5 text-[13px] text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={radiusValue}
                      onChange={e => setRadiusValue(e.target.value)}
                      min={1}
                      max={50}
                    />
                    <select
                      className="w-16 px-2 py-2.5 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={radiusUnit}
                      onChange={e => setRadiusUnit(e.target.value as PMaxRadiusUnit)}
                    >
                      <option value="KILOMETERS">km</option>
                      <option value="MILES">mil</option>
                    </select>
                  </div>

                  {/* Sabitleme modu toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={pinMode} onChange={e => setPinMode(e.target.checked)} className="rounded border-gray-300 text-blue-600" />
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span className="text-[13px] font-medium text-gray-900">{t('settings.radiusPinMode')}</span>
                  </label>

                  {/* Radius search results */}
                  {radiusSearchResults.length > 0 && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <span className="text-[12px] font-medium text-gray-500">{t('settings.radiusMatchingLocations')}: {radiusPlaceName}</span>
                      </div>
                      {radiusSearchResults.map(s => (
                        <div key={s.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0">
                          <span className="text-[13px] text-gray-900">{s.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              // Use the geo target's approximate center for radius
                              const proximity: PMaxProximityLocation = {
                                id: `prox-${Date.now()}`,
                                label: `${s.name} ${t('settings.radiusLabel')} ${radiusValue || 20} ${radiusUnit === 'KILOMETERS' ? 'km' : 'mil'}`,
                                latitude: 0, // Will be resolved by backend
                                longitude: 0,
                                radiusInUnits: parseInt(radiusValue) || 20,
                                radiusUnits: radiusUnit,
                              }
                              update({ proximityLocations: [...state.proximityLocations, proximity] })
                            }}
                            className="text-[12px] text-blue-600 hover:underline font-medium"
                          >
                            {t('settings.locationInclude')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Added proximity locations */}
                  {state.proximityLocations.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[12px] font-medium text-gray-500">{t('settings.radiusAddedLocations')} ({state.proximityLocations.length})</p>
                      {state.proximityLocations.map(p => (
                        <div key={p.id} className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-[13px]">
                          <span className="text-gray-900">{p.label}</span>
                          <button type="button" onClick={() => update({ proximityLocations: state.proximityLocations.filter(x => x.id !== p.id) })} className="text-gray-400 hover:text-red-600">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-gray-200">
              <button type="button" onClick={() => setShowAdvancedLocation(false)} className="px-4 py-2 text-[13px] text-gray-600 hover:text-gray-800">
                {t('settings.advancedCancel')}
              </button>
              <button type="button" onClick={() => setShowAdvancedLocation(false)} className="px-4 py-2 text-[13px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                {t('settings.advancedSave')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Diller */}
      <CollapsibleSection id="pmax-settings-section-1" title={t('settings.languagesTitle')}>
        <div className="space-y-3">
          <p className="text-[13px] text-gray-500 mb-2">{t('settings.languagesLabel')}</p>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className={`${inputCls} pl-9`} placeholder={t('settings.languagesSearchPlaceholder')} readOnly />
          </div>
          <div className="flex flex-wrap gap-2">
            {PMaxLanguageOptions.map(lang => {
              const selected = state.languageIds.includes(lang.id)
              return (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => toggleLanguage(lang.id)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {lang.name}
                  {selected && <X className="w-3 h-3" />}
                </button>
              )
            })}
          </div>
        </div>
      </CollapsibleSection>

      {/* 3. AB siyasi reklamları — Search wizard ile birebir aynı tasarım */}
      <section id="pmax-settings-section-2" className="border border-gray-200 rounded-lg bg-white scroll-mt-4">
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-gray-600" />
            <h4 className="text-[15px] font-semibold text-gray-900">{t('settings.euPoliticalTitle')}</h4>
          </div>
          <p className="text-[13px] text-gray-600 mb-3">{t('settings.euPoliticalQuestion')}</p>
          <div className="space-y-1">
            <label
              className={`flex items-center gap-3 py-2.5 px-3 rounded border cursor-pointer transition-colors ${
                state.euPoliticalAdsDeclaration === 'NOT_POLITICAL'
                  ? 'border-blue-300 bg-blue-50/50'
                  : 'border-gray-100 hover:border-gray-200 bg-gray-50/30'
              }`}
            >
              <input
                type="radio"
                name="pmaxEuPolitical"
                value="NOT_POLITICAL"
                checked={state.euPoliticalAdsDeclaration === 'NOT_POLITICAL'}
                onChange={() => update({ euPoliticalAdsDeclaration: 'NOT_POLITICAL' })}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-[13px] font-medium text-gray-900">{t('settings.euPoliticalNotPolitical')}</span>
            </label>
            {state.euPoliticalAdsDeclaration === 'NOT_POLITICAL' && (
              <p className="text-[12px] text-gray-500 pl-8 mt-0.5 mb-1">
                {t('settings.euPoliticalHelperNote')}
              </p>
            )}
            <label
              className={`flex items-center gap-3 py-2.5 px-3 rounded border cursor-pointer transition-colors ${
                state.euPoliticalAdsDeclaration === 'POLITICAL'
                  ? 'border-blue-300 bg-blue-50/50'
                  : 'border-gray-100 hover:border-gray-200 bg-gray-50/30'
              }`}
            >
              <input
                type="radio"
                name="pmaxEuPolitical"
                value="POLITICAL"
                checked={state.euPoliticalAdsDeclaration === 'POLITICAL'}
                onChange={() => update({ euPoliticalAdsDeclaration: 'POLITICAL' })}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-[13px] font-medium text-gray-900">{t('settings.euPoliticalPolitical')}</span>
            </label>
            {state.euPoliticalAdsDeclaration === 'POLITICAL' && (
              <div className="flex items-start gap-2 p-3 mt-1 rounded border border-amber-200 bg-amber-50/60 text-[13px] text-amber-900">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-medium">{t('settings.euPoliticalWarningLine1')}</p>
                  <p className="mt-1 text-amber-800">{t('settings.euPoliticalWarningLine2')}</p>
                  <a
                    href={EU_POLICY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-block text-blue-600 hover:text-blue-700 underline"
                  >
                    {t('settings.euPoliticalLearnMore')}
                  </a>
                </div>
              </div>
            )}
          </div>
          {state.euPoliticalAdsDeclaration === null && (
            <p className="text-xs text-red-600 mt-2">{t('settings.euPoliticalValidation')}</p>
          )}
        </div>
      </section>

      {/* 4. Cihazlar */}
      <CollapsibleSection id="pmax-settings-section-3" title={t('settings.devicesTitle')}>
        <div className="space-y-2">
          <p className="text-[13px] text-gray-500 mb-2">{t('settings.devicesLabel')}</p>
          <p className="text-[12px] text-gray-500 mb-2">{t('settings.devicesRequired')}</p>
          {PMaxAllDevices.map(device => (
            <label key={device} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.devices.includes(device)}
                onChange={() => toggleDevice(device)}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-[13px] font-medium text-gray-900">{t(DEVICE_LABELS[device])}</span>
            </label>
          ))}
        </div>
      </CollapsibleSection>

      {/* 5. Reklam zaman planlaması */}
      <CollapsibleSection id="pmax-settings-section-4" title={t('settings.scheduleTitle')}>
        <div className="space-y-3">
          <p className="text-[13px] text-gray-500">{t('settings.scheduleDescription')}</p>
          <div className="flex gap-2 items-center mb-2">
            <select className={`${inputCls} w-28`} value="EVERYDAY" onChange={() => {}}>
              <option value="EVERYDAY">{t('settings.scheduleEveryDay')}</option>
            </select>
            <select
              className={`${inputCls} w-16`}
              value={newStart}
              onChange={e => setNewStart(Number(e.target.value))}
            >
              {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
            </select>
            <span className="text-gray-400">:</span>
            <select
              className={`${inputCls} w-14`}
              value={newStartMin}
              onChange={e => setNewStartMin(e.target.value as PMaxMinute)}
            >
              {MINUTES.map(m => <option key={m} value={m}>{MINUTE_LABELS[m]}</option>)}
            </select>
            <span className="text-gray-400 text-sm">-</span>
            <select
              className={`${inputCls} w-16`}
              value={newEnd}
              onChange={e => setNewEnd(Number(e.target.value))}
            >
              {END_HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
            </select>
            <span className="text-gray-400">:</span>
            <select
              className={`${inputCls} w-14`}
              value={newEndMin}
              onChange={e => setNewEndMin(e.target.value as PMaxMinute)}
            >
              {MINUTES.map(m => <option key={m} value={m}>{MINUTE_LABELS[m]}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => { if (addingDay) addScheduleEntry() }} className="text-sm text-blue-600 hover:underline">
            {t('settings.scheduleAddLink')}
          </button>

          {state.adSchedule.length > 0 && (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 mt-2">
              {PMaxDaysOfWeek.map(day => {
                const dayEntries = entriesForDay(day)
                if (dayEntries.length === 0) return null
                return (
                  <div key={day} className="px-4 py-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 w-20">{t(`settings.scheduleDayLabels.${day}`)}</span>
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      {dayEntries.map((entry, idx) => {
                        const globalIdx = state.adSchedule.indexOf(entry)
                        return (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                            {String(entry.startHour).padStart(2, '0')}:{MINUTE_LABELS[entry.startMinute]}–{String(entry.endHour).padStart(2, '0')}:{MINUTE_LABELS[entry.endMinute]}
                            <button type="button" onClick={() => removeScheduleEntry(globalIdx)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-[12px] text-gray-500">{t('settings.scheduleTimezoneNote')}</p>
        </div>
      </CollapsibleSection>

      {/* 6. Başlangıç ve bitiş tarihleri */}
      <CollapsibleSection id="pmax-settings-section-5" title={t('settings.datesTitle')}>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">{t('settings.startDate')}</label>
            <input type="date" className={inputCls} value={state.startDate} onChange={e => update({ startDate: e.target.value })} />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">{t('settings.endDate')}</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="pmaxEndDate" checked={!state.endDate} onChange={() => update({ endDate: '' })} className="text-blue-600" />
                <span className="text-[13px] font-medium text-gray-900">{t('settings.endDateNone')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="pmaxEndDate" checked={!!state.endDate} onChange={() => update({ endDate: state.startDate || '' })} className="text-blue-600" />
                <input type="date" className={inputCls} value={state.endDate} onChange={e => update({ endDate: e.target.value })} min={state.startDate || undefined} />
              </label>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* 7. Kampanya URL seçenekleri */}
      <CollapsibleSection id="pmax-settings-section-6" title={t('settings.urlOptionsTitle')}>
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">{t('settings.trackingTemplate')}</label>
            <input
              className={inputCls}
              value={state.trackingTemplate}
              onChange={e => update({ trackingTemplate: e.target.value })}
              placeholder={t('settings.trackingTemplatePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">{t('settings.finalUrlSuffix')}</label>
            <input
              className={inputCls}
              value={state.finalUrlSuffix}
              onChange={e => update({ finalUrlSuffix: e.target.value })}
              placeholder={t('settings.finalUrlSuffixPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">{t('settings.customParametersLabel')}</label>
            <div className="space-y-2">
              {state.customParameters.map((cp, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">{'{'}</span>
                  <input
                    className={`${inputCls} w-24`}
                    value={cp.key}
                    onChange={e => updateCustomParam(i, 'key', e.target.value)}
                    placeholder={t('settings.customParamKey')}
                  />
                  <span className="text-sm text-gray-400">=</span>
                  <input
                    className={`${inputCls} flex-1`}
                    value={cp.value}
                    onChange={e => updateCustomParam(i, 'value', e.target.value)}
                    placeholder={t('settings.customParamValue')}
                  />
                  <span className="text-sm text-gray-400">{'}'}</span>
                  <button type="button" onClick={() => removeCustomParam(i)} className="text-gray-500 hover:text-red-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addCustomParam} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                <Plus className="w-3.5 h-3.5" /> {t('settings.customParamAdd')}
              </button>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* 8. Sayfa feed'leri */}
      <CollapsibleSection id="pmax-settings-section-7" title={t('settings.pageFeedsTitle')}>
        <div className="space-y-3">
          <p className="text-[13px] text-gray-500">{t('settings.pageFeedsDescription')}</p>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={state.finalUrlExpansionEnabled}
              onChange={e => update({ finalUrlExpansionEnabled: e.target.checked })}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-[13px] font-medium text-gray-900">{t('settings.finalUrlExpansionLabel')}</span>
          </label>
          <p className="text-[12px] text-gray-500">{t('settings.finalUrlExpansionNote')}</p>
        </div>
      </CollapsibleSection>

      {/* 9. Marka hariç tutmaları */}
      <CollapsibleSection id="pmax-settings-section-8" title={t('settings.brandExclusionsTitle')}>
        <div className="space-y-3">
          <p className="text-[13px] text-gray-500">{t('settings.brandExclusionsDescription')}</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className={`${inputCls} pl-9`}
              placeholder={t('settings.brandExclusionsPlaceholder')}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (val && !state.brandExclusions.includes(val)) {
                    update({ brandExclusions: [...state.brandExclusions, val] });
                    (e.target as HTMLInputElement).value = ''
                  }
                }
              }}
            />
          </div>
          {state.brandExclusions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {state.brandExclusions.map((b, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-sm">
                  {b}
                  <button type="button" onClick={() => update({ brandExclusions: state.brandExclusions.filter((_, j) => j !== i) })} className="text-gray-500 hover:text-red-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* 10. Demografik hariç tutmalar */}
      <CollapsibleSection title={t('settings.demographicExclusionsTitle')} defaultOpen={false}>
        <div className="space-y-4">
          <p className="text-[13px] text-gray-500">{t('settings.demographicExclusionsDescription')}</p>
          {/* Age exclusions */}
          <div>
            <label className="flex items-center gap-2 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.demographicExclusions.ageEnabled}
                onChange={e => update({ demographicExclusions: { ...state.demographicExclusions, ageEnabled: e.target.checked, ages: e.target.checked ? state.demographicExclusions.ages : [] } })}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-700">{t('settings.ageExclusionsEnable')}</span>
            </label>
            {state.demographicExclusions.ageEnabled && (
              <div className="flex flex-wrap gap-2 ml-6">
                {AGE_RANGES.map(age => (
                  <label key={age} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.demographicExclusions.ages.includes(age)}
                      onChange={e => {
                        const ages = e.target.checked
                          ? [...state.demographicExclusions.ages, age]
                          : state.demographicExclusions.ages.filter(a => a !== age)
                        update({ demographicExclusions: { ...state.demographicExclusions, ages } })
                      }}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-[13px] font-medium text-gray-900">{age === 'UNKNOWN' ? t('settings.ageUnknown') : age}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {/* Gender exclusions */}
          <div>
            <label className="flex items-center gap-2 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.demographicExclusions.genderEnabled}
                onChange={e => update({ demographicExclusions: { ...state.demographicExclusions, genderEnabled: e.target.checked, genders: e.target.checked ? state.demographicExclusions.genders : [] } })}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-700">{t('settings.genderExclusionsEnable')}</span>
            </label>
            {state.demographicExclusions.genderEnabled && (
              <div className="flex flex-wrap gap-3 ml-6">
                {GENDERS.map(g => (
                  <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.demographicExclusions.genders.includes(g)}
                      onChange={e => {
                        const genders = e.target.checked
                          ? [...state.demographicExclusions.genders, g]
                          : state.demographicExclusions.genders.filter(x => x !== g)
                        update({ demographicExclusions: { ...state.demographicExclusions, genders } })
                      }}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-[13px] font-medium text-gray-900">{t(`settings.gender${g}`)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* 11. Verileri hariç tutma işlemleriniz */}
      <CollapsibleSection title={t('settings.dataExclusionsTitle')} defaultOpen={false}>
        <div className="space-y-3">
          <p className="text-[13px] text-gray-500">{t('settings.dataExclusionsDescription')}</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={state.dataExclusionsEnabled}
              onChange={e => update({ dataExclusionsEnabled: e.target.checked })}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-[13px] font-medium text-gray-900">{t('settings.dataExclusionsEnable')}</span>
          </label>
        </div>
      </CollapsibleSection>
    </div>
  )
}
