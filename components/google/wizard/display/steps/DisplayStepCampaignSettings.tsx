'use client'

import { Shield, Info } from 'lucide-react'
import { useLocale } from 'next-intl'
import type { StepProps } from '../../shared/WizardTypes'
import { inputCls, LANGUAGE_OPTIONS } from '../../shared/WizardTypes'
import StepLocationLanguage from '../../steps/StepLocationLanguage'

const EU_POLICY_URL = 'https://support.google.com/adspolicy/answer/6014595'

export default function DisplayStepCampaignSettings({ state, update, t }: StepProps) {
  const locale = useLocale()
  const euPolicyUrl = `${EU_POLICY_URL}?hl=${locale === 'tr' ? 'tr' : 'en'}`

  return (
    <div className="space-y-6">
      {/* (1) Konumlar — Search ile birebir aynı component */}
      <section>
        <h4 className="text-[15px] font-semibold text-gray-900 mb-3">{t('display.locationSectionTitle')}</h4>
        <StepLocationLanguage state={state} update={update} t={t} />
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
            <div className="flex items-start gap-2 p-3 mt-1 rounded border border-primary/20 bg-primary/5 text-[13px] text-primary">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{t('settings.euPoliticalWarningLine1')}</p>
                <p className="mt-1">{t('settings.euPoliticalWarningLine2')}</p>
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
