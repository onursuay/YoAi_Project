'use client'

import { useState } from 'react'
import { Globe, Shield } from 'lucide-react'
import type { PMaxStepProps } from '../shared/PMaxWizardTypes'
import { inputCls, PMaxLanguageOptions, PMaxCountryOptions } from '../shared/PMaxWizardTypes'

const EU_POLICY_URL = 'https://support.google.com/adspolicy/answer/6014595'

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

export default function PMaxStepCampaignSettings({ state, update, t }: PMaxStepProps) {
  const [geoQuery, setGeoQuery] = useState('')
  const [geoLoading, setGeoLoading] = useState(false)

  const searchGeo = async () => {
    if (geoQuery.trim().length < 2) return
    setGeoLoading(true)
    try {
      const params = new URLSearchParams({ q: geoQuery })
      if (state.geoSearchCountry) params.set('country', state.geoSearchCountry)
      const res = await fetch(`/api/integrations/google-ads/geo-targets?${params}`)
      const data = await res.json()
      const results = data.results ?? []
      results.slice(0, 5).forEach((r: { id: string; name: string; countryCode: string; targetType: string }) => {
        if (!state.locations.some(l => l.id === r.id)) {
          update({
            locations: [...state.locations, { ...r, isNegative: false }],
          })
        }
      })
    } catch {
      // ignore
    } finally {
      setGeoLoading(false)
    }
  }

  const removeLocation = (id: string) => {
    update({ locations: state.locations.filter(l => l.id !== id) })
  }

  const toggleLanguage = (langId: string) => {
    const has = state.languageIds.includes(langId)
    update({
      languageIds: has ? state.languageIds.filter(id => id !== langId) : [...state.languageIds, langId],
    })
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-semibold text-gray-900">{t('settings.locationModeTitle')}</h4>
        </div>
        <div className="space-y-2">
          <label
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              state.locationTargetingMode === 'PRESENCE_OR_INTEREST'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <input
              type="radio"
              name="pmaxLocationMode"
              checked={state.locationTargetingMode === 'PRESENCE_OR_INTEREST'}
              onChange={() => update({ locationTargetingMode: 'PRESENCE_OR_INTEREST' })}
              className="mt-1 text-blue-600"
            />
            <span className="text-sm text-gray-900">{t('settings.locationModePresenceInterest')}</span>
          </label>
          <label
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              state.locationTargetingMode === 'PRESENCE_ONLY'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <input
              type="radio"
              name="pmaxLocationMode"
              checked={state.locationTargetingMode === 'PRESENCE_ONLY'}
              onChange={() => update({ locationTargetingMode: 'PRESENCE_ONLY' })}
              className="mt-1 text-blue-600"
            />
            <span className="text-sm text-gray-900">{t('settings.locationModePresenceOnly')}</span>
          </label>
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">{t('settings.locationsTitle')}</h4>
        <div className="flex gap-2 mb-2">
          <select
            className={`${inputCls} w-32`}
            value={state.geoSearchCountry}
            onChange={e => update({ geoSearchCountry: e.target.value })}
          >
            {PMaxCountryOptions.map(c => (
              <option key={c.code} value={c.code}>{t(c.labelKey)}</option>
            ))}
          </select>
          <input
            className={`${inputCls} flex-1`}
            value={geoQuery}
            onChange={e => setGeoQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchGeo()}
            placeholder={t('settings.locationSearchPlaceholder')}
          />
          <button
            type="button"
            onClick={searchGeo}
            disabled={geoLoading || geoQuery.trim().length < 2}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {geoLoading ? '...' : t('settings.locationSearch')}
          </button>
        </div>
        {state.locations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {state.locations.map(l => (
              <span
                key={l.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-sm"
              >
                {l.name}
                <button
                  type="button"
                  onClick={() => removeLocation(l.id)}
                  className="text-gray-500 hover:text-red-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-1">{t('settings.locationsHint')}</p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">{t('settings.languagesTitle')}</h4>
        <div className="flex flex-wrap gap-2">
          {PMaxLanguageOptions.map(lang => {
            const selected = state.languageIds.includes(lang.id)
            return (
              <button
                key={lang.id}
                type="button"
                onClick={() => toggleLanguage(lang.id)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {lang.name}
              </button>
            )
          })}
        </div>
      </section>

      <section className="border border-gray-100 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-gray-600" />
          <h4 className="text-sm font-semibold text-gray-900">{t('settings.euPoliticalTitle')}</h4>
        </div>
        <a href={EU_POLICY_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mb-2 block">
          {t('settings.euPoliticalLearnMore')}
        </a>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="pmaxEuPolitical"
              checked={state.euPoliticalAdsDeclaration === 'NOT_POLITICAL'}
              onChange={() => update({ euPoliticalAdsDeclaration: 'NOT_POLITICAL' })}
              className="text-blue-600"
            />
            <span className="text-sm">{t('settings.euPoliticalNotPolitical')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="pmaxEuPolitical"
              checked={state.euPoliticalAdsDeclaration === 'POLITICAL'}
              onChange={() => update({ euPoliticalAdsDeclaration: 'POLITICAL' })}
              className="text-blue-600"
            />
            <span className="text-sm">{t('settings.euPoliticalPolitical')}</span>
          </label>
        </div>
      </section>
    </div>
  )
}
