'use client'

import type { StepProps, WizardState, BiddingFocus } from '../../shared/WizardTypes'
import { inputCls } from '../../shared/WizardTypes'

function mapDisplayToBidding(
  focus: WizardState['displayBiddingFocus'],
  convSub: WizardState['displayConversionsSub'],
  valSub: WizardState['displayValueSub']
): { biddingStrategy: WizardState['biddingStrategy']; biddingFocus: BiddingFocus | null } {
  if (focus === 'VIEWABLE_IMPRESSIONS') {
    return { biddingStrategy: 'MAXIMIZE_CLICKS', biddingFocus: 'CLICKS' }
  }
  if (focus === 'CONVERSIONS') {
    if (convSub === 'TARGET_CPA') {
      return { biddingStrategy: 'TARGET_CPA', biddingFocus: 'CONVERSION_COUNT' }
    }
    return { biddingStrategy: 'MAXIMIZE_CONVERSIONS', biddingFocus: 'CONVERSION_COUNT' }
  }
  if (focus === 'CONVERSION_VALUE') {
    if (valSub === 'TARGET_ROAS') {
      return { biddingStrategy: 'TARGET_ROAS', biddingFocus: 'CONVERSION_VALUE' }
    }
    return { biddingStrategy: 'MAXIMIZE_CONVERSIONS', biddingFocus: 'CONVERSION_VALUE' }
  }
  return { biddingStrategy: 'MAXIMIZE_CONVERSIONS', biddingFocus: 'CONVERSION_COUNT' }
}

