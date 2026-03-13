'use client'

import { useState } from 'react'
import { Check, X, Search } from 'lucide-react'
import type { StepProps, GeoSuggestion, SelectedLocation } from '../shared/WizardTypes'
import { inputCls, LANGUAGE_OPTIONS, COUNTRY_OPTIONS } from '../shared/WizardTypes'

export default function StepLocationLanguage({ state, update }: StepProps) {
  const [geoQuery, setGeoQuery] = useState('')
  const [geoResults, setGeoResults] = useState<GeoSuggestion[]>([])
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoSearched, setGeoSearched] = useState(false)

  const searchGeo = async () => {
    if (geoQuery.trim().length < 2) return
    setGeoLoading(true)
    setGeoSearched(true)
    try {
      const params = new URLSearchParams({ q: geoQuery })
      if (state.geoSearchCountry) params.set('country', state.geoSearchCountry)
      const res = await fetch(`/api/integrations/google-ads/geo-targets?${params}`)
      const data = await res.json()
      setGeoResults(data.results ?? [])
    } catch {
      setGeoResults([])
    } finally {
      setGeoLoading(false)
    }
  }

  const addLocation = (geo: GeoSuggestion) => {
    if (state.locations.some(l => l.id === geo.id)) return
    const loc: SelectedLocation = { ...geo, isNegative: false }
    update({ locations: [...state.locations, loc] })
  }

  const removeLocation = (id: string) => {
    update({ locations: state.locations.filter(l => l.id !== id) })
  }

  const toggleNegative = (id: string) => {
    update({
      locations: state.locations.map(l => l.id === id ? { ...l, isNegative: !l.isNegative } : l),
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
      {/* Location Search */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900">Konum Hedefleme</h4>

        {/* Country filter */}
        <div className="flex gap-2">
          <select
            className={`${inputCls} w-40 shrink-0`}
            value={state.geoSearchCountry}
            onChange={e => update({ geoSearchCountry: e.target.value })}
          >
            {COUNTRY_OPTIONS.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>

          <input
            className={`${inputCls} flex-1`}
            value={geoQuery}
            onChange={e => { setGeoQuery(e.target.value); setGeoSearched(false) }}
            onKeyDown={e => e.key === 'Enter' && searchGeo()}
            placeholder="Şehir veya bölge ara..."
          />
          <button
            type="button"
            onClick={searchGeo}
            disabled={geoLoading || geoQuery.trim().length < 2}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
          >
            {geoLoading ? '...' : <Search className="w-4 h-4" />}
          </button>
        </div>

        {geoSearched && !geoLoading && geoResults.length === 0 && (
          <p className="text-sm text-gray-500">Sonuç bulunamadı.</p>
        )}

        {geoResults.length > 0 && (
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
            {geoResults.map(r => {
              const added = state.locations.some(l => l.id === r.id)
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => addLocation(r)}
                  disabled={added}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-gray-50 ${added ? 'bg-blue-50 opacity-60' : ''}`}
                >
                  <div>
                    <span className="font-medium text-gray-900">{r.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{r.targetType}</span>
                  </div>
                  {added && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                </button>
              )
            })}
          </div>
        )}

        {state.locations.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Seçili Konumlar ({state.locations.length})</p>
            <div className="flex flex-wrap gap-2">
              {state.locations.map(loc => (
                <span
                  key={loc.id}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                    loc.isNegative
                      ? 'bg-red-100 text-red-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {loc.name}
                  {loc.isNegative && <span className="text-red-500 text-xs">(hariç)</span>}
                  <button type="button" onClick={() => toggleNegative(loc.id)} className="ml-1 hover:opacity-70 text-xs underline" title={loc.isNegative ? 'Dahil et' : 'Hariç tut'}>
                    {loc.isNegative ? 'dahil' : 'hariç'}
                  </button>
                  <button type="button" onClick={() => removeLocation(loc.id)} className="ml-0.5 hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Language Targeting */}
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Dil Hedefleme <span className="text-red-500">*</span></h4>
          <p className="text-xs text-gray-500 mt-0.5">Reklamlarınızın hangi dilde arama yapan kullanıcılara gösterileceğini seçin</p>
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
                {lang.name}
              </button>
            )
          })}
        </div>
        {state.languageIds.length === 0 && (
          <p className="text-xs text-red-500">En az 1 dil seçimi zorunludur.</p>
        )}
      </div>
    </div>
  )
}
