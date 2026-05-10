'use client'

import { Target, Users, Info, DollarSign } from 'lucide-react'
import type { StepProps, BiddingStrategy } from '../shared/WizardTypes'
import { inputCls, CAMPAIGN_TYPE_BIDDING, BIDDING_FOCUS_BY_STRATEGY } from '../shared/WizardTypes'
import { GoogleWizardSection } from '../shared/GoogleWizardUI'

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

export default function StepBiddingAcquisition({ state, update, t }: StepProps) {
  const availableBidding = CAMPAIGN_TYPE_BIDDING[state.campaignType] ?? ['MAXIMIZE_CLICKS']
  const focusOptions = BIDDING_FOCUS_BY_STRATEGY[state.biddingStrategy] ?? []

  const handleStrategyChange = (strategy: BiddingStrategy) => {
    const newFocusOptions = BIDDING_FOCUS_BY_STRATEGY[strategy] ?? []
    const firstFocus = newFocusOptions[0]?.value ?? null
    update({
      biddingStrategy: strategy,
      biddingFocus: firstFocus,
      targetCpa: strategy === 'TARGET_CPA' ? state.targetCpa : '',
      targetRoas: strategy === 'TARGET_ROAS' ? state.targetRoas : '',
    })
  }

  const currentFocusValid = focusOptions.some(o => o.value === state.biddingFocus)
  const effectiveFocus = currentFocusValid ? state.biddingFocus! : (focusOptions[0]?.value ?? null)

  return (
    <div className="space-y-8">
      <GoogleWizardSection
        icon={<DollarSign className="w-[18px] h-[18px]" />}
        title={t('campaign.biddingStrategy')}
      >
        <Field label={t('campaign.biddingStrategy')} required>
          <select
            className={inputCls}
            value={state.biddingStrategy}
            onChange={e => handleStrategyChange(e.target.value as BiddingStrategy)}
          >
            {availableBidding.map(bs => (
              <option key={bs} value={bs}>{t(`summary.biddingLabels.${bs}`) || bs}</option>
            ))}
          </select>
        </Field>

        {focusOptions.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-primary" />
              <label className="text-[13px] font-semibold text-gray-900">
                {t('bidding.focusTitle')}
              </label>
            </div>
            <div className="space-y-2">
              {focusOptions.map(({ value, labelKey }) => (
                <label
                  key={value}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    effectiveFocus === value
                      ? 'border-primary bg-primary/[0.03] shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="biddingFocus"
                    value={value}
                    checked={effectiveFocus === value}
                    onChange={() => update({ biddingFocus: value })}
                    className="text-primary focus:ring-primary/20"
                  />
                  <span className="text-sm font-medium text-gray-900">{t(`summary.biddingFocusLabels.${labelKey}`)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {state.biddingStrategy === 'TARGET_CPA' && (
          <div className="mt-5">
            <Field label={t('campaign.targetCpa')} required>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={state.targetCpa}
                onChange={e => update({ targetCpa: e.target.value })}
                placeholder={t('campaign.targetCpaPlaceholder')}
              />
            </Field>
          </div>
        )}

        {state.biddingStrategy === 'TARGET_ROAS' && (
          <div className="mt-5">
            <Field label={t('campaign.targetRoas')} required>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={state.targetRoas}
                onChange={e => update({ targetRoas: e.target.value })}
                placeholder={t('campaign.targetRoasPlaceholder')}
              />
            </Field>
          </div>
        )}
      </GoogleWizardSection>

      <GoogleWizardSection
        icon={<Users className="w-[18px] h-[18px]" />}
        title={t('bidding.acquisitionTitle')}
        description={t('bidding.acquisitionDescription')}
      >
        <label className="flex items-start gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-gray-300 bg-white cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={state.bidOnlyForNewCustomers}
            onChange={e => update({ bidOnlyForNewCustomers: e.target.checked })}
            className="mt-1 rounded border-gray-300 text-primary focus:ring-primary/20"
          />
          <div>
            <span className="text-sm font-medium text-gray-900">
              {t('bidding.newCustomersOnly')}
            </span>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('bidding.newCustomersOnlyHint')}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-700/90">
              <Info className="w-3.5 h-3.5 shrink-0" />
              {t('bidding.newCustomersOnlyUiNote')}
            </p>
          </div>
        </label>
      </GoogleWizardSection>
    </div>
  )
}
