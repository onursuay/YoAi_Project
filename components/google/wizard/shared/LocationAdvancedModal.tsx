'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Search, MapPin } from 'lucide-react'
import { inputCls } from './WizardTypes'

const DEBOUNCE_MS = 300
const MIN_CHARS = 2

interface GeoSuggestion {
  id: string
  name: string
  countryCode: string
  targetType: string
}

interface SelectedLocation {
  id: string
  name: string
  countryCode: string
  targetType: string
  isNegative: boolean
}

interface ProximityTarget {
  lat: number
  lng: number
  radiusMeters: number
  label?: string
}

type LocationTargetingMode = 'PRESENCE_OR_INTEREST' | 'PRESENCE_ONLY'

type ModalMode = 'location' | 'radius'

export interface LocationAdvancedModalProps {
  isOpen: boolean
  onClose: () => void
  state: {
    locations: SelectedLocation[]
    proximityTargets?: ProximityTarget[]
    geoSearchCountry: string
    locationTargetingMode: LocationTargetingMode
  }
  update: (partial: any) => void
  t: (key: string, params?: any) => string
  /** Render the map component in the right panel. If not provided, radius tab is hidden. */
  renderMap?: (props: {
    mode: ModalMode
    pinCoords: { lat: number; lng: number } | null
    onPinPlace: (coords: { lat: number; lng: number }) => void
    proximityTargets: ProximityTarget[]
    addressQuery: string
    radiusMeters: number
    onSaveProximity: () => void
    radiusLabel: string
    pinModeActive: boolean
  }) => React.ReactNode
}

