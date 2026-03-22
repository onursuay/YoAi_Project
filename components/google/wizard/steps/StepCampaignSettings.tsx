'use client'

import { AlertCircle, Info } from 'lucide-react'
import { useLocale } from 'next-intl'
import type { StepProps, BiddingStrategy } from '../shared/WizardTypes'
import { inputCls, CAMPAIGN_TYPE_BIDDING } from '../shared/WizardTypes'
import { getBudgetRecommendation } from '../shared/WizardValidation'

const BIDDING_LABELS: Record<BiddingStrategy, string> = {
  MAXIMIZE_CLICKS: 'Tıklama Sayısını Artır',
  MAXIMIZE_CONVERSIONS: 'Dönüşümleri Artır',
  TARGET_CPA: 'Hedef EBM (CPA)',
  TARGET_ROAS: 'Hedef ROAS',
  MANUAL_CPC: 'Manuel TBM (CPC)',
  TARGET_IMPRESSION_SHARE: 'Hedef Gösterim Payı',
}

const EU_POLICY_URL = 'https://support.google.com/adspolicy/answer/6014595'

export default function StepCampaignSettings({ state, update, t }: StepProps) {
  const budgetNum = parseFloat(state.dailyBudget) || 0
  const recommended = getBudgetRecommendation(state.biddingStrategy)
  const showBudgetWarning = budgetNum > 0 && budgetNum < recommended

  const locale = useLocale()
  const euPolicyUrl = `${EU_POLICY_URL}?hl=${locale === 'tr' ? 'tr' : 'en'}`
  const availableBidding = CAMPAIGN_TYPE_BIDDING[state.campaignType] ?? ['MAXIMIZE_CLICKS']
  const isSearch = state.campaignType === 'SEARCH'

  return (
    <div className="space-y-4">
      <Field label={t('campaign.name')} required>
        <input className={inputCls} value={state.campaignName} onChange={e => update({ campaignName: e.target.value })} placeholder={t('campaign.namePlaceholder')} />
      </Field>

      <Field label={t('campaign.dailyBudget')} required>
        <input className={inputCls} type="number" min="1" step="1" value={state.dailyBudget} onChange={e => update({ dailyBudget: e.target.value })} placeholder={t('campaign.dailyBudgetPlaceholder')} />
      </Field>

      {showBudgetWarning && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Google bu strateji için minimum <strong>{recommended} TRY/gün</strong> önermektedir.</span>
        </div>
      )}

      <Field label={t('campaign.biddingStrategy')} required>
        <select
          className={inputCls}
          value={state.biddingStrategy}
          onChange={e => update({ biddingStrategy: e.target.value as BiddingStrategy })}
        >
          {availableBidding.map(bs => (
            <option key={bs} value={bs}>{BIDDING_LABELS[bs] ?? bs}</option>
          ))}
        </select>
      </Field>

      {state.biddingStrategy === 'TARGET_CPA' && (
        <Field label={t('campaign.targetCpa')} required>
          <input className={inputCls} type="number" min="0" step="0.01" value={state.targetCpa} onChange={e => update({ targetCpa: e.target.value })} placeholder={t('campaign.targetCpaPlaceholder')} />
        </Field>
      )}
      {state.biddingStrategy === 'TARGET_ROAS' && (
        <Field label={t('campaign.targetRoas')} required>
          <input className={inputCls} type="number" min="0" step="0.01" value={state.targetRoas} onChange={e => update({ targetRoas: e.target.value })} placeholder={t('campaign.targetRoasPlaceholder')} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('campaign.startDate')}>
          <input className={inputCls} type="date" value={state.startDate} onChange={e => update({ startDate: e.target.value })} />
        </Field>
        <Field label={t('campaign.endDate')}>
          <input className={inputCls} type="date" value={state.endDate} onChange={e => update({ endDate: e.target.value })} />
        </Field>
      </div>

      {/* Network Settings — only shown for SEARCH campaigns */}
      {isSearch && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Ağ Ayarları</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked disabled className="rounded border-gray-300" />
              <span className="text-gray-500">Google Arama <span className="text-xs text-gray-400">(her zaman aktif)</span></span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={state.networkSettings.targetSearchNetwork}
                onChange={e => update({ networkSettings: { ...state.networkSettings, targetSearchNetwork: e.target.checked } })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">Arama Ağı Ortakları</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={state.networkSettings.targetContentNetwork}
                onChange={e => update({ networkSettings: { ...state.networkSettings, targetContentNetwork: e.target.checked } })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">Görüntülü Reklam Ağı</span>
            </label>
          </div>
        </div>
      )}

      {/* AB Siyasi Reklamları */}
      <section className="border border-gray-100 rounded-md bg-white p-4">
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
