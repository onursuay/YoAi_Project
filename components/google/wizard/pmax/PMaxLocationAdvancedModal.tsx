'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search } from 'lucide-react'
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
  const pinCoordsRef = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      if (query.trim().length >= MIN_CHARS && mode === 'location') {
        setLoading(true)
        const params = new URLSearchParams({ q: query.trim() })
        if (state.geoSearchCountry) params.set('country', state.geoSearchCountry)
        fetch(`/api/integrations/google-ads/geo-targets?${params}`)
          .then(r => r.json())
          .then(d => {
            setResults(d.results ?? [])
          })
          .catch(() => setResults([]))
          .finally(() => setLoading(false))
      } else {
        setResults([])
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, isOpen, mode, state.geoSearchCountry])

  useEffect(() => {
    if (!isOpen || mode !== 'radius') return
    const trimmedAddress = addressQuery.trim()
    if (trimmedAddress.length < 3) return

    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        q: trimmedAddress,
        format: 'json',
        limit: '1',
      })
      fetch(`https://nominatim.openstreetmap.org/search?${params}`)
        .then(r => r.json())
        .then(d => {
          const result = Array.isArray(d) ? d[0] : null
          if (!result?.lat || !result?.lon) return
          const coords = {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
          }
          pinCoordsRef.current = coords
          setPinCoords(coords)
        })
        .catch(() => {})
    }, 400)

    return () => clearTimeout(timer)
  }, [addressQuery, isOpen, mode])

  const handlePinPlace = useCallback((coords: { lat: number; lng: number }) => {
    pinCoordsRef.current = coords
    setPinCoords(coords)
  }, [])

  const addLocation = (geo: GeoSuggestion, isNegative: boolean) => {
    if (state.locations.some(l => l.id === geo.id)) return
    const loc: PMaxSelectedLocation = {
      id: geo.id,
      name: geo.name,
      countryCode: geo.countryCode,
      targetType: geo.targetType,
      isNegative,
    }
    update({ locations: [...state.locations, loc] })
    setQuery('')
    setResults([])
  }

  const saveProximity = useCallback(() => {
    const activePin = pinCoordsRef.current ?? pinCoords
    if (!activePin) return
    const meters = radiusUnit === 'km' ? radiusValue * 1000 : radiusValue * 1609.34
    const label = addressQuery.trim() || `${activePin.lat.toFixed(4)}, ${activePin.lng.toFixed(4)}`
    const prox: PMaxProximityTarget = {
      lat: activePin.lat,
      lng: activePin.lng,
      radiusMeters: Math.round(meters),
      label: `${label} (${radiusValue} ${radiusUnit})`,
    }
    update({ proximityTargets: [...state.proximityTargets, prox] })
    setPinCoords(null)
    pinCoordsRef.current = null
    setAddressQuery('')
  }, [addressQuery, pinCoords, radiusUnit, radiusValue, state.proximityTargets, update])

  if (!isOpen) return null

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

        {/* Mode tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            type="button"
            onClick={() => setMode('location')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
              mode === 'location' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            {t('location.modeLocation')}
          </button>
          <button
            type="button"
            onClick={() => setMode('radius')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
              mode === 'radius' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            {t('location.modeRadius')}
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Left panel */}
          <div className="w-80 border-r border-gray-200 overflow-y-auto p-4 space-y-4">
            {mode === 'location' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('location.searchLocations')}
                  </label>
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
                          className={`flex items-center justify-between px-3 py-2 hover:bg-gray-50 ${
                            added ? 'bg-blue-50' : ''
                          }`}
                        >
                          <span className="text-sm font-medium truncate">{r.name}</span>
                          {!added && (
                            <div className="flex gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => addLocation(r, false)}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                {t('location.include')}
                              </button>
                              <button
                                type="button"
                                onClick={() => addLocation(r, true)}
                                className="text-xs text-red-600 hover:underline"
                              >
                                {t('location.exclude')}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('location.addressOrCoords')}
                  </label>
                  <input
                    className={inputCls}
                    value={addressQuery}
                    onChange={e => setAddressQuery(e.target.value)}
                    placeholder={t('location.addressPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('location.radius')}
                  </label>
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
                      {t('location.pinPlaced')}: {pinCoords.lat.toFixed(4)}, {pinCoords.lng.toFixed(4)}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right panel - Map */}
          <div className="flex-1 min-w-0 min-h-[300px]">
            <PMaxLocationMap
              mode={mode}
              pinCoords={pinCoords}
              onPinPlace={handlePinPlace}
              onSaveProximity={saveProximity}
              proximityTargets={state.proximityTargets}
              addressQuery={addressQuery}
              radiusLabel={`${radiusValue} ${radiusUnit}`}
              radiusMeters={
                radiusUnit === 'km' ? radiusValue * 1000 : radiusValue * 1609.34
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
