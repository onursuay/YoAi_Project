'use client'

import type { SavedAudienceState } from '../types'

interface StepDemographyProps {
  state: SavedAudienceState
  onChange: (updates: Partial<SavedAudienceState>) => void
}

const GENDER_OPTIONS = [
  { value: [] as number[], label: 'Tümü' },
  { value: [1], label: 'Erkek' },
  { value: [2], label: 'Kadın' },
]

export default function StepDemography({ state, onChange }: StepDemographyProps) {
  const gendersKey = state.genders.length === 0
    ? 'all'
    : state.genders.includes(1) && !state.genders.includes(2)
    ? 'male'
    : 'female'

  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">Demografi</h3>
      <p className="text-sm text-gray-500 mb-6">Yaş aralığını ve cinsiyeti belirleyin.</p>

      <div className="space-y-6">
        {/* Yaş aralığı */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Yaş Aralığı: <span className="text-primary font-semibold">{state.ageMin} – {state.ageMax}</span>
          </label>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-caption text-gray-500 mb-1">Min</label>
              <select
                value={Math.max(18, state.ageMin)}
                onChange={(e) => {
                  const v = Math.max(18, Number(e.target.value))
                  onChange({ ageMin: v, ageMax: Math.max(v, state.ageMax) })
                }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {Array.from({ length: 48 }, (_, i) => i + 18).map((age) => (
                  <option key={age} value={age}>{age}</option>
                ))}
              </select>
            </div>
            <span className="text-gray-400 pt-5">—</span>
            <div className="flex-1">
              <label className="block text-caption text-gray-500 mb-1">Max</label>
              <select
                value={Math.max(18, state.ageMax)}
                onChange={(e) => {
                  const v = Math.max(18, Number(e.target.value))
                  onChange({ ageMax: v, ageMin: Math.min(state.ageMin, v) })
                }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {Array.from({ length: 48 }, (_, i) => i + 18).map((age) => (
                  <option key={age} value={age}>{age === 65 ? '65+' : age}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Cinsiyet */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Cinsiyet</label>
          <div className="flex gap-3">
            {GENDER_OPTIONS.map(({ value, label }) => {
              const key = value.length === 0 ? 'all' : value[0] === 1 ? 'male' : 'female'
              const isSelected = gendersKey === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange({ genders: value })}
                  className={`flex-1 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
