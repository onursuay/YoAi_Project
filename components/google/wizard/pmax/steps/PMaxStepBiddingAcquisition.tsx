'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, Users, Info, AlertCircle } from 'lucide-react'
import type { PMaxStepProps, PMaxBiddingFocus } from '../shared/PMaxWizardTypes'
import { inputCls } from '../shared/PMaxWizardTypes'

function CollapsibleSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-5 py-4 text-left"
      >
        <h4 className="text-[15px] font-semibold text-gray-900">{title}</h4>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 pt-0">{children}</div>}
    </div>
  )
}

export default function PMaxStepBiddingAcquisition({ state, update, t }: PMaxStepProps) {
  const handleFocusChange = (focus: PMaxBiddingFocus) => {
    if (focus === 'CONVERSION_VALUE') {
      update({
        biddingFocus: focus,
        biddingStrategy: 'MAXIMIZE_CONVERSIONS',
        targetCpa: '',
      })
    } else {
      update({
        biddingFocus: focus,
        biddingStrategy: 'MAXIMIZE_CONVERSIONS',
        targetRoas: '',
      })
    }
  }

  const showTargetCpa = state.biddingFocus === 'CONVERSION_COUNT'
  const showTargetRoas = state.biddingFocus === 'CONVERSION_VALUE'

  return (
    <div className="space-y-4 pt-2">
      {/* Teklif verme section */}
      <CollapsibleSection title={t('bidding.sectionTitle')}>
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{t('bidding.focusQuestion')}</label>
            <select
              className={`${inputCls} max-w-[240px]`}
              value={state.biddingFocus ?? 'CONVERSION_COUNT'}
              onChange={e => handleFocusChange(e.target.value as PMaxBiddingFocus)}
            >
              <option value="CONVERSION_COUNT">{t('bidding.focusLabels.CONVERSION_COUNT')}</option>
              <option value="CONVERSION_VALUE">{t('bidding.focusLabels.CONVERSION_VALUE')}</option>
            </select>
          </div>

          {/* Target CPA — optional checkbox + input */}
          {showTargetCpa && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.biddingStrategy === 'TARGET_CPA'}
                  onChange={e => {
                    update({
                      biddingStrategy: e.target.checked ? 'TARGET_CPA' : 'MAXIMIZE_CONVERSIONS',
                      targetCpa: e.target.checked ? state.targetCpa : '',
                    })
                  }}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-[13px] font-medium text-gray-900">{t('bidding.setCpaOptional')}</span>
              </label>
              {state.biddingStrategy === 'TARGET_CPA' && (
                <div className="mt-3 ml-6">
                  <label className="block text-[13px] font-medium text-gray-700 mb-1">{t('bidding.targetCpaLabel')}</label>
                  <div className="relative max-w-[200px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">&#8378;</span>
                    <input
                      className={`${inputCls} pl-7`}
                      type="number"
                      min="0"
                      step="1"
                      value={state.targetCpa}
                      onChange={e => update({ targetCpa: e.target.value })}
                      placeholder={t('bidding.targetCpaPlaceholder')}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Target ROAS — optional checkbox + input */}
          {showTargetRoas && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.biddingStrategy === 'TARGET_ROAS'}
                  onChange={e => {
                    update({
                      biddingStrategy: e.target.checked ? 'TARGET_ROAS' : 'MAXIMIZE_CONVERSIONS',
                      targetRoas: e.target.checked ? state.targetRoas : '',
                    })
                  }}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-[13px] font-medium text-gray-900">{t('bidding.setRoasOptional')}</span>
              </label>
              {state.biddingStrategy === 'TARGET_ROAS' && (
                <div className="mt-3 ml-6">
                  <label className="block text-[13px] font-medium text-gray-700 mb-1">{t('bidding.targetRoasLabel')}</label>
                  <div className="relative max-w-[200px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                    <input
                      className={`${inputCls} pl-7`}
                      type="number"
                      min="0"
                      step="0.1"
                      value={state.targetRoas}
                      onChange={e => update({ targetRoas: e.target.value })}
                      placeholder={t('bidding.targetRoasPlaceholder')}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Müşteri edinme section */}
      <CollapsibleSection title={t('bidding.acquisitionTitle')}>
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={state.bidOnlyForNewCustomers}
              onChange={e => update({ bidOnlyForNewCustomers: e.target.checked })}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-[13px] font-medium text-gray-900">{t('bidding.newCustomersOnly')}</span>
          </label>
          <p className="text-[13px] text-gray-500 ml-6">{t('bidding.newCustomersDescription')}</p>

          {state.bidOnlyForNewCustomers && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{t('bidding.acquisitionWarningTitle')}</p>
                <p className="mt-1">{t('bidding.acquisitionWarningText')}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg mt-2">
            <Info className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600">{t('bidding.acquisitionInfoText')}</p>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  )
}
