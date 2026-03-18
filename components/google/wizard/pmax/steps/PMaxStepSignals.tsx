'use client'

import { Radio } from 'lucide-react'
import type { PMaxStepProps } from '../shared/PMaxWizardTypes'

export default function PMaxStepSignals({ state, update, t }: PMaxStepProps) {
  const addSearchTheme = () => {
    update({ searchThemes: [...state.searchThemes, { text: '' }] })
  }
  const removeSearchTheme = (i: number) => {
    update({ searchThemes: state.searchThemes.filter((_, idx) => idx !== i) })
  }
  const setSearchTheme = (i: number, text: string) => {
    const next = [...state.searchThemes]
    next[i] = { text }
    update({ searchThemes: next })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 p-4 rounded-lg bg-blue-50 border border-blue-200">
        <Radio className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-blue-900">{t('signals.title')}</h4>
          <p className="text-sm text-blue-800 mt-1">{t('signals.description')}</p>
        </div>
      </div>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">{t('signals.searchThemesTitle')}</h4>
        <p className="text-xs text-gray-500 mb-3">{t('signals.searchThemesHint')}</p>
        <div className="space-y-2">
          {state.searchThemes.map((st, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={st.text}
                onChange={e => setSearchTheme(i, e.target.value)}
                placeholder={t('signals.searchThemePlaceholder')}
              />
              <button
                type="button"
                onClick={() => removeSearchTheme(i)}
                className="px-2 text-gray-500 hover:text-red-600 shrink-0"
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" onClick={addSearchTheme} className="text-sm text-blue-600 hover:underline">
            + {t('signals.addSearchTheme')}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">{t('signals.placeholderNote')}</p>
      </section>
    </div>
  )
}