export default function DisplayStepBudgetBidding({ state, update, t }: StepProps) {
  const applyFocus = (partial: Partial<typeof state>) => {
    const next = { ...state, ...partial }
    const mapped = mapDisplayToBidding(next.displayBiddingFocus, next.displayConversionsSub, next.displayValueSub)
    update({ ...partial, biddingStrategy: mapped.biddingStrategy, biddingFocus: mapped.biddingFocus })
  }

  const friendlyStrategyLabel = (() => {
    if (state.displayBiddingFocus === 'VIEWABLE_IMPRESSIONS') return t('display.focusViewableImpressions')
    if (state.displayBiddingFocus === 'CONVERSIONS') {
      return state.displayConversionsSub === 'TARGET_CPA'
        ? t('display.manualCpa')
        : t('display.maximizeConversions')
    }
    if (state.displayBiddingFocus === 'CONVERSION_VALUE') {
      return state.displayValueSub === 'TARGET_ROAS'
        ? t('display.targetRoas')
        : t('display.maximizeConversionValue')
    }
    return ''
  })()

  const infoText = (() => {
    if (state.displayBiddingFocus === 'VIEWABLE_IMPRESSIONS') {
      return t('display.biddingInfoVcpm')
    }
    if (state.displayBiddingFocus === 'CONVERSIONS') {
      return state.displayConversionsSub === 'TARGET_CPA'
        ? t('display.biddingInfoTargetCpa')
        : t('display.biddingInfoMaxConv')
    }
    if (state.displayBiddingFocus === 'CONVERSION_VALUE') {
      return state.displayValueSub === 'TARGET_ROAS'
        ? t('display.biddingInfoTargetRoas')
        : t('display.biddingInfoMaxConvValue')
    }
    return ''
  })()

  return (
    <div className="space-y-8">
      {/* Bütçe */}
      <section className="space-y-3">
        <h4 className="text-[15px] font-semibold text-gray-900">{t('display.budgetSectionTitle')}</h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('campaign.dailyBudget')} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={1}
            step={1}
            className={inputCls}
            value={state.dailyBudget}
            onChange={e => update({ dailyBudget: e.target.value })}
            placeholder={t('campaign.dailyBudgetPlaceholder')}
          />
        </div>
      </section>

      {/* Teklif verme */}
      <section className="space-y-4">
        <h4 className="text-[15px] font-semibold text-gray-900">{t('display.biddingSectionTitle')}</h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('display.biddingFocusLabel')}</label>
        <select
          className={inputCls}
          value={state.displayBiddingFocus}
          onChange={e => {
            const v = e.target.value as typeof state.displayBiddingFocus
            applyFocus({ displayBiddingFocus: v })
          }}
        >
          <option value="CONVERSIONS">{t('display.focusConversions')}</option>
          <option value="CONVERSION_VALUE">{t('display.focusConversionValue')}</option>
          <option value="VIEWABLE_IMPRESSIONS">{t('display.focusViewableImpressions')}</option>
        </select>
      </div>

      {state.displayBiddingFocus === 'CONVERSIONS' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-800">{t('display.subStrategyTitle')}</p>
          <label
            className={`flex items-center gap-3 py-2.5 px-3 rounded border cursor-pointer ${
              state.displayConversionsSub === 'MAXIMIZE_CONVERSIONS' ? 'border-blue-300 bg-blue-50/50' : 'border-gray-100'
            }`}
          >
            <input
              type="radio"
              name="displayConvSub"
              checked={state.displayConversionsSub === 'MAXIMIZE_CONVERSIONS'}
              onChange={() => applyFocus({ displayConversionsSub: 'MAXIMIZE_CONVERSIONS' })}
              className="text-blue-600"
            />
            <span className="text-[13px] font-medium text-gray-900">{t('display.maximizeConversions')}</span>
          </label>
          <label
            className={`flex items-center gap-3 py-2.5 px-3 rounded border cursor-pointer ${
              state.displayConversionsSub === 'TARGET_CPA' ? 'border-blue-300 bg-blue-50/50' : 'border-gray-100'
            }`}
          >
            <input
              type="radio"
              name="displayConvSub"
              checked={state.displayConversionsSub === 'TARGET_CPA'}
              onChange={() => applyFocus({ displayConversionsSub: 'TARGET_CPA' })}
              className="text-blue-600"
            />
            <span className="text-[13px] font-medium text-gray-900">{t('display.manualCpa')}</span>
          </label>
          {state.displayConversionsSub === 'TARGET_CPA' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">{t('campaign.targetCpa')}</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                className={inputCls}
                value={state.targetCpa}
                onChange={e => update({ targetCpa: e.target.value })}
                placeholder={t('campaign.targetCpaPlaceholder')}
              />
            </div>
          )}
        </div>
      )}

      {state.displayBiddingFocus === 'CONVERSION_VALUE' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-800">{t('display.subStrategyTitle')}</p>
          <label
            className={`flex items-center gap-3 py-2.5 px-3 rounded border cursor-pointer ${
              state.displayValueSub === 'MAXIMIZE_CONVERSION_VALUE' ? 'border-blue-300 bg-blue-50/50' : 'border-gray-100'
            }`}
          >
            <input
              type="radio"
              name="displayValSub"
              checked={state.displayValueSub === 'MAXIMIZE_CONVERSION_VALUE'}
              onChange={() => applyFocus({ displayValueSub: 'MAXIMIZE_CONVERSION_VALUE' })}
              className="text-blue-600"
            />
            <span className="text-[13px] font-medium text-gray-900">{t('display.maximizeConversionValue')}</span>
          </label>
          <label
            className={`flex items-center gap-3 py-2.5 px-3 rounded border cursor-pointer ${
              state.displayValueSub === 'TARGET_ROAS' ? 'border-blue-300 bg-blue-50/50' : 'border-gray-100'
            }`}
          >
            <input
              type="radio"
              name="displayValSub"
              checked={state.displayValueSub === 'TARGET_ROAS'}
              onChange={() => applyFocus({ displayValueSub: 'TARGET_ROAS' })}
              className="text-blue-600"
            />
            <span className="text-[13px] font-medium text-gray-900">{t('display.targetRoas')}</span>
          </label>
          {state.displayValueSub === 'TARGET_ROAS' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">{t('campaign.targetRoas')}</label>
              <input
                type="number"
                min={0.01}
                step={0.1}
                className={inputCls}
                value={state.targetRoas}
                onChange={e => update({ targetRoas: e.target.value })}
                placeholder={t('campaign.targetRoasPlaceholder')}
              />
            </div>
          )}
        </div>
      )}

      {state.displayBiddingFocus === 'VIEWABLE_IMPRESSIONS' && (
        <p className="text-[13px] text-gray-600 leading-relaxed">{t('display.vcpmDescription')}</p>
      )}

      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-[13px] text-emerald-900">
        <p className="font-medium text-emerald-900 mb-1">{t('display.activeStrategyTitle')}</p>
        <p className="text-emerald-800">{friendlyStrategyLabel}</p>
        <p className="mt-2 text-emerald-800">{infoText}</p>
      </div>
      </section>
    </div>
  )
}
