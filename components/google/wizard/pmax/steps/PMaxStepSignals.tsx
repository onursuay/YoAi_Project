'use client'

import { useState } from 'react'
import { Radio, Users, X } from 'lucide-react'
import type { PMaxStepProps } from '../shared/PMaxWizardTypes'
import { inputCls } from '../shared/PMaxWizardTypes'

export default function PMaxStepSignals({ state, update, t }: PMaxStepProps) {
  const [inputValue, setInputValue] = useState('')

  const addSearchTheme = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const lower = trimmed.toLowerCase()
    const existingLower = new Set(state.searchThemes.map(st => st.text.trim().toLowerCase()).filter(Boolean))
    if (existingLower.has(lower)) return
    update({ searchThemes: [...state.searchThemes, { text: trimmed }] })
    setInputValue('')
  }

  const removeSearchTheme = (i: number) => {
    update({ searchThemes: state.searchThemes.filter((_, idx) => idx !== i) })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSearchTheme(inputValue)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 p-4 rounded-lg bg-blue-50 border border-blue-200">
        <Radio className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-blue-900">{t('signals.title')}</h4>
          <p className="text-sm text-blue-800 mt-1">{t('signals.description')}</p>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-900">{t('signals.audienceTitle')}</h4>
          <span className="text-sm text-gray-600">{t('signals.audienceCount', { count: state.selectedAudienceSegments.length })}</span>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
          <Users className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600">{t('signals.audienceNote')}</p>
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">{t('signals.searchThemesTitle')}</h4>
        <p className="text-xs text-gray-500 mb-3">{t('signals.searchThemesHint')}</p>
        <div className="flex gap-2 flex-wrap items-center">
          {state.searchThemes
            .map((st, i) => ({ st, i }))
            .filter(({ st }) => st.text.trim())
            .map(({ st, i }) => (
              <span
                key={`${st.text}-${i}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 text-sm border border-blue-200"
              >
                {st.text.trim()}
                <button
                  type="button"
                  onClick={() => removeSearchTheme(i)}
                  className="hover:text-red-600 p-0.5 rounded-full hover:bg-blue-100"
                  aria-label={t('signals.removeTheme')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          <div className="flex gap-2 flex-1 min-w-[200px]">
            <input
              className={inputCls}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('signals.searchThemePlaceholder')}
            />
            <button
              type="button"
              onClick={() => addSearchTheme(inputValue)}
              disabled={!inputValue.trim()}
              className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
            >
              {t('signals.addSearchTheme')}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">{t('signals.searchThemeEnterHint')}</p>
      </section>
    </div>
  )
}
