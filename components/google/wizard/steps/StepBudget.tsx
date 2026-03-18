'use client'

import { AlertCircle, Info, Calendar, DollarSign } from 'lucide-react'
import type { StepProps } from '../shared/WizardTypes'
import { inputCls } from '../shared/WizardTypes'
import { getBudgetRecommendation } from '../shared/WizardValidation'

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

export default function StepBudget({ state, update, t }: StepProps) {
  const budgetNum = parseFloat(state.dailyBudget) || 0
  const recommended = getBudgetRecommendation(state.biddingStrategy)
  const showRecommendationWarning = budgetNum > 0 && budgetNum < recommended
  const showLowBudgetWarning = budgetNum > 0 && budgetNum < LOW_BUDGET_THRESHOLD
  const hasInvalidBudget = state.dailyBudget.length > 0 && (isNaN(budgetNum) || budgetNum < 1)
  const hasTargetCpa = state.biddingStrategy === 'TARGET_CPA' && state.targetCpa && parseFloat(state.targetCpa) > 0
  const hasTargetRoas = state.biddingStrategy === 'TARGET_ROAS' && state.targetRoas
  const isManualCpc = state.biddingStrategy === 'MANUAL_CPC'

  return (
    <div className="space-y-6">
      {/* 1. Daily budget input */}
      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('budget.dailyBudget')}</h4>
        <Field label={t('budget.dailyBudget')} required>
          <div className="relative max-w-[240px]">
            <input
              className={`${inputCls} pr-12 ${hasInvalidBudget ? 'border-amber-500 ring-1 ring-amber-500' : ''} ${showRecommendationWarning ? 'border-amber-400' : ''}`}
              type="number"
              min="1"
              step="1"
              value={state.dailyBudget}
              onChange={e => update({ dailyBudget: e.target.value })}
              placeholder={t('budget.dailyBudgetPlaceholder')}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
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

      {/* 2. Budget recommendation block */}
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
                {t('validation.minBudget')} Bu strateji için önerilen: {recommended} {t('budget.trySuffix')}/gün.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 3. Very low budget warning */}
      {showLowBudgetWarning && (
        <section>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{t('budget.lowBudgetWarning')}</span>
          </div>
        </section>
      )}

      {/* 4. Strategy / budget compatibility notes */}
      {(hasTargetCpa || hasTargetRoas || isManualCpc) && (
        <section>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
            <Info className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700">
              {hasTargetCpa && <p>{t('budget.strategyNoteCpa')}</p>}
              {hasTargetRoas && !hasTargetCpa && <p>{t('budget.strategyNoteRoas')}</p>}
              {isManualCpc && !hasTargetCpa && !hasTargetRoas && <p>{t('budget.manualCpcNote')}</p>}
            </div>
          </div>
        </section>
      )}

      {/* 5. Delivery / learning warning block */}
      <section>
        <div className="flex items-start gap-2 p-4 rounded-lg bg-gray-50 border border-gray-200">
          <Info className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{t('budget.deliveryLearningTitle')}</p>
            <p className="text-sm text-gray-600 mt-1">{t('budget.deliveryLearningText')}</p>
          </div>
        </div>
      </section>

      {/* 6. Date range summary (read-only) */}
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
            <p className="text-xs text-gray-400 mt-1">
              {t('budget.dateRangeHint')}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
