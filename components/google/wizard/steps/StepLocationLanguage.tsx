'use client'

import { useEffect, useState, useRef } from 'react'
import { Search, X, MapPin, ChevronDown, Loader2 } from 'lucide-react'
import type { StepProps, GeoSuggestion, SelectedLocation } from '../shared/WizardTypes'
import { inputCls, LANGUAGE_OPTIONS } from '../shared/WizardTypes'

const DEBOUNCE_MS = 300
const MIN_CHARS = 2

export default function StepLocationLanguage({ state, update, t }: StepProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [locationScope, setLocationScope] = useState<'all' | 'turkey' | 'custom'>(
    state.locations.length > 0 ? 'custom'
      : state.geoSearchCountry === 'TR' ? 'turkey'
      : 'all'
  )

  /* ── Geo search with debounce ── */
  useEffect(() => {
    const q = query.trim()
    if (q.length < MIN_CHARS) {
      setResults([])
      setShowDropdown(false)
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ q })
        const res = await fetch(`/api/integrations/google-ads/geo-targets?${params}`)
        if (cancelled) return
        const data = await res.json()
        if (cancelled) return
        const list: GeoSuggestion[] = data.results ?? []
        setResults(list)
        setShowDropdown(list.length > 0)
      } catch {
        if (!cancelled) { setResults([]); setShowDropdown(false) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  /* ── Click outside ── */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addLocation = (geo: GeoSuggestion, isNegative: boolean) => {
    if (state.locations.some(l => l.id === geo.id)) return
    const loc: SelectedLocation = {
      id: geo.id,
      name: geo.name,
      countryCode: geo.countryCode,
      targetType: geo.targetType,
      isNegative,
    }
    update({ locations: [...state.locations, loc] })
    setQuery('')
    setResults([])
    setShowDropdown(false)
  }

  const removeLocation = (id: string) => {
    update({ locations: state.locations.filter(l => l.id !== id) })
  }

  const toggleNegative = (id: string) => {
    update({
      locations: state.locations.map(l =>
        l.id === id ? { ...l, isNegative: !l.isNegative } : l
      ),
    })
  }

  const toggleLanguage = (langId: string) => {
    const has = state.languageIds.includes(langId)
    update({
      languageIds: has
        ? state.languageIds.filter(id => id !== langId)
        : [...state.languageIds, langId],
    })
  }

  return (
    <div className="space-y-5">
      {/* ── Location Targeting ── */}
      <div ref={containerRef} className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900">{t('location.locationTargetingTitle')}</h4>

        {/* Scope radios */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="searchLocScope"
              checked={locationScope === 'all'}
              onChange={() => {
                setLocationScope('all')
                update({ locations: [], geoSearchCountry: '' })
              }}
              className="text-blue-600"
            />
            <span className="text-sm">{t('settings.locationsAllCountries')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="searchLocScope"
              checked={locationScope === 'turkey'}
              onChange={() => {
                setLocationScope('turkey')
                update({ geoSearchCountry: 'TR', locations: [] })
              }}
              className="text-blue-600"
            />
            <span className="text-sm">{t('location.countryTR')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="searchLocScope"
              checked={locationScope === 'custom'}
              onChange={() => {
                setLocationScope('custom')
                update({ geoSearchCountry: '' })
                setTimeout(() => inputRef.current?.focus(), 50)
              }}
              className="text-blue-600"
            />
            <span className="text-sm">{t('settings.locationsCustom')}</span>
          </label>
        </div>

        {/* Search — only when custom */}
        {locationScope === 'custom' && (
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                className={`${inputCls} pl-9 pr-9`}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => results.length > 0 && setShowDropdown(true)}
                onKeyDown={e => {
                  if (e.key === 'Escape') setShowDropdown(false)
                  if (e.key === 'Enter' && results.length > 0 && results[0]) addLocation(results[0], false)
                }}
                placeholder={t('location.searchPlaceholderFull')}
                autoComplete="off"
              />
              <Loader2 className={`absolute right-3 w-4 h-4 text-gray-400 animate-spin transition-opacity ${loading ? 'opacity-100' : 'opacity-0'}`} style={{top: 'calc(50% - 8px)'}} />
            </div>
            <p className="text-xs text-gray-400 mt-1">{t('location.searchHint')}</p>

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute left-0 right-0 mt-1 z-[100] bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {loading && results.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('location.searching')}
                  </div>
                ) : results.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">{t('location.noResults')}</div>
                ) : (
                  results.map(r => {
                    const added = state.locations.some(l => l.id === r.id)
                    return (
                      <div
                        key={r.id}
                        className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 ${added ? 'bg-blue-50/50' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{r.name}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {added ? (
                            <span className="text-xs text-blue-600">{t('location.added')}</span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => addLocation(r, false)}
                                className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded"
                              >
                                {t('location.include')}
                              </button>
                              <button
                                type="button"
                                onClick={() => addLocation(r, true)}
                                className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded"
                              >
                                {t('location.exclude')}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* Advanced search button */}
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
        >
          <MapPin className="w-4 h-4" />
          {t('location.advancedSearch')}
        </button>

        {/* Selected locations */}
        {state.locations.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              {t('location.selectedTitleWithCount', { count: state.locations.length })}
            </p>
            <div className="flex flex-wrap gap-2">
              {state.locations.map(loc => (
                <span
                  key={loc.id}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${loc.isNegative ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}
                >
                  {loc.name}
                  {loc.isNegative && <span className="text-red-500 text-xs">({t('location.excludedParens')})</span>}
                  <button
                    type="button"
                    onClick={() => toggleNegative(loc.id)}
                    className="ml-1 hover:opacity-70 text-xs underline"
                  >
                    {loc.isNegative ? t('location.include') : t('location.exclude')}
                  </button>
                  <button type="button" onClick={() => removeLocation(loc.id)} className="ml-0.5 hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Yer seçenekleri — details accordion */}
        <details className="text-sm">
          <summary className="text-blue-600 cursor-pointer hover:underline flex items-center gap-1">
            <ChevronDown className="w-4 h-4" />
            {t('settings.locationOptionsToggle')}
          </summary>
          <div className="mt-3 space-y-2 pl-1">
            <p className="text-xs font-medium text-gray-600 mb-1">{t('settings.locationModeTitle')}</p>
            <label className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer ${state.locationTargetingMode === 'PRESENCE_OR_INTEREST' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
              <input
                type="radio"
                name="searchLocationMode"
                checked={state.locationTargetingMode === 'PRESENCE_OR_INTEREST'}
                onChange={() => update({ locationTargetingMode: 'PRESENCE_OR_INTEREST' })}
                className="mt-0.5 text-blue-600"
              />
              <span className="text-sm text-gray-800">{t('settings.locationModePresenceInterest')}</span>
            </label>
            <label className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer ${state.locationTargetingMode === 'PRESENCE_ONLY' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
              <input
                type="radio"
                name="searchLocationMode"
                checked={state.locationTargetingMode === 'PRESENCE_ONLY'}
                onChange={() => update({ locationTargetingMode: 'PRESENCE_ONLY' })}
                className="mt-0.5 text-blue-600"
              />
              <span className="text-sm text-gray-800">{t('settings.locationModePresenceOnly')}</span>
            </label>
          </div>
        </details>
      </div>

      {/* ── Language Targeting ── */}
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">{t('location.languageTargetingTitle')} <span className="text-red-500">*</span></h4>
          <p className="text-xs text-gray-500 mt-0.5">{t('location.languageTargetingHint')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map(lang => {
            const active = state.languageIds.includes(lang.id)
            return (
              <button
                key={lang.id}
                type="button"
                onClick={() => toggleLanguage(lang.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  active
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {t(`summary.languageNames.${lang.id}`) || lang.name}
              </button>
            )
          })}
        </div>
        {state.languageIds.length === 0 && (
          <p className="text-xs text-red-500">{t('validation.languageRequired')}</p>
        )}
      </div>
    </div>
  )
}
