'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Search } from 'lucide-react'
import type { LookalikeState } from '../types'

interface StepCountryProps {
  state: LookalikeState
  onChange: (updates: Partial<LookalikeState>) => void
}

const POPULAR_COUNTRIES = [
  { code: 'TR', name: 'Türkiye' },
  { code: 'US', name: 'Amerika Birleşik Devletleri' },
  { code: 'DE', name: 'Almanya' },
  { code: 'GB', name: 'Birleşik Krallık' },
  { code: 'FR', name: 'Fransa' },
  { code: 'NL', name: 'Hollanda' },
  { code: 'IT', name: 'İtalya' },
  { code: 'ES', name: 'İspanya' },
  { code: 'SA', name: 'Suudi Arabistan' },
  { code: 'AE', name: 'Birleşik Arap Emirlikleri' },
  { code: 'CA', name: 'Kanada' },
  { code: 'AU', name: 'Avustralya' },
  { code: 'BR', name: 'Brezilya' },
  { code: 'JP', name: 'Japonya' },
  { code: 'KR', name: 'Güney Kore' },
  { code: 'IN', name: 'Hindistan' },
  { code: 'MX', name: 'Meksika' },
  { code: 'PL', name: 'Polonya' },
  { code: 'SE', name: 'İsveç' },
  { code: 'NO', name: 'Norveç' },
  { code: 'AT', name: 'Avusturya' },
  { code: 'BE', name: 'Belçika' },
  { code: 'CH', name: 'İsviçre' },
  { code: 'DK', name: 'Danimarka' },
  { code: 'GR', name: 'Yunanistan' },
  { code: 'PT', name: 'Portekiz' },
  { code: 'RO', name: 'Romanya' },
  { code: 'BG', name: 'Bulgaristan' },
  { code: 'AZ', name: 'Azerbaycan' },
  { code: 'GE', name: 'Gürcistan' },
]

export default function StepCountry({ state, onChange }: StepCountryProps) {
  const [search, setSearch] = useState('')

  const filtered = POPULAR_COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (code: string) => {
    const next = state.countries.includes(code)
      ? state.countries.filter((c) => c !== code)
      : [...state.countries, code]
    onChange({ countries: next })
  }

  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">Ülke Seçimi</h3>
      <p className="text-sm text-gray-500 mb-6">
        Lookalike kitlenin hedefleyeceği ülkeleri seçin. Birden fazla ülke seçebilirsiniz.
      </p>

      {/* Seçilen ülkeler */}
      {state.countries.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {state.countries.map((code) => {
            const country = POPULAR_COUNTRIES.find((c) => c.code === code)
            return (
              <span key={code} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium">
                {country?.name ?? code}
                <button
                  type="button"
                  onClick={() => toggle(code)}
                  className="hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Arama */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ülke ara..."
          className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      {/* Liste */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
        {filtered.map((c) => {
          const selected = state.countries.includes(c.code)
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => toggle(c.code)}
              className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                selected
                  ? 'border-primary bg-primary/5 text-primary font-medium'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              {c.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
