'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { Loader2, Plus, Sparkles, AlertTriangle } from 'lucide-react'
import type { StepProps, MatchType } from '../shared/WizardTypes'
import { inputCls } from '../shared/WizardTypes'
import { parseKeywords } from '../shared/WizardHelpers'

interface KeywordIdea {
  text: string
  avgMonthlySearches: number
  competition: string
  highTopOfPageBidMicros: number
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

function InlineWarning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      {children}
    </div>
  )
}

export default function StepKeywordsAndAds({ state, update, t }: StepProps) {
  const locale = useLocale()
  const [suggestions, setSuggestions] = useState<KeywordIdea[]>([])
  const [sugLoading, setSugLoading] = useState(false)
  const [sugError, setSugError] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const localeStr = locale === 'en' ? 'en-US' : 'tr-TR'

  // UI-only: parsed keywords for preview
  const parsedKeywords = parseKeywords(state.keywordsRaw, state.defaultMatchType)

  // UI-only: RSA validation hints (duplicates, overflow)
  const headlines = state.headlines.map(h => h.trim()).filter(Boolean)
  const descriptions = state.descriptions.map(d => d.trim()).filter(Boolean)
  const headlineSet = new Set(headlines.map(x => x.toLowerCase()))
  const descriptionSet = new Set(descriptions.map(x => x.toLowerCase()))
  const hasDuplicateHeadlines = headlineSet.size < headlines.length
  const hasDuplicateDescriptions = descriptionSet.size < descriptions.length
  const hasHeadlineOverflow = state.headlines.some(h => h.length > 30)
  const hasDescriptionOverflow = state.descriptions.some(d => d.length > 90)
  const hasInvalidUrl = state.finalUrl.length > 0 && !state.finalUrl.startsWith('http')

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
      if (!res.ok) { setSugError(data.error ?? t('adgroup.suggestionsError')); return }
      setSuggestions(data.ideas ?? data.results ?? [])
    } catch {
      setSugError(t('adgroup.suggestionsError'))
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
    if (c === 'LOW') return t('adgroup.competition.LOW')
    if (c === 'MEDIUM') return t('adgroup.competition.MEDIUM')
    if (c === 'HIGH') return t('adgroup.competition.HIGH')
    return '-'
  }

  return (
    <div className="space-y-6">
      {/* 1. Ad group */}
      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('adgroup.sectionTitle')}</h4>
        <Field label={t('adgroup.name')} required>
          <input
            className={inputCls}
            value={state.adGroupName}
            onChange={e => update({ adGroupName: e.target.value })}
            placeholder={t('adgroup.namePlaceholder')}
          />
        </Field>
        <Field label={t('adgroup.defaultMatchType')}>
          <select
            className={`${inputCls} max-w-[200px]`}
            value={state.defaultMatchType}
            onChange={e => update({ defaultMatchType: e.target.value as MatchType })}
          >
            <option value="BROAD">{t('adgroup.matchTypes.BROAD')}</option>
            <option value="PHRASE">{t('adgroup.matchTypes.PHRASE')}</option>
            <option value="EXACT">{t('adgroup.matchTypes.EXACT')}</option>
          </select>
        </Field>
        <Field label={t('adgroup.cpcBid')}>
          <input
            className={`${inputCls} max-w-[200px]`}
            type="number"
            min="0"
            step="0.01"
            value={state.cpcBid}
            onChange={e => update({ cpcBid: e.target.value })}
            placeholder={t('adgroup.cpcBidPlaceholder')}
          />
        </Field>
      </section>

      {/* 2. Keywords */}
      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('adgroup.keywordsSectionTitle')}</h4>
        <p className="text-xs text-gray-500 mb-2">{t('adgroup.keywordsNote')}</p>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-medium text-gray-500">{t('adgroup.defaultLabel')}</span>
          <span className="inline-flex px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">
            {t(`adgroup.matchTypesShort.${state.defaultMatchType}`)}
          </span>
        </div>
        <textarea
          className={`${inputCls} h-28 resize-none font-mono text-sm`}
          value={state.keywordsRaw}
          onChange={e => update({ keywordsRaw: e.target.value })}
          placeholder={t('adgroup.keywordsPlaceholder')}
        />
        {parsedKeywords.length > 0 && (
          <div className="mt-2 p-2 rounded-lg bg-gray-50 border border-gray-200">
            <p className="text-xs font-medium text-gray-500 mb-2">{t('adgroup.keywordCount', { count: parsedKeywords.length })}</p>
            <div className="flex flex-wrap gap-1">
              {parsedKeywords.map((kw, i) => (
                <span
                  key={i}
                  className="inline-flex px-2 py-0.5 rounded text-xs font-mono bg-white border border-gray-200 text-gray-700"
                >
                  {kw.text}
                  <span className="ml-1 text-gray-400">({t(`adgroup.matchTypesShort.${kw.matchType}`)})</span>
                </span>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={fetchSuggestions}
          disabled={sugLoading}
          className="mt-2 flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
        >
          {sugLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {t('adgroup.keywordSuggestionBtn')}
        </button>
        {showSuggestions && !sugLoading && (
          <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
            {sugError && <p className="p-3 text-sm text-red-500">{sugError}</p>}
            {!sugError && suggestions.length === 0 && <p className="p-3 text-sm text-gray-500">{t('adgroup.suggestionsEmpty')}</p>}
            {suggestions.length > 0 && (
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                <div className="grid grid-cols-[1fr_80px_70px_60px] gap-2 px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500">
                  <span>{t('adgroup.tableKeyword')}</span>
                  <span className="text-right">{t('adgroup.tableAvgSearch')}</span>
                  <span className="text-center">{t('adgroup.tableCompetition')}</span>
                  <span />
                </div>
                {suggestions.slice(0, 20).map((idea, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_70px_60px] gap-2 items-center px-3 py-2 text-sm hover:bg-gray-50">
                    <span className="text-gray-900 truncate">{idea.text}</span>
                    <span className="text-right text-gray-600">{(idea.avgMonthlySearches ?? 0).toLocaleString(localeStr)}</span>
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
      </section>

      {/* 3. Negative keywords */}
      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('adgroup.negativeKeywordsSectionTitle')}</h4>
        <Field label={t('adgroup.negativeKeywords')}>
          <textarea
            className={`${inputCls} h-20 resize-none font-mono text-sm`}
            value={state.negativeKeywordsRaw}
            onChange={e => update({ negativeKeywordsRaw: e.target.value })}
            placeholder={t('adgroup.negativeKeywordsPlaceholder')}
          />
        </Field>
      </section>

      {/* 4. URL & display path */}
      <section className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('adgroup.urlPathSectionTitle')}</h4>
        <Field label={t('ad.finalUrl')} required>
          <input
            className={`${inputCls} ${hasInvalidUrl ? 'border-amber-500 ring-1 ring-amber-500' : ''}`}
            type="url"
            value={state.finalUrl}
            onChange={e => update({ finalUrl: e.target.value })}
            placeholder={t('ad.finalUrlPlaceholder')}
          />
          {hasInvalidUrl && (
            <InlineWarning>{t('validation.urlRequired')}</InlineWarning>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label={t('ad.path1')}>
            <input className={inputCls} maxLength={15} value={state.path1} onChange={e => update({ path1: e.target.value })} placeholder={t('ad.path1Placeholder')} />
          </Field>
          <Field label={t('ad.path2')}>
            <input className={inputCls} maxLength={15} value={state.path2} onChange={e => update({ path2: e.target.value })} placeholder={t('ad.path2Placeholder')} />
          </Field>
        </div>
      </section>

      {/* 5. Headlines (RSA) */}
      <section className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900 mb-1">{t('adgroup.headlinesSectionTitle')}</h4>
        <p className="text-xs text-gray-500 mb-3">{t('adgroup.headlinesHint')}</p>
        <p className="text-xs font-medium text-gray-600 mb-2">
          {t('adgroup.headlinesCount', { count: headlines.length })}{(headlines.length < 3) && <span className="text-amber-600"> {t('adgroup.headlinesMinRequired')}</span>}
        </p>
        <div className="space-y-2">
          {state.headlines.map((h, i) => {
            const isRequired = i < 3
            const isOverflow = h.length > 30
            return (
              <div key={i}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs w-6 ${isRequired ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                    {i + 1}{isRequired ? ' *' : ''}
                  </span>
                  <input
                    className={`${inputCls} flex-1 ${isOverflow ? 'border-amber-500' : ''}`}
                    maxLength={30}
                    value={h}
                    onChange={e => {
                      const hs = [...state.headlines]
                      hs[i] = e.target.value
                      if (i === hs.length - 1 && e.target.value && hs.length < 15) hs.push('')
                      update({ headlines: hs })
                    }}
                    placeholder={isRequired ? t('ad.headlineRequired', { n: i + 1 }) : t('ad.headlineOptional', { n: i + 1 })}
                  />
                  <span className={`text-xs w-8 text-right ${isOverflow ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                    {h.length}/30
                  </span>
                </div>
                {isOverflow && (
                  <InlineWarning>{t('validation.headlineMaxLength')}</InlineWarning>
                )}
              </div>
            )
          })}
        </div>
        {hasDuplicateHeadlines && (
          <InlineWarning>{t('validation.duplicateHeadlines')}</InlineWarning>
        )}
      </section>

      {/* 6. Descriptions (RSA) */}
      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-1">{t('adgroup.descriptionsSectionTitle')}</h4>
        <p className="text-xs text-gray-500 mb-3">{t('adgroup.descriptionsHint')}</p>
        <p className="text-xs font-medium text-gray-600 mb-2">
          {t('adgroup.descriptionsCount', { count: descriptions.length })}{(descriptions.length < 2) && <span className="text-amber-600"> {t('adgroup.descriptionsMinRequired')}</span>}
        </p>
        <div className="space-y-2">
          {state.descriptions.map((d, i) => {
            const isRequired = i < 2
            const isOverflow = d.length > 90
            return (
              <div key={i}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs w-6 ${isRequired ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                    {i + 1}{isRequired ? ' *' : ''}
                  </span>
                  <input
                    className={`${inputCls} flex-1 ${isOverflow ? 'border-amber-500' : ''}`}
                    maxLength={90}
                    value={d}
                    onChange={e => {
                      const ds = [...state.descriptions]
                      ds[i] = e.target.value
                      if (i === ds.length - 1 && e.target.value && ds.length < 4) ds.push('')
                      update({ descriptions: ds })
                    }}
                    placeholder={isRequired ? t('ad.descriptionRequired', { n: i + 1 }) : t('ad.descriptionOptional', { n: i + 1 })}
                  />
                  <span className={`text-xs w-8 text-right ${isOverflow ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                    {d.length}/90
                  </span>
                </div>
                {isOverflow && (
                  <InlineWarning>{t('validation.descriptionMaxLength')}</InlineWarning>
                )}
              </div>
            )
          })}
        </div>
        {hasDuplicateDescriptions && (
          <InlineWarning>{t('validation.duplicateDescriptions')}</InlineWarning>
        )}
      </section>
    </div>
  )
}
