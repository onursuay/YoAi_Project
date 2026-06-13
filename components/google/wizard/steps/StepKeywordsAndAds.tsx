'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { Loader2, Plus, Sparkles, AlertTriangle, Users, Search, FileMinus, Link as LinkIcon, Type, AlignLeft } from 'lucide-react'
import type { StepProps, MatchType } from '../shared/WizardTypes'
import { inputCls } from '../shared/WizardTypes'
import { parseKeywords } from '../shared/WizardHelpers'
import WizardSelect from '@/components/meta/wizard/WizardSelect'
import { GoogleWizardSection } from '../shared/GoogleWizardUI'

interface KeywordIdea {
  text: string
  avgMonthlySearches: number
  competition: string
  highTopOfPageBidMicros: number
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

function InlineWarning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
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
    if (c === 'MEDIUM') return 'text-gray-600 bg-gray-50'
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
    <div className="space-y-8">
      <GoogleWizardSection
        icon={<Users className="w-[18px] h-[18px]" />}
        title={t('adgroup.sectionTitle')}
      >
        <Field label={t('adgroup.name')} required>
          <input
            className={inputCls}
            value={state.adGroupName}
            onChange={e => update({ adGroupName: e.target.value })}
            placeholder={t('adgroup.namePlaceholder')}
          />
        </Field>
        {/* Default match type & CPC — side by side on desktop */}
        <div className="mt-6 pt-6 border-t border-gray-200 space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
          <Field label={t('adgroup.defaultMatchType')}>
            <div className="w-full sm:max-w-[200px]">
              <WizardSelect
                value={state.defaultMatchType}
                onChange={(v) => update({ defaultMatchType: v as MatchType })}
                options={[
                  { value: 'BROAD', label: t('adgroup.matchTypes.BROAD') },
                  { value: 'PHRASE', label: t('adgroup.matchTypes.PHRASE') },
                  { value: 'EXACT', label: t('adgroup.matchTypes.EXACT') },
                ]}
              />
            </div>
          </Field>
          <Field label={t('adgroup.cpcBid')}>
            <input
              className={`${inputCls} w-full sm:max-w-[200px]`}
              type="number"
              min="0"
              step="0.01"
              value={state.cpcBid}
              onChange={e => update({ cpcBid: e.target.value })}
              placeholder={t('adgroup.cpcBidPlaceholder')}
            />
          </Field>
        </div>
      </GoogleWizardSection>

      <GoogleWizardSection
        icon={<Search className="w-[18px] h-[18px]" />}
        title={t('adgroup.keywordsSectionTitle')}
        description={t('adgroup.keywordsNote')}
      >
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
                    <button type="button" onClick={() => addSuggestion(idea.text)} className="text-primary hover:text-primary">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </GoogleWizardSection>

      <GoogleWizardSection
        icon={<FileMinus className="w-[18px] h-[18px]" />}
        title={t('adgroup.negativeKeywordsSectionTitle')}
      >
        <Field label={t('adgroup.negativeKeywords')}>
          <textarea
            className={`${inputCls} h-20 resize-none font-mono text-sm`}
            value={state.negativeKeywordsRaw}
            onChange={e => update({ negativeKeywordsRaw: e.target.value })}
            placeholder={t('adgroup.negativeKeywordsPlaceholder')}
          />
        </Field>
      </GoogleWizardSection>

      <GoogleWizardSection
        icon={<LinkIcon className="w-[18px] h-[18px]" />}
        title={t('adgroup.urlPathSectionTitle')}
      >
        <Field label={t('ad.finalUrl')} required>
          <input
            className={`${inputCls} ${hasInvalidUrl ? 'border-gray-400 ring-1 ring-red-300' : ''}`}
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
      </GoogleWizardSection>

      <GoogleWizardSection
        icon={<Type className="w-[18px] h-[18px]" />}
        title={t('adgroup.headlinesSectionTitle')}
        description={t('adgroup.headlinesHint')}
      >
        <p className="text-xs font-medium text-gray-600 mb-2">
          {t('adgroup.headlinesCount', { count: headlines.length })}{(headlines.length < 3) && <span className="text-gray-600"> {t('adgroup.headlinesMinRequired')}</span>}
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
                    className={`${inputCls} flex-1 ${isOverflow ? 'border-gray-400' : ''}`}
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
                  <span className={`text-xs w-8 text-right ${isOverflow ? 'text-gray-600 font-medium' : 'text-gray-400'}`}>
                    {h.length}/30
                  </span>
                  <select
                    value={state.headlinePins?.[i] ?? ''}
                    onChange={e => {
                      const pins = [...(state.headlinePins ?? [])]
                      while (pins.length <= i) pins.push('')
                      pins[i] = e.target.value
                      update({ headlinePins: pins })
                    }}
                    title={t('ad.pinTitle')}
                    className="shrink-0 text-xs border border-gray-200 rounded-md px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    <option value="">{t('ad.pinNone')}</option>
                    <option value="HEADLINE_1">{t('ad.pinHeadline', { n: 1 })}</option>
                    <option value="HEADLINE_2">{t('ad.pinHeadline', { n: 2 })}</option>
                    <option value="HEADLINE_3">{t('ad.pinHeadline', { n: 3 })}</option>
                  </select>
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
      </GoogleWizardSection>

      <GoogleWizardSection
        icon={<AlignLeft className="w-[18px] h-[18px]" />}
        title={t('adgroup.descriptionsSectionTitle')}
        description={t('adgroup.descriptionsHint')}
      >
        <p className="text-xs font-medium text-gray-600 mb-2">
          {t('adgroup.descriptionsCount', { count: descriptions.length })}{(descriptions.length < 2) && <span className="text-gray-600"> {t('adgroup.descriptionsMinRequired')}</span>}
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
                    className={`${inputCls} flex-1 ${isOverflow ? 'border-gray-400' : ''}`}
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
                  <span className={`text-xs w-8 text-right ${isOverflow ? 'text-gray-600 font-medium' : 'text-gray-400'}`}>
                    {d.length}/90
                  </span>
                  <select
                    value={state.descriptionPins?.[i] ?? ''}
                    onChange={e => {
                      const pins = [...(state.descriptionPins ?? [])]
                      while (pins.length <= i) pins.push('')
                      pins[i] = e.target.value
                      update({ descriptionPins: pins })
                    }}
                    title={t('ad.pinTitle')}
                    className="shrink-0 text-xs border border-gray-200 rounded-md px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    <option value="">{t('ad.pinNone')}</option>
                    <option value="DESCRIPTION_1">{t('ad.pinDescription', { n: 1 })}</option>
                    <option value="DESCRIPTION_2">{t('ad.pinDescription', { n: 2 })}</option>
                  </select>
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
      </GoogleWizardSection>
    </div>
  )
}
