'use client'

import { Wallet, Target, CheckCircle2 } from 'lucide-react'
import type { StepProps, WizardState, BiddingFocus } from '../../shared/WizardTypes'
import { DisplaySection, DisplayRadioCard, displayInputCls } from '../DisplayWizardUI'
import WizardSelect from '@/components/meta/wizard/WizardSelect'

function mapDisplayToBidding(
  focus: WizardState['displayBiddingFocus'],
  convSub: WizardState['displayConversionsSub'],
  valSub: WizardState['displayValueSub'],
  clicksSub: WizardState['displayClicksSub']
): { biddingStrategy: WizardState['biddingStrategy']; biddingFocus: BiddingFocus | null } {
  if (focus === 'VIEWABLE_IMPRESSIONS') return { biddingStrategy: 'MANUAL_CPM', biddingFocus: null }
  if (focus === 'CLICKS') {
    if (clicksSub === 'MANUAL_CPC') return { biddingStrategy: 'MANUAL_CPC', biddingFocus: 'CLICKS' }
    return { biddingStrategy: 'MAXIMIZE_CLICKS', biddingFocus: 'CLICKS' }
  }
  if (focus === 'CONVERSIONS') {
    if (convSub === 'TARGET_CPA') return { biddingStrategy: 'TARGET_CPA', biddingFocus: 'CONVERSION_COUNT' }
    return { biddingStrategy: 'MAXIMIZE_CONVERSIONS', biddingFocus: 'CONVERSION_COUNT' }
  }
  if (focus === 'CONVERSION_VALUE') {
    if (valSub === 'TARGET_ROAS') return { biddingStrategy: 'TARGET_ROAS', biddingFocus: 'CONVERSION_VALUE' }
    return { biddingStrategy: 'MAXIMIZE_CONVERSIONS', biddingFocus: 'CONVERSION_VALUE' }
  }
  return { biddingStrategy: 'MAXIMIZE_CONVERSIONS', biddingFocus: 'CONVERSION_COUNT' }
}

