'use client'

import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import type { SavedAudienceState } from '../types'

interface StepLanguageProps {
  state: SavedAudienceState
  onChange: (updates: Partial<SavedAudienceState>) => void
}

const LANGUAGE_OPTIONS: { id: number; name: string }[] = [
  { id: 1, name: 'Türkçe' }, { id: 2, name: 'İngilizce' }, { id: 6, name: 'Almanca' },
  { id: 28, name: 'Arapça' }, { id: 31, name: 'Arnavutça' }, { id: 42, name: 'Bengalce' },
  { id: 40, name: 'Bulgarca' }, { id: 7, name: 'Çekçe' }, { id: 29, name: 'Çince (Basit)' },
  { id: 30, name: 'Çince (Geleneksel)' }, { id: 10, name: 'Danca' }, { id: 11, name: 'Fince' },
  { id: 9, name: 'Fransızca' }, { id: 45, name: 'Hintçe' }, { id: 12, name: 'Hollandaca' },
  { id: 23, name: 'İbranice' }, { id: 15, name: 'İspanyolca' }, { id: 13, name: 'İsveççe' },
  { id: 14, name: 'İtalyanca' }, { id: 26, name: 'Japonca' }, { id: 27, name: 'Korece' },
  { id: 16, name: 'Macarca' }, { id: 24, name: 'Malayca' }, { id: 17, name: 'Norveççe' },
  { id: 20, name: 'Lehçe' }, { id: 21, name: 'Portekizce' }, { id: 32, name: 'Romence' },
  { id: 19, name: 'Rusça' }, { id: 48, name: 'Tayca' }, { id: 35, name: 'Ukraynaca' },
  { id: 8, name: 'Yunanca' }, { id: 67, name: 'Vietnamca' }, { id: 25, name: 'Endonezce' },
]

export default function StepLanguage({ state, onChange }: StepLanguageProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = LANGUAGE_OPTIONS.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (id: number) => {
    const next = state.locales.includes(id)
      ? state.locales.filter((x) => x !== id)
      : [...state.locales, id]
    onChange({ locales: next })
  }

  const selectedNames = LANGUAGE_OPTIONS.filter((l) => state.locales.includes(l.id))

  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">Dil</h3>
      <p className="text-sm text-gray-500 mb-6">
        Hedef kitlenizin kullandığı dilleri seçin. Boş bırakırsanız tüm diller hedeflenir.
      </p>

      {/* Seçilenler */}
      {selectedNames.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedNames.map((l) => (
            <span key={l.id} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium">
              {l.name}
              <button type="button" onClick={() => toggle(l.id)} className="hover:text-red-500">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      <div ref={ref} className="relative">
        <div
          className="w-full min-h-[42px] px-3 py-2.5 border border-gray-300 rounded-lg cursor-pointer flex items-center"
          onClick={() => setOpen((v) => !v)}
        >
          {selectedNames.length === 0 ? (
            <span className="text-gray-400 text-sm">Tüm diller (varsayılan)</span>
          ) : (
            <span className="text-sm text-gray-700">{selectedNames.length} dil seçildi</span>
          )}
        </div>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div className="p-2 sticky top-0 bg-white border-b">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Dil ara..."
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {filtered.map((l) => {
              const checked = state.locales.includes(l.id)
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggle(l.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors ${
                    checked ? 'bg-primary/5 text-primary font-medium' : 'text-gray-700'
                  }`}
                >
                  <input type="checkbox" checked={checked} readOnly className="accent-primary" />
                  {l.name}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
