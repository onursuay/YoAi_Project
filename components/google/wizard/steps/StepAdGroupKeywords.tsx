'use client'

import { useState } from 'react'
import { Loader2, Plus, Sparkles } from 'lucide-react'
import type { StepProps, MatchType } from '../shared/WizardTypes'
import { inputCls } from '../shared/WizardTypes'

interface KeywordIdea {
  text: string
  avgMonthlySearches: number
  competition: string
  highTopOfPageBidMicros: number
}

export default function StepAdGroupKeywords({ state, update, t }: StepProps) {
  const [suggestions, setSuggestions] = useState<KeywordIdea[]>([])
  const [sugLoading, setSugLoading] = useState(false)
  const [sugError, setSugError] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const fetchSuggestions = async () => {
    const keywords = state.keywordsRaw.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 10)
    if (keywords.length === 0 && !state.finalUrl.startsWith('http')) return

    setSugLoading(true)
    setSugError(null)
    setShowSuggestions(true)
    try {
      const body: Record<string, unknown> = {}
      if (keywords.length > 0) body.keywords = keywords
      else if (state.finalUrl.startsWith('http')) body.urls = [state.finalUrl]
      if (state.locations.length > 0) body.locationIds = state.locations.filter(l => !l.isNegative).map(l => l.id)
      if (state.languageIds.length > 0) body.languageId = state.languageIds[0]

      const res = await fetch('/api/integrations/google-ads/tools/keyword-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setSugError(data.error ?? 'Öneriler yüklenemedi'); return }
      setSuggestions(data.ideas ?? data.results ?? [])
    } catch {
      setSugError('Öneriler yüklenemedi')
    } finally {
      setSugLoading(false)
    }
  }

  const addSuggestion = (text: string) => {
    const current = state.keywordsRaw.trim()
    update({ keywordsRaw: current ? `${current}\n${text}` : text })
  }

  const competitionColor = (c: string) => {
    if (c === 'LOW') return 'text-green-600 bg-green-50'
    if (c === 'MEDIUM') return 'text-amber-600 bg-amber-50'
    if (c === 'HIGH') return 'text-red-600 bg-red-50'
    return 'text-gray-500 bg-gray-50'
  }

  const competitionLabel = (c: string) => {
    if (c === 'LOW') return 'Düşük'
    if (c === 'MEDIUM') return 'Orta'
    if (c === 'HIGH') return 'Yüksek'
    return '-'
  }

  return (
    <div className="space-y-4">
      <Field label={t('adgroup.name')} required>
        <input className={inputCls} value={state.adGroupName} onChange={e => update({ adGroupName: e.target.value })} placeholder={t('adgroup.namePlaceholder')} />
      </Field>

      <Field label={t('adgroup.defaultMatchType')}>
        <select className={inputCls} value={state.defaultMatchType} onChange={e => update({ defaultMatchType: e.target.value as MatchType })}>
          <option value="BROAD">{t('adgroup.matchTypes.BROAD')}</option>
          <option value="PHRASE">{t('adgroup.matchTypes.PHRASE')}</option>
          <option value="EXACT">{t('adgroup.matchTypes.EXACT')}</option>
        </select>
      </Field>

      <Field label={`${t('adgroup.keywords')} (${t('adgroup.keywordsNote')})`} required>
        <textarea
          className={`${inputCls} h-28 resize-none font-mono text-sm`}
          value={state.keywordsRaw}
          onChange={e => update({ keywordsRaw: e.target.value })}
          placeholder={t('adgroup.keywordsPlaceholder')}
        />
      </Field>

      {/* Keyword Suggestions */}
      <button
        type="button"
        onClick={fetchSuggestions}
        disabled={sugLoading}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
      >
        {sugLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        Keyword Önerisi Al
      </button>

      {showSuggestions && !sugLoading && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {sugError && <p className="p-3 text-sm text-red-500">{sugError}</p>}
          {!sugError && suggestions.length === 0 && <p className="p-3 text-sm text-gray-500">Öneri bulunamadı.</p>}
          {suggestions.length > 0 && (
            <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
              <div className="grid grid-cols-[1fr_80px_70px_60px] gap-2 px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500">
                <span>Anahtar Kelime</span>
                <span className="text-right">Ort. Arama</span>
                <span className="text-center">Rekabet</span>
                <span />
              </div>
              {suggestions.slice(0, 20).map((idea, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_70px_60px] gap-2 items-center px-3 py-2 text-sm hover:bg-gray-50">
                  <span className="text-gray-900 truncate">{idea.text}</span>
                  <span className="text-right text-gray-600">{(idea.avgMonthlySearches ?? 0).toLocaleString('tr-TR')}</span>
                  <span className="text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${competitionColor(idea.competition)}`}>
                      {competitionLabel(idea.competition)}
                    </span>
                  </span>
                  <button type="button" onClick={() => addSuggestion(idea.text)} className="text-blue-600 hover:text-blue-800">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Field label={t('adgroup.negativeKeywords')}>
        <textarea
          className={`${inputCls} h-20 resize-none font-mono text-sm`}
          value={state.negativeKeywordsRaw}
          onChange={e => update({ negativeKeywordsRaw: e.target.value })}
          placeholder={t('adgroup.negativeKeywordsPlaceholder')}
        />
      </Field>

      <Field label={t('adgroup.cpcBid')}>
        <input className={inputCls} type="number" min="0" step="0.01" value={state.cpcBid} onChange={e => update({ cpcBid: e.target.value })} placeholder={t('adgroup.cpcBidPlaceholder')} />
      </Field>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