export default function DisplayStepBudgetBidding({ state, update, t }: StepProps) {
  const applyFocus = (partial: Partial<typeof state>) => {
    const next = { ...state, ...partial }
    const mapped = mapDisplayToBidding(
      next.displayBiddingFocus,
      next.displayConversionsSub,
      next.displayValueSub,
      next.displayClicksSub
    )
    update({ ...partial, biddingStrategy: mapped.biddingStrategy, biddingFocus: mapped.biddingFocus })
  }

  const friendlyStrategyLabel = (() => {
    if (state.displayBiddingFocus === 'VIEWABLE_IMPRESSIONS') return t('display.focusViewableImpressions')
    if (state.displayBiddingFocus === 'CLICKS') {
      return state.displayClicksSub === 'MANUAL_CPC' ? t('display.manualCpc') : t('display.maximizeClicks')
    }
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
    if (state.displayBiddingFocus === 'VIEWABLE_IMPRESSIONS') return t('display.biddingInfoVcpm')
    if (state.displayBiddingFocus === 'CLICKS') {
      return state.displayClicksSub === 'MANUAL_CPC'
        ? t('display.biddingInfoManualCpc')
        : t('display.biddingInfoMaxClicks')
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
      <DisplaySection
        icon={<Wallet className="w-[18px] h-[18px]" />}
        title={t('display.budgetSectionTitle')}
      >
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1.5">
            {t('campaign.dailyBudget')} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              min={1}
              step={1}
              className={`${displayInputCls} pr-14`}
              value={state.dailyBudget}
              onChange={e => update({ dailyBudget: e.target.value })}
              placeholder={t('campaign.dailyBudgetPlaceholder')}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
              TRY
            </span>
          </div>
        </div>
      </DisplaySection>

      {/* Teklif verme */}
      <DisplaySection
        icon={<Target className="w-[18px] h-[18px]" />}
        title={t('display.biddingSectionTitle')}
      >
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              {t('display.biddingFocusLabel')}
            </label>
            <WizardSelect
              value={state.displayBiddingFocus}
              onChange={(v) => applyFocus({ displayBiddingFocus: v as typeof state.displayBiddingFocus })}
              options={[
                { value: 'CONVERSIONS', label: t('display.focusConversions') },
                { value: 'CONVERSION_VALUE', label: t('display.focusConversionValue') },
                { value: 'CLICKS', label: t('display.focusClicks') },
                { value: 'VIEWABLE_IMPRESSIONS', label: t('display.focusViewableImpressions') },
              ]}
            />
          </div>

          {state.displayBiddingFocus === 'CONVERSIONS' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {t('display.subStrategyTitle')}
              </p>
              <DisplayRadioCard
                selected={state.displayConversionsSub === 'MAXIMIZE_CONVERSIONS'}
                onClick={() => applyFocus({ displayConversionsSub: 'MAXIMIZE_CONVERSIONS' })}
                title={t('display.maximizeConversions')}
              />
              <DisplayRadioCard
                selected={state.displayConversionsSub === 'TARGET_CPA'}
                onClick={() => applyFocus({ displayConversionsSub: 'TARGET_CPA' })}
                title={t('display.manualCpa')}
              />
              {state.displayConversionsSub === 'TARGET_CPA' && (
                <div className="ml-1 mt-1 p-5 bg-gray-50/80 border border-gray-200 rounded-xl">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    {t('campaign.targetCpa')}
                  </label>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    className={displayInputCls}
                    value={state.targetCpa}
                    onChange={e => update({ targetCpa: e.target.value })}
                    placeholder={t('campaign.targetCpaPlaceholder')}
                  />
                </div>
              )}
            </div>
          )}

          {state.displayBiddingFocus === 'CONVERSION_VALUE' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {t('display.subStrategyTitle')}
              </p>
              <DisplayRadioCard
                selected={state.displayValueSub === 'MAXIMIZE_CONVERSION_VALUE'}
                onClick={() => applyFocus({ displayValueSub: 'MAXIMIZE_CONVERSION_VALUE' })}
                title={t('display.maximizeConversionValue')}
              />
              <DisplayRadioCard
                selected={state.displayValueSub === 'TARGET_ROAS'}
                onClick={() => applyFocus({ displayValueSub: 'TARGET_ROAS' })}
                title={t('display.targetRoas')}
              />
              {state.displayValueSub === 'TARGET_ROAS' && (
                <div className="ml-1 mt-1 p-5 bg-gray-50/80 border border-gray-200 rounded-xl">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    {t('campaign.targetRoas')}
                  </label>
                  <input
                    type="number"
                    min={0.01}
                    step={0.1}
                    className={displayInputCls}
                    value={state.targetRoas}
                    onChange={e => update({ targetRoas: e.target.value })}
                    placeholder={t('campaign.targetRoasPlaceholder')}
                  />
                </div>
              )}
            </div>
          )}

          {state.displayBiddingFocus === 'CLICKS' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {t('display.subStrategyTitle')}
              </p>
              <DisplayRadioCard
                selected={state.displayClicksSub === 'MAXIMIZE_CLICKS'}
                onClick={() => applyFocus({ displayClicksSub: 'MAXIMIZE_CLICKS' })}
                title={t('display.maximizeClicks')}
              />
              <DisplayRadioCard
                selected={state.displayClicksSub === 'MANUAL_CPC'}
                onClick={() => applyFocus({ displayClicksSub: 'MANUAL_CPC' })}
                title={t('display.manualCpc')}
              />
              {state.displayClicksSub === 'MANUAL_CPC' && (
                <div className="ml-1 mt-1 p-5 bg-gray-50/80 border border-gray-200 rounded-xl">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    {t('display.cpcBidLabel')}
                  </label>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    className={displayInputCls}
                    value={state.cpcBid}
                    onChange={e => update({ cpcBid: e.target.value })}
                    placeholder={t('display.cpcBidPlaceholder')}
                  />
                </div>
              )}
            </div>
          )}

          {state.displayBiddingFocus === 'VIEWABLE_IMPRESSIONS' && (
            <div className="space-y-3">
              <p className="text-[13px] text-gray-600 leading-relaxed">{t('display.vcpmDescription')}</p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  {t('display.vcpmBidLabel')}
                </label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  className={displayInputCls}
                  value={state.displayViewableCpm}
                  onChange={e => update({ displayViewableCpm: e.target.value })}
                  placeholder={t('display.vcpmBidPlaceholder')}
                />
              </div>
            </div>
          )}

          {/* Active strategy summary */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-900">{t('display.activeStrategyTitle')}</p>
              <p className="text-sm font-semibold text-emerald-900 mt-1">{friendlyStrategyLabel}</p>
              <p className="text-[12px] text-emerald-800 mt-1.5 leading-relaxed">{infoText}</p>
            </div>
          </div>
        </div>
      </DisplaySection>
    </div>
  )
}