export default function LocationAdvancedModal({ isOpen, onClose, state, update, t, renderMap }: LocationAdvancedModalProps) {
  const [mode, setMode] = useState<ModalMode>('location')

  // Location mode
  const [locQuery, setLocQuery] = useState('')
  const [locResults, setLocResults] = useState<GeoSuggestion[]>([])
  const [locLoading, setLocLoading] = useState(false)

  // Radius mode
  const [radQuery, setRadQuery] = useState('')
  const [radResults, setRadResults] = useState<GeoSuggestion[]>([])
  const [radLoading, setRadLoading] = useState(false)
  const [radiusValue, setRadiusValue] = useState(10)
  const [radiusUnit, setRadiusUnit] = useState<'km' | 'mi'>('km')
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [pinLabel, setPinLabel] = useState('')
  const [pinModeActive, setPinModeActive] = useState(false)

  const stateRef = useRef(state)
  stateRef.current = state
  const updateRef = useRef(update)
  updateRef.current = update

  const radLockedRef = useRef(false)

  const proximityTargets = state.proximityTargets ?? []
  const hasRadius = !!renderMap

  // Location search debounce
  useEffect(() => {
    if (!isOpen || mode !== 'location') return
    const q = locQuery.trim()
    if (q.length < MIN_CHARS) { setLocResults([]); return }
    let cancelled = false
    const timer = setTimeout(() => {
      setLocLoading(true)
      const params = new URLSearchParams({ q })
      if (state.geoSearchCountry) params.set('country', state.geoSearchCountry)
      fetch(`/api/integrations/google-ads/geo-targets?${params}`)
        .then(r => r.json())
        .then(d => { if (!cancelled) setLocResults(d.results ?? []) })
        .catch(() => { if (!cancelled) setLocResults([]) })
        .finally(() => { if (!cancelled) setLocLoading(false) })
    }, DEBOUNCE_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [locQuery, isOpen, mode, state.geoSearchCountry])

  // Radius search debounce
  useEffect(() => {
    if (!isOpen || mode !== 'radius' || !hasRadius) return
    if (radLockedRef.current) { radLockedRef.current = false; return }
    const q = radQuery.trim()
    if (q.length < MIN_CHARS) { setRadResults([]); return }
    let cancelled = false
    const timer = setTimeout(() => {
      setRadLoading(true)
      const params = new URLSearchParams({ q })
      if (state.geoSearchCountry) params.set('country', state.geoSearchCountry)
      fetch(`/api/integrations/google-ads/geo-targets?${params}`)
        .then(r => r.json())
        .then(d => { if (!cancelled) setRadResults(d.results ?? []) })
        .catch(() => { if (!cancelled) setRadResults([]) })
        .finally(() => { if (!cancelled) setRadLoading(false) })
    }, DEBOUNCE_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [radQuery, isOpen, mode, state.geoSearchCountry, hasRadius])

  const addLocation = (geo: GeoSuggestion, isNegative: boolean) => {
    if (stateRef.current.locations.some(l => l.id === geo.id)) return
    const loc: SelectedLocation = {
      id: geo.id,
      name: geo.name,
      countryCode: geo.countryCode,
      targetType: geo.targetType,
      isNegative,
    }
    updateRef.current({ locations: [...stateRef.current.locations, loc] })
    setLocQuery('')
    setLocResults([])
  }

  const removeLocation = (id: string) => {
    updateRef.current({ locations: stateRef.current.locations.filter(l => l.id !== id) })
  }

  const removeProximity = (idx: number) => {
    const current = stateRef.current.proximityTargets ?? []
    updateRef.current({ proximityTargets: current.filter((_: ProximityTarget, i: number) => i !== idx) })
  }

  const selectRadiusLocation = async (geo: GeoSuggestion) => {
    radLockedRef.current = true
    setRadQuery(geo.name)
    setRadResults([])
    setPinLabel(geo.name)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geo.name)}&format=json&limit=1`)
      const data = await res.json()
      if (data[0]) {
        setPinCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
      }
    } catch { /* ignore */ }
  }

  const saveProximity = () => {
    if (!pinCoords) return
    const meters = radiusUnit === 'km' ? radiusValue * 1000 : radiusValue * 1609.34
    const prox: ProximityTarget = {
      lat: pinCoords.lat,
      lng: pinCoords.lng,
      radiusMeters: Math.round(meters),
      label: `${pinLabel || `${pinCoords.lat.toFixed(4)}, ${pinCoords.lng.toFixed(4)}`} (${radiusValue} ${radiusUnit})`,
    }
    const current = stateRef.current.proximityTargets ?? []
    updateRef.current({ proximityTargets: [...current, prox] })
    setPinCoords(null)
    setPinLabel('')
    setRadQuery('')
    setPinModeActive(false)
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
          <button type="button" onClick={() => setMode('location')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${mode === 'location' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
            {t('location.modeLocation')}
          </button>
          {hasRadius && (
            <button type="button" onClick={() => setMode('radius')}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${mode === 'radius' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
              {t('location.modeRadius')}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Left panel */}
          <div className={`${hasRadius ? 'w-80' : 'w-full'} border-r border-gray-200 overflow-y-auto p-4 space-y-4`}>
            {mode === 'location' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('location.searchLocations')}</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className={`${inputCls} pl-9`} value={locQuery} onChange={e => setLocQuery(e.target.value)}
                      placeholder={t('settings.locationSearchPlaceholder')} autoFocus />
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {locLoading ? (
                    <div className="p-4 text-sm text-gray-500">{t('location.searching')}</div>
                  ) : locResults.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">
                      {locQuery.length >= MIN_CHARS ? t('location.noResults') : t('location.typeToSearch')}
                    </div>
                  ) : locResults.map(r => {
                    const added = state.locations.some(l => l.id === r.id)
                    return (
                      <div key={r.id} className={`flex items-center justify-between px-3 py-2 hover:bg-gray-50 ${added ? 'bg-blue-50' : ''}`}>
                        <span className="text-sm font-medium truncate flex-1 mr-2">{r.name}</span>
                        {added ? <span className="text-xs text-blue-500 shrink-0">{t('location.added')}</span> : (
                          <div className="flex gap-1 shrink-0">
                            <button type="button" onClick={() => addLocation(r, false)} className="text-xs text-blue-600 hover:underline font-medium">{t('location.include')}</button>
                            <button type="button" onClick={() => addLocation(r, true)} className="text-xs text-red-600 hover:underline font-medium">{t('location.exclude')}</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {state.locations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('location.selectedTitleWithCount', { count: state.locations.length })}</p>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {state.locations.map(loc => (
                        <div key={loc.id} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${loc.isNegative ? 'bg-red-50 text-red-800 border border-red-100' : 'bg-blue-50 text-blue-800 border border-blue-100'}`}>
                          <span className="truncate flex-1">{loc.name}{loc.isNegative ? ` (${t('location.excludedParens')})` : ''}</span>
                          <button type="button" onClick={() => removeLocation(loc.id)} className="ml-1 shrink-0 hover:opacity-70">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : hasRadius ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('location.searchLocations')}</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className={`${inputCls} pl-9`} value={radQuery}
                      onChange={e => { setRadQuery(e.target.value); if (!e.target.value) { setPinCoords(null); setPinLabel('') } }}
                      placeholder={t('location.addressPlaceholder')} />
                  </div>
                  {radResults.length > 0 && (
                    <div className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
                      {radLoading ? (
                        <div className="p-3 text-sm text-gray-500">{t('location.searching')}</div>
                      ) : radResults.map(r => (
                        <button key={r.id} type="button" onClick={() => selectRadiusLocation(r)}
                          className="w-full flex items-center px-3 py-2 text-sm hover:bg-gray-50 text-left">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 mr-2 shrink-0" />
                          <span className="truncate">{r.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{t('location.pinModeHint')}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('location.radius')}</label>
                  <div className="flex gap-2">
                    <input type="number" min={1} max={500} className={`${inputCls} w-24`}
                      value={radiusValue} onChange={e => setRadiusValue(Number(e.target.value) || 10)} />
                    <select className={`${inputCls} w-20`} value={radiusUnit}
                      onChange={e => setRadiusUnit(e.target.value as 'km' | 'mi')}>
                      <option value="km">km</option>
                      <option value="mi">mi</option>
                    </select>
                  </div>
                </div>

                {pinCoords && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-sm font-medium text-emerald-800">{pinLabel || `${pinCoords.lat.toFixed(5)}, ${pinCoords.lng.toFixed(5)}`}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">{radiusValue} {radiusUnit} {t('location.radius').toLowerCase()}</p>
                    <button type="button" onClick={saveProximity}
                      className="mt-2 px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                      {t('location.saveProximity')}
                    </button>
                  </div>
                )}

                {proximityTargets.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('location.selectedTitleWithCount', { count: proximityTargets.length })}</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {proximityTargets.map((prox, idx) => (
                        <div key={idx} className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs bg-emerald-50 text-emerald-800 border border-emerald-100">
                          <span className="truncate flex-1">
                            <MapPin className="w-3 h-3 inline mr-1" />
                            {prox.label ?? `${prox.lat.toFixed(4)}, ${prox.lng.toFixed(4)}`}
                          </span>
                          <button type="button" onClick={() => removeProximity(idx)} className="ml-1 shrink-0 hover:opacity-70">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Right panel - Map (only if renderMap provided) */}
          {hasRadius && (
            <div className="flex-1 min-w-0 relative">
              {mode === 'radius' && (
                <button type="button" onClick={() => setPinModeActive(v => !v)}
                  className={`absolute top-3 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-md transition-all ${
                    pinModeActive ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}>
                  <MapPin className="w-4 h-4" />
                  {t('location.pinMode')}
                </button>
              )}
              {renderMap({
                mode,
                pinCoords,
                onPinPlace: (coords) => {
                  const meters = radiusUnit === 'km' ? radiusValue * 1000 : radiusValue * 1609.34
                  const prox: ProximityTarget = {
                    lat: coords.lat,
                    lng: coords.lng,
                    radiusMeters: Math.round(meters),
                    label: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} (${radiusValue} ${radiusUnit})`,
                  }
                  const current = stateRef.current.proximityTargets ?? []
                  updateRef.current({ proximityTargets: [...current, prox] })
                },
                proximityTargets,
                addressQuery: radQuery,
                radiusMeters: radiusUnit === 'km' ? radiusValue * 1000 : radiusValue * 1609.34,
                onSaveProximity: saveProximity,
                radiusLabel,
                pinModeActive,
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
