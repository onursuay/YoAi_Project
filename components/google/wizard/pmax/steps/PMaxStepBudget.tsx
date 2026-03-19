'use client'

import { useState } from 'react'
import { AlertCircle, Info, Calendar, DollarSign, ChevronUp, ChevronDown } from 'lucide-react'
import type { PMaxStepProps, PMaxBudgetType } from '../shared/PMaxWizardTypes'
import { inputCls } from '../shared/PMaxWizardTypes'
import { getPMaxBudgetRecommendation } from '../shared/PMaxWizardValidation'

const LOW_BUDGET_THRESHOLD = 10

function CollapsibleSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center justify-between w-full px-5 py-4 text-left">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 pt-0">{children}</div>}
    </div>
  )
}

export default function PMaxStepBudget({ state, update, t }: PMaxStepProps) {
  const budgetNum = parseFloat(state.dailyBudget) || 0
  const recommended = getPMaxBudgetRecommendation(state.biddingStrategy)
  const showRecommendationWarning = state.budgetType === 'DAILY' && budgetNum > 0 && budgetNum < recommended
  const showLowBudgetWarning = state.budgetType === 'DAILY' && budgetNum > 0 && budgetNum < LOW_BUDGET_THRESHOLD
  const hasInvalidDailyBudget = state.budgetType === 'DAILY' && state.dailyBudget.length > 0 && (isNaN(budgetNum) || budgetNum < 1)
  const totalNum = parseFloat(state.totalBudget) || 0
  const hasInvalidTotalBudget = state.budgetType === 'TOTAL' && state.totalBudget.length > 0 && (isNaN(totalNum) || totalNum < 1)

  return (
    <div className="space-y-4 pt-2">
      <CollapsibleSection title={t('budget.sectionTitle')}>
        <div className="space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{t('budget.typeInfoNote')}</span>
          </div>

          {/* Budget type selector */}
          <p className="text-sm font-medium text-gray-700">{t('budget.selectType')}</p>

          {/* Daily budget option */}
          <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
            state.budgetType === 'DAILY' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input
              type="radio"
              name="pmaxBudgetType"
              checked={state.budgetType === 'DAILY'}
              onChange={() => update({ budgetType: 'DAILY' as PMaxBudgetType })}
              className="mt-0.5 text-blue-600"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{t('budget.dailyBudgetOption')}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('budget.dailyBudgetDesc')}</p>
              {state.budgetType === 'DAILY' && (
                <div className="mt-3 relative max-w-[240px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">&#8378;</span>
                  <input
                    className={`${inputCls} pl-7 ${hasInvalidDailyBudget ? 'border-amber-500' : ''}`}
                    type="number"
                    min="1"
                    step="1"
                    value={state.dailyBudget}
                    onChange={e => update({ dailyBudget: e.target.value })}
                    placeholder={t('budget.placeholder')}
                  />
                </div>
              )}
            </div>
          </label>

          {/* Total campaign budget option (BETA) */}
          <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
            state.budgetType === 'TOTAL' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input
              type="radio"
              name="pmaxBudgetType"
              checked={state.budgetType === 'TOTAL'}
              onChange={() => update({ budgetType: 'TOTAL' as PMaxBudgetType })}
              className="mt-0.5 text-blue-600"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">{t('budget.totalBudgetOption')}</p>
                <span className="px-1.5 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-100 rounded">BETA</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{t('budget.totalBudgetDesc')}</p>
              {state.budgetType === 'TOTAL' && (
                <div className="mt-3 relative max-w-[240px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">&#8378;</span>
                  <input
                    className={`${inputCls} pl-7 ${hasInvalidTotalBudget ? 'border-amber-500' : ''}`}
                    type="number"
                    min="1"
                    step="1"
                    value={state.totalBudget}
                    onChange={e => update({ totalBudget: e.target.value })}
                    placeholder={t('budget.totalPlaceholder')}
                  />
                </div>
              )}
            </div>
          </label>

          {/* Validation warnings */}
          {hasInvalidDailyBudget && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {t('validation.minBudget')}
            </div>
          )}
          {hasInvalidTotalBudget && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {t('validation.minTotalBudget')}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Recommendation */}
      {state.budgetType === 'DAILY' && (
        <div className="flex items-start gap-2 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <DollarSign className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900">{t('budget.recommendationTitle')}</p>
            <p className="text-sm text-blue-800 mt-1">
              {recommended} {t('budget.trySuffix')}/{t('summary.day')} — {t('budget.recommendationText')}
            </p>
            {showRecommendationWarning && (
              <p className="text-sm text-amber-800 mt-2 font-medium">
                {t('budget.recommendedForStrategy')}: {recommended} {t('budget.trySuffix')}/{t('summary.day')}.
              </p>
            )}
          </div>
        </div>
      )}

      {showLowBudgetWarning && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t('budget.lowBudgetWarning')}</span>
        </div>
      )}

      {/* Date range info */}
      <div className="flex items-start gap-2 p-3 rounded-lg border border-gray-200 bg-white">
        <Calendar className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-gray-700">{t('budget.dateRangeTitle')}</p>
          <p className="text-sm text-gray-600 mt-0.5">
            {state.startDate && state.endDate
              ? t('budget.dateRangeSet', { start: state.startDate, end: state.endDate })
              : state.startDate
                ? t('budget.dateRangeStartOnly', { start: state.startDate })
                : t('budget.dateRangeNone')}
          </p>
        </div>
      </div>

      {/* Learning phase */}
      <div className="flex items-start gap-2 p-4 rounded-lg bg-gray-50 border border-gray-200">
        <Info className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-gray-900">{t('budget.learningTitle')}</p>
          <p className="text-sm text-gray-600 mt-1">{t('budget.learningText')}</p>
        </div>
      </div>
    </div>
  )
}
