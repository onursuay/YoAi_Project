'use client'

import { Target, Users, Info } from 'lucide-react'
import type { PMaxStepProps, PMaxBiddingStrategy } from '../shared/PMaxWizardTypes'
import { inputCls, PMaxBiddingStrategies, PMaxBiddingFocusByStrategy } from '../shared/PMaxWizardTypes'

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

export default function PMaxStepBiddingAcquisition({ state, update, t }: PMaxStepProps) {
  const focusOptions = PMaxBiddingFocusByStrategy[state.biddingStrategy] ?? []
  const currentFocusValid = focusOptions.some(o => o.value === state.biddingFocus)
  const effectiveFocus = currentFocusValid ? state.biddingFocus! : (focusOptions[0]?.value ?? null)

  const handleStrategyChange = (strategy: PMaxBiddingStrategy) => {
    const newFocusOptions = PMaxBiddingFocusByStrategy[strategy] ?? []
    update({
      biddingStrategy: strategy,
      biddingFocus: newFocusOptions[0]?.value ?? null,
      targetCpa: strategy === 'TARGET_CPA' ? state.targetCpa : '',
      targetRoas: strategy === 'TARGET_ROAS' ? state.targetRoas : '',
    })
  }

  return (
    <div className="space-y-5">
      <Field label={t('bidding.strategyLabel')} required>
        <select
          className={inputCls}
          value={state.biddingStrategy}
          onChange={e => handleStrategyChange(e.target.value as PMaxBiddingStrategy)}
        >
          {PMaxBiddingStrategies.map(bs => (
            <option key={bs} value={bs}>{t(`bidding.labels.${bs}`)}</option>
          ))}
        </select>
      </Field>

      {focusOptions.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-blue-600" />
            <label className="text-sm font-semibold text-gray-900">{t('bidding.focusTitle')}</label>
          </div>
          <div className="space-y-2">
            {focusOptions.map(({ value, labelKey }) => (
              <label
                key={value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  effectiveFocus === value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="pmaxBiddingFocus"
                  value={value}
                  checked={effectiveFocus === value}
                  onChange={() => update({ biddingFocus: value })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium">{t(`bidding.focusLabels.${labelKey}`)}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      {state.biddingStrategy === 'TARGET_CPA' && (
        <Field label={t('bidding.targetCpaLabel')} required>
          <div className="relative max-w-[200px]">
            <input
              className={`${inputCls} pr-10`}
              type="number"
              min="0"
              step="1"
              value={state.targetCpa}
              onChange={e => update({ targetCpa: e.target.value })}
              placeholder={t('bidding.targetCpaPlaceholder')}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">TRY</span>
          </div>
        </Field>
      )}

      {state.biddingStrategy === 'TARGET_ROAS' && (
        <Field label={t('bidding.targetRoasLabel')} required>
          <input
            className={`${inputCls} max-w-[200px]`}
            type="number"
            min="0"
            step="0.1"
            value={state.targetRoas}
            onChange={e => update({ targetRoas: e.target.value })}
            placeholder={t('bidding.targetRoasPlaceholder')}
          />
        </Field>
      )}

      <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
        <Users className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-gray-700">{t('bidding.acquisitionTitle')}</p>
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={state.bidOnlyForNewCustomers}
              onChange={e => update({ bidOnlyForNewCustomers: e.target.checked })}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-700">{t('bidding.newCustomersOnly')}</span>
          </label>
          <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {t('bidding.newCustomersHint')}
          </p>
        </div>
      </div>
    </div>
  )
}
