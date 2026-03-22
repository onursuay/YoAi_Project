'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { StepProps, GeoSuggestion, SelectedLocation } from '../shared/WizardTypes'
import { inputCls, LANGUAGE_OPTIONS, COUNTRY_OPTIONS } from '../shared/WizardTypes'

export default function StepLocationLanguage({ state, update, t }: StepProps) {
  const [geoQuery, setGeoQuery] = useState('')
  const [geoResults, setGeoResults] = useState<GeoSuggestion[]>([])
  const [geoLoading, setGeoLoading] = useState(false)

  useEffect(() => {
    const q = geoQuery.trim()
    if (q.length < 2) { setGeoResults([]); return }
    let cancelled = false
    const timer = setTimeout(async () => {
      setGeoLoading(true)
      try {
        const params = new URLSearchParams({ q })
        if (state.geoSearchCountry) params.set('country', state.geoSearchCountry)
        const res = await fetch(`/api/integrations/google-ads/geo-targets?${params}`)
        const data = await res.json()
        if (!cancelled) setGeoResults(data.results ?? [])
      } catch {
        if (!cancelled) setGeoResults([])
      } finally {
        if (!cancelled) setGeoLoading(false)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [geoQuery, state.geoSearchCountry])

  const addLocation = (geo: GeoSuggestion, isNegative: boolean) => {
    if (state.locations.some(l => l.id === geo.id)) return
    const loc: SelectedLocation = { ...geo, isNegative }
    update({ locations: [...state.locations, loc] })
  }

  const removeLocation = (id: string) => {
    update({ locations: state.locations.filter(l => l.id !== id) })
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
      {/* Location Search */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900">{t('location.locationTargetingTitle')}</h4>

        {/* Country filter */}
        <div className="flex gap-2">
          <select
            className={`${inputCls} w-40 shrink-0`}
            value={state.geoSearchCountry}
            onChange={e => update({ geoSearchCountry: e.target.value })}
          >
            {COUNTRY_OPTIONS.map(c => (
              <option key={c.code} value={c.code}>{t(c.labelKey)}</option>
            ))}
          </select>

          <input
            className={`${inputCls} flex-1`}
            value={geoQuery}
            onChange={e => setGeoQuery(e.target.value)}
            placeholder={t('location.searchPlaceholder')}
          />
        </div>

        {!geoLoading && geoQuery.trim().length >= 2 && geoResults.length === 0 && (
          <p className="text-sm text-gray-500">{t('location.noResults')}</p>
        )}

        {geoResults.length > 0 && (
          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {geoResults.map(r => {
              const added = state.locations.some(l => l.id === r.id)
              return (
                <div key={r.id} className={`flex items-center justify-between px-3 py-2 hover:bg-gray-50 ${added ? 'bg-blue-50' : ''}`}>
                  <span className="text-sm font-medium truncate flex-1 mr-2">{r.name}</span>
                  {added ? (
                    <span className="text-xs text-blue-500 shrink-0">{t('location.added')}</span>
                  ) : (
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => addLocation(r, false)} className="text-xs text-blue-600 hover:underline font-medium">{t('location.include')}</button>
                      <button type="button" onClick={() => addLocation(r, true)} className="text-xs text-red-600 hover:underline font-medium">{t('location.exclude')}</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {state.locations.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {t('location.selectedTitleWithCount', { count: state.locations.length })}
            </p>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {state.locations.map(loc => (
                <div
                  key={loc.id}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${
                    loc.isNegative
                      ? 'bg-red-50 text-red-800 border border-red-100'
                      : 'bg-blue-50 text-blue-800 border border-blue-100'
                  }`}
                >
                  <span className="truncate flex-1">
                    {loc.name}{loc.isNegative ? ` (${t('location.excludedParens')})` : ''}
                  </span>
                  <button type="button" onClick={() => removeLocation(loc.id)} className="ml-1 shrink-0 hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Language Targeting */}
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
