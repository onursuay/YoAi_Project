'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, Target } from 'lucide-react'
import type { SavedAudienceState, InterestItem } from '../types'

interface StepInterestsProps {
  state: SavedAudienceState
  onChange: (updates: Partial<SavedAudienceState>) => void
}

interface InterestResult {
  id: string
  name: string
  audience_size_lower_bound?: number
  audience_size_upper_bound?: number
  path?: string[]
}

export default function StepInterests({ state, onChange }: StepInterestsProps) {
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

  const addInterest = (item: InterestResult) => {
    if (state.interests.some((i) => i.id === item.id)) return
    const interest: InterestItem = { id: item.id, name: item.name }
    onChange({ interests: [...state.interests, interest] })
    setSearch('')
    setShowDropdown(false)
  }

  const removeInterest = (id: string) => {
    onChange({ interests: state.interests.filter((i) => i.id !== id) })
  }

  const formatSize = (lower?: number, upper?: number) => {
    if (!lower && !upper) return ''
    const fmt = (n: number) => {
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
      if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
      return n.toString()
    }
    if (lower && upper) return `${fmt(lower)} - ${fmt(upper)}`
    return lower ? `${fmt(lower)}+` : ''
  }

  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">İlgi Alanları ve Davranışlar</h3>
      <p className="text-sm text-gray-500 mb-6">
        Meta&apos;nın detaylı hedefleme taksonomisinden ilgi alanları ve davranışlar ekleyin.
      </p>

      {/* Seçilenler */}
      {state.interests.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {state.interests.map((i) => (
            <span key={i.id} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium">
              <Target className="w-3.5 h-3.5" />
              {i.name}
              <button type="button" onClick={() => removeInterest(i.id)} className="hover:text-red-500">
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
          placeholder="İlgi alanı veya davranış ara..."
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
                const already = state.interests.some((i) => i.id === r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={already}
                    onClick={() => addInterest(r)}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                      already ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-gray-900">{r.name}</span>
                        {r.path && r.path.length > 0 && (
                          <p className="text-caption text-gray-400">{r.path.join(' > ')}</p>
                        )}
                      </div>
                      {(r.audience_size_lower_bound || r.audience_size_upper_bound) && (
                        <span className="text-caption text-gray-400 shrink-0 ml-2">
                          {formatSize(r.audience_size_lower_bound, r.audience_size_upper_bound)}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Advantage+ toggle */}
      <div className="mt-6 flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div>
          <p className="text-sm font-medium text-gray-900">Advantage+ Hedef Kitle</p>
          <p className="text-caption text-gray-500">Meta AI, kitlenizi otomatik olarak genişletebilir.</p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ advantageAudience: !state.advantageAudience })}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            state.advantageAudience ? 'bg-primary' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              state.advantageAudience ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  )
}
