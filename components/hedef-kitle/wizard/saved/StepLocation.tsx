'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, MapPin } from 'lucide-react'
import type { SavedAudienceState, LocationItem } from '../types'

interface StepLocationProps {
  state: SavedAudienceState
  onChange: (updates: Partial<SavedAudienceState>) => void
}

interface LocationResult {
  key: string
  name: string
  type: 'country' | 'city' | 'region'
  country_code?: string
  country_name?: string
}

export default function StepLocation({ state, onChange }: StepLocationProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<LocationResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const doSearch = (q: string) => {
    if (q.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }
    setLoading(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/meta/targeting/locations?q=${encodeURIComponent(q)}`)
        if (!res.ok) throw new Error()
        const json = await res.json()
        const items: LocationResult[] = (json.data ?? []).map((d: Record<string, string>) => ({
          key: d.key,
          name: d.name,
          type: d.type as LocationResult['type'],
          country_code: d.country_code,
          country_name: d.country_name,
        }))
        setResults(items)
        setShowDropdown(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  const addLocation = (loc: LocationResult) => {
    const exists = state.locations.some((l) => l.key === loc.key)
    if (exists) return
    const item: LocationItem = {
      type: loc.type,
      key: loc.key,
      name: loc.country_name ? `${loc.name}, ${loc.country_name}` : loc.name,
    }
    onChange({ locations: [...state.locations, item] })
    setSearch('')
    setShowDropdown(false)
  }

  const removeLocation = (key: string) => {
    onChange({ locations: state.locations.filter((l) => l.key !== key) })
  }

  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">Konum</h3>
      <p className="text-sm text-gray-500 mb-6">
        Hedef kitlenizin konumunu belirleyin. Ülke, şehir veya bölge ekleyebilirsiniz.
      </p>

      {/* Seçilenler */}
      {state.locations.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {state.locations.map((loc) => (
            <span key={loc.key} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium">
              <MapPin className="w-3.5 h-3.5" />
              {loc.name}
              <button type="button" onClick={() => removeLocation(loc.key)} className="hover:text-red-500">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Arama */}
      <div ref={containerRef} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            doSearch(e.target.value)
          }}
          onFocus={() => { if (results.length > 0) setShowDropdown(true) }}
          placeholder="Ülke, şehir veya bölge ara..."
          className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />

        {showDropdown && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-3 text-sm text-gray-400 text-center">Aranıyor...</div>
            ) : results.length === 0 ? (
              <div className="p-3 text-sm text-gray-400 text-center">Sonuç bulunamadı</div>
            ) : (
              results.map((r) => {
                const already = state.locations.some((l) => l.key === r.key)
                return (
                  <button
                    key={r.key}
                    type="button"
                    disabled={already}
                    onClick={() => addLocation(r)}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                      already ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <span className="text-gray-900">{r.name}</span>
                      {r.country_name && (
                        <span className="text-gray-400 ml-1">({r.country_name})</span>
                      )}
                      <span className="text-caption text-gray-400 ml-2">{r.type}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      {state.locations.length === 0 && (
        <p className="text-caption text-gray-400 mt-3">
          Konum eklenmezse varsayılan olarak Türkiye hedeflenir.
        </p>
      )}
    </div>
  )
}
