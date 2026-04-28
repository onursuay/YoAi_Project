'use client'

import { Globe, Languages, Shield, Calendar, Info } from 'lucide-react'
import { useLocale } from 'next-intl'
import type { StepProps } from '../../shared/WizardTypes'
import { LANGUAGE_OPTIONS } from '../../shared/WizardTypes'
import StepLocationLanguage from '../../steps/StepLocationLanguage'
import { DisplaySection, displayInputCls } from '../DisplayWizardUI'

const EU_POLICY_URL = 'https://support.google.com/adspolicy/answer/6014595'

export default function DisplayStepCampaignSettings({ state, update, t }: StepProps) {
  const locale = useLocale()
  const euPolicyUrl = `${EU_POLICY_URL}?hl=${locale === 'tr' ? 'tr' : 'en'}`

  return (
    <div className="space-y-8">
      {/* Konumlar */}
      <DisplaySection
        icon={<Globe className="w-[18px] h-[18px]" />}
        title={t('display.locationSectionTitle')}
        description={t('location.languageTargetingHint')}
      >
        <StepLocationLanguage state={state} update={update} t={t} />
      </DisplaySection>

      {/* Diller */}
      <DisplaySection
        icon={<Languages className="w-[18px] h-[18px]" />}
        title={t('location.languageTargetingTitle')}
        description={t('location.languageTargetingHint')}
      >
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
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {t(`summary.languageNames.${lang.id}`) || lang.name}
              </button>
            )
          })}
        </div>
        {state.languageIds.length === 0 && (
          <p className="text-xs text-red-500 mt-2">{t('validation.languageRequired')}</p>
        )}
      </DisplaySection>

      {/* AB Siyasi Reklamları */}
      <DisplaySection
        icon={<Shield className="w-[18px] h-[18px]" />}
        title={t('settings.euPoliticalTitle')}
        description={t('settings.euPoliticalQuestion')}
      >
        <div className="space-y-2">
          <label
            className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
              state.euPoliticalAdsDeclaration === 'NOT_POLITICAL'
                ? 'border-primary bg-primary/[0.03] shadow-sm'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              <div
                className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${
                  state.euPoliticalAdsDeclaration === 'NOT_POLITICAL' ? 'border-primary' : 'border-gray-300'
                }`}
              >
                {state.euPoliticalAdsDeclaration === 'NOT_POLITICAL' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </div>
            </div>
            <input
              type="radio"
              name="displayEuPoliticalAdsDeclaration"
              value="NOT_POLITICAL"
              checked={state.euPoliticalAdsDeclaration === 'NOT_POLITICAL'}
              onChange={() => update({ euPoliticalAdsDeclaration: 'NOT_POLITICAL' })}
              className="sr-only"
            />
            <span className="text-sm font-medium text-gray-900">{t('settings.euPoliticalNotPolitical')}</span>
          </label>

          <label
            className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
              state.euPoliticalAdsDeclaration === 'POLITICAL'
                ? 'border-primary bg-primary/[0.03] shadow-sm'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              <div
                className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${
                  state.euPoliticalAdsDeclaration === 'POLITICAL' ? 'border-primary' : 'border-gray-300'
                }`}
              >
                {state.euPoliticalAdsDeclaration === 'POLITICAL' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </div>
            </div>
            <input
              type="radio"
              name="displayEuPoliticalAdsDeclaration"
              value="POLITICAL"
              checked={state.euPoliticalAdsDeclaration === 'POLITICAL'}
              onChange={() => update({ euPoliticalAdsDeclaration: 'POLITICAL' })}
              className="sr-only"
            />
            <span className="text-sm font-medium text-gray-900">{t('settings.euPoliticalPolitical')}</span>
          </label>

          {state.euPoliticalAdsDeclaration === 'POLITICAL' && (
            <div className="flex items-start gap-2 p-3.5 mt-2 rounded-xl border border-primary/20 bg-primary/5 text-[13px] text-primary">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{t('settings.euPoliticalWarningLine1')}</p>
                <p className="mt-1">{t('settings.euPoliticalWarningLine2')}</p>
                <a
                  href={euPolicyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-block underline hover:opacity-80"
                >
                  {t('settings.euPoliticalWarningLearnMore')}
                </a>
              </div>
            </div>
          )}
        </div>
      </DisplaySection>

      {/* Tarihler */}
      <DisplaySection
        icon={<Calendar className="w-[18px] h-[18px]" />}
        title={t('campaign.startDate') + ' / ' + t('campaign.endDate')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">{t('campaign.startDate')}</label>
            <input
              type="date"
              className={displayInputCls}
              value={state.startDate}
              onChange={e => update({ startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">{t('campaign.endDate')}</label>
            <input
              type="date"
              className={displayInputCls}
              value={state.endDate}
              onChange={e => update({ endDate: e.target.value })}
            />
          </div>
        </div>
      </DisplaySection>
    </div>
  )
}
