'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Shield, Settings, Info } from 'lucide-react'
import { useLocale } from 'next-intl'
import type { StepProps } from '../shared/WizardTypes'
import { inputCls, LANGUAGE_OPTIONS } from '../shared/WizardTypes'
import StepLocationLanguage from './StepLocationLanguage'
import StepAudience from './StepAudience'
import StepAdSchedule from './StepAdSchedule'

function CollapsibleSection({ title, defaultOpen = true, children }: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-5 py-4 text-left"
      >
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 pt-0">{children}</div>}
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

const EU_POLICY_URL = 'https://support.google.com/adspolicy/answer/6014595'

export default function StepCampaignSettingsSearch({ state, update, t }: StepProps) {
  const [otherSettingsOpen, setOtherSettingsOpen] = useState(false)
  const isSearch = state.campaignType === 'SEARCH'
  const locale = useLocale()
  const euPolicyUrl = `${EU_POLICY_URL}?hl=${locale === 'tr' ? 'tr' : 'en'}`

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

      {/* 2. Locations */}
      <CollapsibleSection title={t('settings.locationsTitle')}>
        <StepLocationLanguage state={state} update={update} t={t} />
      </CollapsibleSection>

      {/* 3. Languages */}
      <CollapsibleSection title={t('settings.languagesTitle')}>
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-2">{t('settings.languagesLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map(lang => {
              const selected = state.languageIds.includes(lang.id)
              return (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => {
                    const has = state.languageIds.includes(lang.id)
                    update({ languageIds: has ? state.languageIds.filter(id => id !== lang.id) : [...state.languageIds, lang.id] })
                  }}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {lang.name}
                  {selected && <span className="text-blue-500 ml-1">×</span>}
                </button>
              )
            })}
          </div>
          {state.languageIds.length === 0 && (
            <p className="text-xs text-red-500">{t('validation.languageRequired')}</p>
          )}
        </div>
      </CollapsibleSection>

      {/* 4. EU Political Ads — Google Ads style block */}
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
              name="euPoliticalAdsDeclaration"
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
              name="euPoliticalAdsDeclaration"
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
