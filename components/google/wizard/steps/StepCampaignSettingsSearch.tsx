'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Globe, Shield, Settings } from 'lucide-react'
import type { StepProps } from '../shared/WizardTypes'
import { inputCls } from '../shared/WizardTypes'
import StepLocationLanguage from './StepLocationLanguage'
import StepAudience from './StepAudience'
import StepAdSchedule from './StepAdSchedule'

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

export default function StepCampaignSettingsSearch({ state, update, t }: StepProps) {
  const [otherSettingsOpen, setOtherSettingsOpen] = useState(false)
  const isSearch = state.campaignType === 'SEARCH'

  return (
    <div className="space-y-6">
      {/* 1. Network Settings — only for SEARCH */}
      {isSearch && (
        <section>
          <h4 className="text-[15px] font-semibold text-gray-900 mb-1">{t('settings.networksTitle')}</h4>
          <p className="text-[13px] text-gray-500 mb-3">{t('settings.networksGoogleSearchAlwaysOn')}</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={state.networkSettings.targetSearchNetwork}
                onChange={e => update({ networkSettings: { ...state.networkSettings, targetSearchNetwork: e.target.checked } })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">{t('settings.networksSearchPartners')}</span>
              <span className="text-xs text-gray-400">({t('settings.networksSearchPartnersHint')})</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={state.networkSettings.targetContentNetwork}
                onChange={e => update({ networkSettings: { ...state.networkSettings, targetContentNetwork: e.target.checked } })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">{t('settings.networksDisplay')}</span>
              <span className="text-xs text-gray-400">({t('settings.networksDisplayHint')})</span>
            </label>
          </div>
        </section>
      )}

      {/* 2. Location targeting mode */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-blue-600" />
          <h4 className="text-[15px] font-semibold text-gray-900">{t('settings.locationModeTitle')}</h4>
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
              name="locationTargetingMode"
              value="PRESENCE_OR_INTEREST"
              checked={state.locationTargetingMode === 'PRESENCE_OR_INTEREST'}
              onChange={() => update({ locationTargetingMode: 'PRESENCE_OR_INTEREST' })}
              className="mt-1 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">{t('settings.locationModePresenceInterest')}</span>
              <p className="text-[13px] text-gray-500 mt-0.5">{t('settings.locationModePresenceInterestDesc')}</p>
            </div>
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
              name="locationTargetingMode"
              value="PRESENCE_ONLY"
              checked={state.locationTargetingMode === 'PRESENCE_ONLY'}
              onChange={() => update({ locationTargetingMode: 'PRESENCE_ONLY' })}
              className="mt-1 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">{t('settings.locationModePresenceOnly')}</span>
              <p className="text-[13px] text-gray-500 mt-0.5">{t('settings.locationModePresenceOnlyDesc')}</p>
            </div>
          </label>
        </div>
      </section>

      {/* 3. Locations & Languages */}
      <section>
        <h4 className="text-[15px] font-semibold text-gray-900 mb-3">{t('steps.location')}</h4>
        <StepLocationLanguage state={state} update={update} t={t} />
      </section>

      {/* 4. EU Political Ads — real selectable block */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <h4 className="text-[15px] font-semibold text-gray-900">{t('settings.euPoliticalTitle')}</h4>
        </div>
        <p className="text-[13px] text-gray-500 mb-3">{t('settings.euPoliticalDescription')}</p>
        <div className="space-y-2">
          <label
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              state.euPoliticalAdsDeclaration === 'NOT_POLITICAL'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <input
              type="radio"
              name="euPoliticalAdsDeclaration"
              value="NOT_POLITICAL"
              checked={state.euPoliticalAdsDeclaration === 'NOT_POLITICAL'}
              onChange={() => update({ euPoliticalAdsDeclaration: 'NOT_POLITICAL' })}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-900">{t('settings.euPoliticalNotPolitical')}</span>
          </label>
          <label
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              state.euPoliticalAdsDeclaration === 'POLITICAL'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <input
              type="radio"
              name="euPoliticalAdsDeclaration"
              value="POLITICAL"
              checked={state.euPoliticalAdsDeclaration === 'POLITICAL'}
              onChange={() => update({ euPoliticalAdsDeclaration: 'POLITICAL' })}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-900">{t('settings.euPoliticalPolitical')}</span>
          </label>
        </div>
      </section>

      {/* 5. Audience — embedded protected component, unchanged */}
      <section>
        <h4 className="text-[15px] font-semibold text-gray-900 mb-3">{t('steps.audience')}</h4>
        <StepAudience state={state} update={update} t={t} />
      </section>

      {/* 6. Ad Schedule */}
      <section>
        <StepAdSchedule state={state} update={update} t={t} />
      </section>

      {/* 7. Other settings accordion */}
      <section className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setOtherSettingsOpen(!otherSettingsOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-600" />
            <span className="text-[15px] font-semibold text-gray-900">{t('settings.otherSettingsTitle')}</span>
          </div>
          {otherSettingsOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
        {otherSettingsOpen && (
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('campaign.startDate')}>
                <input className={inputCls} type="date" value={state.startDate} onChange={e => update({ startDate: e.target.value })} />
              </Field>
              <Field label={t('campaign.endDate')}>
                <input className={inputCls} type="date" value={state.endDate} onChange={e => update({ endDate: e.target.value })} />
              </Field>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
