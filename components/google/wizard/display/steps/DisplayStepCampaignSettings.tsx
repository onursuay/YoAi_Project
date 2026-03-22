'use client'

import { useEffect, useState } from 'react'
import { X, Shield, Info, Loader2 } from 'lucide-react'
import { useLocale } from 'next-intl'
import type { StepProps, GeoSuggestion, SelectedLocation } from '../../shared/WizardTypes'
import { inputCls, LANGUAGE_OPTIONS } from '../../shared/WizardTypes'

const EU_POLICY_URL = 'https://support.google.com/adspolicy/answer/6014595'

export default function DisplayStepCampaignSettings({ state, update, t }: StepProps) {
  const locale = useLocale()
  const euPolicyUrl = `${EU_POLICY_URL}?hl=${locale === 'tr' ? 'tr' : 'en'}`

  const [geoQuery, setGeoQuery] = useState('')
  const [geoResults, setGeoResults] = useState<GeoSuggestion[]>([])
  const [geoLoading, setGeoLoading] = useState(false)
  const [turkeyLoading, setTurkeyLoading] = useState(false)

  useEffect(() => {
    if (state.displayLocationMode !== 'TURKEY') return
    let cancelled = false
    setTurkeyLoading(true)
    fetch(`/api/integrations/google-ads/geo-targets?q=${encodeURIComponent('Turkey')}&country=TR`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const results: GeoSuggestion[] = data.results ?? []
        const first = results[0]
        if (first) {
          const loc: SelectedLocation = {
            id: first.id,
            name: first.name,
            countryCode: first.countryCode,
            targetType: first.targetType,
            isNegative: false,
          }
          update({ locations: [loc] })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTurkeyLoading(false)
      })
    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- preset Turkey locations when mode switches
  }, [state.displayLocationMode])

  useEffect(() => {
    const q = geoQuery.trim()
    if (q.length < 2 || state.displayLocationMode !== 'CUSTOM') {
      setGeoResults([])
      setGeoLoading(false)
      return
    }
    const timer = setTimeout(async () => {
      setGeoLoading(true)
      try {
        const params = new URLSearchParams({ q })
        const res = await fetch(`/api/integrations/google-ads/geo-targets?${params}`)
        const data = await res.json()
        setGeoResults(data.results ?? [])
      } catch {
        setGeoResults([])
      } finally {
        setGeoLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [geoQuery, state.displayLocationMode])

  const addGeo = (g: GeoSuggestion, isNegative: boolean) => {
    if (state.locations.some(l => l.id === g.id)) return
    const loc: SelectedLocation = { ...g, isNegative }
    update({ locations: [...state.locations, loc] })
  }

  const removeLocation = (id: string) => {
    update({ locations: state.locations.filter(l => l.id !== id) })
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('campaign.name')} <span className="text-red-500">*</span>
        </label>
        <input
          className={inputCls}
          value={state.campaignName}
          onChange={e => update({ campaignName: e.target.value })}
          placeholder={t('campaign.namePlaceholder')}
        />
      </div>

      {/* (1) Konumlar */}
      <section>
        <h4 className="text-[15px] font-semibold text-gray-900 mb-3">{t('display.locationSectionTitle')}</h4>
        <div className="space-y-2">
          <label
            className={`flex items-center gap-3 py-2.5 px-3 rounded border cursor-pointer transition-colors ${
              state.displayLocationMode === 'ALL'
                ? 'border-blue-300 bg-blue-50/50'
                : 'border-gray-100 hover:border-gray-200 bg-gray-50/30'
            }`}
          >
            <input
              type="radio"
              name="displayLocationMode"
              checked={state.displayLocationMode === 'ALL'}
              onChange={() => update({ displayLocationMode: 'ALL', locations: [] })}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[13px] font-medium text-gray-900">{t('display.locationAll')}</span>
          </label>
          <label
            className={`flex items-center gap-3 py-2.5 px-3 rounded border cursor-pointer transition-colors ${
              state.displayLocationMode === 'TURKEY'
                ? 'border-blue-300 bg-blue-50/50'
                : 'border-gray-100 hover:border-gray-200 bg-gray-50/30'
            }`}
          >
            <input
              type="radio"
              name="displayLocationMode"
              checked={state.displayLocationMode === 'TURKEY'}
              onChange={() => update({ displayLocationMode: 'TURKEY' })}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[13px] font-medium text-gray-900">{t('display.locationTurkey')}</span>
            {turkeyLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </label>
          <label
            className={`flex items-center gap-3 py-2.5 px-3 rounded border cursor-pointer transition-colors ${
              state.displayLocationMode === 'CUSTOM'
                ? 'border-blue-300 bg-blue-50/50'
                : 'border-gray-100 hover:border-gray-200 bg-gray-50/30'
            }`}
          >
            <input
              type="radio"
              name="displayLocationMode"
              checked={state.displayLocationMode === 'CUSTOM'}
              onChange={() => update({ displayLocationMode: 'CUSTOM' })}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[13px] font-medium text-gray-900">{t('display.locationCustom')}</span>
          </label>
        </div>

        {state.displayLocationMode === 'CUSTOM' && (
          <div className="mt-3 space-y-2">
            <input
              className={inputCls}
              value={geoQuery}
              onChange={e => setGeoQuery(e.target.value)}
              placeholder={t('location.searchPlaceholder')}
            />
            {geoLoading && (
              <div className="flex items-center gap-2 text-[13px] text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('conversion.loading')}
              </div>
            )}
            {!geoLoading && geoResults.length > 0 && (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
                {geoResults.map(r => {
                  const added = state.locations.some(l => l.id === r.id)
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium text-gray-900">{r.name}</span>
                        <span className="ml-2 text-xs text-gray-400">{r.targetType}</span>
                      </div>
                      {!added && (
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => addGeo(r, false)}
                            className="px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
                          >
                            {t('display.includeLocation')}
                          </button>
                          <button
                            type="button"
                            onClick={() => addGeo(r, true)}
                            className="px-2 py-1 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700"
                          >
                            {t('display.excludeLocation')}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {state.locations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {state.locations.map(loc => (
              <span
                key={loc.id}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  loc.isNegative ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                }`}
              >
                {loc.name}
                <button type="button" onClick={() => removeLocation(loc.id)} className="p-0.5 hover:opacity-70" aria-label="Remove">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* (2) Diller */}
      <section>
        <h4 className="text-[15px] font-semibold text-gray-900 mb-2">{t('location.languageTargetingTitle')}</h4>
        <p className="text-xs text-gray-500 mb-2">{t('location.languageTargetingHint')}</p>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map(lang => {
            const active = state.languageIds.includes(lang.id)
            return (
              <button
                key={lang.id}
                type="button"
                onClick={() => {
                  const has = state.languageIds.includes(lang.id)
                  update({
                    languageIds: has
                      ? state.languageIds.filter(id => id !== lang.id)
                      : [...state.languageIds, lang.id],
                  })
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  active
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {t(`summary.languageNames.${lang.id}`) || lang.name}
              </button>
            )
          })}
        </div>
        {state.languageIds.length === 0 && (
          <p className="text-xs text-red-500 mt-1">{t('validation.languageRequired')}</p>
        )}
      </section>

      {/* (3) AB Siyasi Reklamları — StepCampaignSettingsSearch ile aynı */}
      <section className="border border-gray-100 rounded-md bg-white p-4">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-gray-600" />
          <h4 className="text-[15px] font-semibold text-gray-900">{t('settings.euPoliticalTitle')}</h4>
        </div>
        <p className="text-[13px] text-gray-600 mb-3">{t('settings.euPoliticalQuestion')}</p>
        <div className="space-y-1">
          <label
            className={`flex items-center gap-3 py-2.5 px-3 rounded border cursor-pointer transition-colors ${
              state.euPoliticalAdsDeclaration === 'NOT_POLITICAL'
                ? 'border-blue-300 bg-blue-50/50'
                : 'border-gray-100 hover:border-gray-200 bg-gray-50/30'
            }`}
          >
            <input
              type="radio"
              name="displayEuPoliticalAdsDeclaration"
              value="NOT_POLITICAL"
              checked={state.euPoliticalAdsDeclaration === 'NOT_POLITICAL'}
              onChange={() => update({ euPoliticalAdsDeclaration: 'NOT_POLITICAL' })}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[13px] font-medium text-gray-900">{t('settings.euPoliticalNotPolitical')}</span>
          </label>
          {state.euPoliticalAdsDeclaration === 'NOT_POLITICAL' && (
            <p className="text-[12px] text-gray-500 pl-8 mt-0.5 mb-1">
              {t('settings.euPoliticalHelperNote')} {t('settings.euPoliticalHelperNoteOptional')}
            </p>
          )}
          <label
            className={`flex items-center gap-3 py-2.5 px-3 rounded border cursor-pointer transition-colors ${
              state.euPoliticalAdsDeclaration === 'POLITICAL'
                ? 'border-blue-300 bg-blue-50/50'
                : 'border-gray-100 hover:border-gray-200 bg-gray-50/30'
            }`}
          >
            <input
              type="radio"
              name="displayEuPoliticalAdsDeclaration"
              value="POLITICAL"
              checked={state.euPoliticalAdsDeclaration === 'POLITICAL'}
              onChange={() => update({ euPoliticalAdsDeclaration: 'POLITICAL' })}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[13px] font-medium text-gray-900">{t('settings.euPoliticalPolitical')}</span>
          </label>
          {state.euPoliticalAdsDeclaration === 'POLITICAL' && (
            <div className="flex items-start gap-2 p-3 mt-1 rounded border border-amber-200 bg-amber-50/60 text-[13px] text-amber-900">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-medium">{t('settings.euPoliticalWarningLine1')}</p>
                <p className="mt-1 text-amber-800">{t('settings.euPoliticalWarningLine2')}</p>
                <a
                  href={euPolicyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-block text-blue-600 hover:text-blue-700 underline"
                >
                  {t('settings.euPoliticalWarningLearnMore')}
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Tarihler */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('campaign.startDate')}</label>
          <input
            type="date"
            className={inputCls}
            value={state.startDate}
            onChange={e => update({ startDate: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('campaign.endDate')}</label>
          <input
            type="date"
            className={inputCls}
            value={state.endDate}
            onChange={e => update({ endDate: e.target.value })}
          />
        </div>
      </section>
    </div>
  )
}
