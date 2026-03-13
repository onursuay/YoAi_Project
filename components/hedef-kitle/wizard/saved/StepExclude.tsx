'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, ShieldOff } from 'lucide-react'
import type { SavedAudienceState, InterestItem } from '../types'

interface StepExcludeProps {
  state: SavedAudienceState
  onChange: (updates: Partial<SavedAudienceState>) => void
}

interface InterestResult {
  id: string
  name: string
  path?: string[]
}

export default function StepExclude({ state, onChange }: StepExcludeProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<InterestResult[]>([])
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
        const res = await fetch(`/api/meta/targeting/interests?q=${encodeURIComponent(q)}`)
        if (!res.ok) throw new Error()
        const json = await res.json()
        setResults(json.data ?? [])
        setShowDropdown(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  const addExclude = (item: InterestResult) => {
    if (state.excludeInterests.some((i) => i.id === item.id)) return
    // Çakışma kontrolü: include ile aynı interest eklenmişse uyarı
    const conflict = state.interests.some((i) => i.id === item.id)
    if (conflict) return // Sessizce engelle
    const interest: InterestItem = { id: item.id, name: item.name }
    onChange({ excludeInterests: [...state.excludeInterests, interest] })
    setSearch('')
    setShowDropdown(false)
  }

  const removeExclude = (id: string) => {
    onChange({ excludeInterests: state.excludeInterests.filter((i) => i.id !== id) })
  }

  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">Hariç Tut (Opsiyonel)</h3>
      <p className="text-sm text-gray-500 mb-6">
        Hedef kitlenizden hariç tutmak istediğiniz ilgi alanlarını veya davranışları ekleyin.
      </p>

      {/* Seçilenler */}
      {state.excludeInterests.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {state.excludeInterests.map((i) => (
            <span key={i.id} className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-sm font-medium">
              <ShieldOff className="w-3.5 h-3.5" />
              {i.name}
              <button type="button" onClick={() => removeExclude(i.id)} className="hover:text-red-800">
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
          placeholder="Hariç tutulacak ilgi alanı veya davranış ara..."
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
                const alreadyExcluded = state.excludeInterests.some((i) => i.id === r.id)
                const alreadyIncluded = state.interests.some((i) => i.id === r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={alreadyExcluded || alreadyIncluded}
                    onClick={() => addExclude(r)}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                      alreadyExcluded || alreadyIncluded ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    <span className="text-gray-900">{r.name}</span>
                    {alreadyIncluded && (
                      <span className="text-caption text-amber-600 ml-2">(zaten dahil edilmiş)</span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      {state.excludeInterests.length === 0 && (
        <p className="text-caption text-gray-400 mt-3">
          Bu adım opsiyoneldir. Hariç tutma eklemeden devam edebilirsiniz.
        </p>
      )}
    </div>
  )
}
