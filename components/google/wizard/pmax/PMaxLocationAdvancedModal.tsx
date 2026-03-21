'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Search, MapPin } from 'lucide-react'
import type { PMaxStepProps, PMaxSelectedLocation, PMaxProximityTarget } from './shared/PMaxWizardTypes'
import { inputCls } from './shared/PMaxWizardTypes'
import PMaxLocationMap from './PMaxLocationMap'

const DEBOUNCE_MS = 300
const MIN_CHARS = 2

interface GeoSuggestion {
  id: string
  name: string
  countryCode: string
  targetType: string
}

type ModalMode = 'location' | 'radius'

export default function PMaxLocationAdvancedModal({ isOpen, onClose, state, update, t }: PMaxStepProps & {
  isOpen: boolean
  onClose: () => void
}) {
  const [mode, setMode] = useState<ModalMode>('location')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [radiusValue, setRadiusValue] = useState(10)
  const [radiusUnit, setRadiusUnit] = useState<'km' | 'mi'>('km')
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [addressQuery, setAddressQuery] = useState('')
  const [pinModeActive, setPinModeActive] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state
  const updateRef = useRef(update)
  updateRef.current = update

  // Location search debounce
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      if (query.trim().length >= MIN_CHARS && mode === 'location') {
        setLoading(true)
        const params = new URLSearchParams({ q: query.trim() })
        if (state.geoSearchCountry) params.set('country', state.geoSearchCountry)
        fetch(`/api/integrations/google-ads/geo-targets?${params}`)
          .then(r => r.json())
          .then(d => setResults(d.results ?? []))
          .catch(() => setResults([]))
          .finally(() => setLoading(false))
      } else {
        setResults([])
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, isOpen, mode, state.geoSearchCountry])

  // Address geocode debounce (radius mode)
  useEffect(() => {
    if (mode !== 'radius') return
    const q = addressQuery.trim()
    if (q.length < 3) return
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`)
        const data = await res.json()
        if (data[0]) setPinCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
      } catch { /* ignore */ }
    }, 400)
    return () => clearTimeout(timer)
  }, [addressQuery, mode])

  const addLocation = (geo: GeoSuggestion, isNegative: boolean) => {
    if (stateRef.current.locations.some(l => l.id === geo.id)) return
    const loc: PMaxSelectedLocation = {
      id: geo.id,
      name: geo.name,
      countryCode: geo.countryCode,
      targetType: geo.targetType,
      isNegative,
    }
    updateRef.current({ locations: [...stateRef.current.locations, loc] })
    setQuery('')
    setResults([])
  }

  const saveProximity = () => {
    if (!pinCoords) return
    const meters = radiusUnit === 'km' ? radiusValue * 1000 : radiusValue * 1609.34
    const label = addressQuery.trim() || `${pinCoords.lat.toFixed(4)}, ${pinCoords.lng.toFixed(4)}`
    const prox: PMaxProximityTarget = {
      lat: pinCoords.lat,
      lng: pinCoords.lng,
      radiusMeters: Math.round(meters),
      label: `${label} (${radiusValue} ${radiusUnit})`,
    }
    updateRef.current({ proximityTargets: [...stateRef.current.proximityTargets, prox] })
    setPinCoords(null)
    setAddressQuery('')
  }

  if (!isOpen) return null

  const radiusLabel = `${radiusValue} ${radiusUnit}`

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{t('location.advancedSearchTitle')}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-200 px-6">
          <button
            type="button"
            onClick={() => setMode('location')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${mode === 'location' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
          >
            {t('location.modeLocation')}
          </button>
          <button
            type="button"
            onClick={() => setMode('radius')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${mode === 'radius' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
          >
            {t('location.modeRadius')}
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex min-h-0">
          <div className="w-80 border-r border-gray-200 overflow-y-auto p-4 space-y-4">
            {mode === 'location' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('location.searchLocations')}</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      className={`${inputCls} pl-9`}
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder={t('settings.locationSearchPlaceholder')}
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {loading ? (
                    <div className="p-4 text-sm text-gray-500">{t('location.searching')}</div>
                  ) : results.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">
                      {query.length >= MIN_CHARS ? t('location.noResults') : t('location.typeToSearch')}
                    </div>
                  ) : (
                    results.map(r => {
                      const added = state.locations.some(l => l.id === r.id)
                      return (
                        <div
                          key={r.id}
                          className={`flex items-center justify-between px-3 py-2 hover:bg-gray-50 ${added ? 'bg-blue-50' : ''}`}
                        >
                          <span className="text-sm font-medium truncate">{r.name}</span>
                          {!added && (
                            <div className="flex gap-1 shrink-0">
                              <button type="button" onClick={() => addLocation(r, false)} className="text-xs text-blue-600 hover:underline">{t('location.include')}</button>
                              <button type="button" onClick={() => addLocation(r, true)} className="text-xs text-red-600 hover:underline">{t('location.exclude')}</button>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
                {/* Seçilen konumlar */}
                {state.locations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Seçilen ({state.locations.length})
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {state.locations.map(loc => (
                        <div key={loc.id} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${loc.isNegative ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
                          <span className="truncate flex-1">{loc.name}{loc.isNegative ? ' (Hariç)' : ''}</span>
                          <button type="button" onClick={() => updateRef.current({ locations: stateRef.current.locations.filter(l => l.id !== loc.id) })} className="ml-1 shrink-0 hover:opacity-70"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('location.addressOrCoords')}</label>
                  <input
                    className={inputCls}
                    value={addressQuery}
                    onChange={e => setAddressQuery(e.target.value)}
                    placeholder={t('location.addressPlaceholder')}
                  />
                  <p className="text-xs text-gray-400 mt-1">Haritaya tıklayarak da konum seçebilirsiniz</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('location.radius')}</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      className={`${inputCls} w-24`}
                      value={radiusValue}
                      onChange={e => setRadiusValue(Number(e.target.value) || 10)}
                    />
                    <select
                      className={`${inputCls} w-20`}
                      value={radiusUnit}
                      onChange={e => setRadiusUnit(e.target.value as 'km' | 'mi')}
                    >
                      <option value="km">km</option>
                      <option value="mi">mi</option>
                    </select>
                  </div>
                </div>
                {pinCoords && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-sm font-medium text-emerald-800">
                      {pinCoords.lat.toFixed(5)}, {pinCoords.lng.toFixed(5)}
                    </p>
                    <button
                      type="button"
                      onClick={saveProximity}
                      className="mt-2 px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                      {t('location.saveProximity')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex-1 min-w-0 min-h-[300px] relative">
            {mode === 'radius' && (
              <button
                type="button"
                onClick={() => setPinModeActive(v => !v)}
                className={`absolute top-3 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-md transition-colors ${pinModeActive ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
              >
                <MapPin className="w-4 h-4" />
                Sabitleme modu
              </button>
            )}
            <PMaxLocationMap
              mode={mode}
              pinCoords={pinCoords}
              onPinPlace={coords => { setPinCoords(coords); setPinModeActive(false) }}
              proximityTargets={state.proximityTargets}
              addressQuery={addressQuery}
              radiusMeters={radiusUnit === 'km' ? radiusValue * 1000 : radiusValue * 1609.34}
              onSaveProximity={saveProximity}
              radiusLabel={radiusLabel}
              pinModeActive={pinModeActive}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
