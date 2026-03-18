'use client'

import { AlertCircle, Info, Calendar, DollarSign } from 'lucide-react'
import type { PMaxStepProps } from '../shared/PMaxWizardTypes'
import { inputCls } from '../shared/PMaxWizardTypes'
import { getPMaxBudgetRecommendation } from '../shared/PMaxWizardValidation'

const LOW_BUDGET_THRESHOLD = 10

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

export default function PMaxStepBudget({ state, update, t }: PMaxStepProps) {
  const budgetNum = parseFloat(state.dailyBudget) || 0
  const recommended = getPMaxBudgetRecommendation(state.biddingStrategy)
  const showRecommendationWarning = budgetNum > 0 && budgetNum < recommended
  const showLowBudgetWarning = budgetNum > 0 && budgetNum < LOW_BUDGET_THRESHOLD
  const hasInvalidBudget = state.dailyBudget.length > 0 && (isNaN(budgetNum) || budgetNum < 1)

  return (
    <div className="space-y-6">
      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('budget.dailyBudget')}</h4>
        <Field label={t('budget.dailyBudget')} required>
          <div className="relative max-w-[240px]">
            <input
              className={`${inputCls} pr-12 ${hasInvalidBudget ? 'border-amber-500' : ''} ${showRecommendationWarning ? 'border-amber-400' : ''}`}
              type="number"
              min="1"
              step="1"
              value={state.dailyBudget}
              onChange={e => update({ dailyBudget: e.target.value })}
              placeholder={t('budget.placeholder')}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
              {t('budget.trySuffix')}
            </span>
          </div>
        </Field>
        {hasInvalidBudget && (
          <div className="flex items-center gap-2 mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {t('validation.minBudget')}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-start gap-2 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <DollarSign className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900">{t('budget.recommendationTitle')}</p>
            <p className="text-sm text-blue-800 mt-1">
              {recommended} {t('budget.trySuffix')}/gün — {t('budget.recommendationText')}
            </p>
            {showRecommendationWarning && (
              <p className="text-sm text-amber-800 mt-2 font-medium">
                {t('validation.minBudget')} {t('budget.recommendedForStrategy')}: {recommended} {t('budget.trySuffix')}/gün.
              </p>
            )}
          </div>
        </div>
      </section>

      {showLowBudgetWarning && (
        <section>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{t('budget.lowBudgetWarning')}</span>
          </div>
        </section>
      )}

      <section>
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
      </section>

      <section>
        <div className="flex items-start gap-2 p-4 rounded-lg bg-gray-50 border border-gray-200">
          <Info className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{t('budget.learningTitle')}</p>
            <p className="text-sm text-gray-600 mt-1">{t('budget.learningText')}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
