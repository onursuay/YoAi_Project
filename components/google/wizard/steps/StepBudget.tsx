'use client'

import { AlertCircle, Info, Calendar, DollarSign } from 'lucide-react'
import type { StepProps } from '../shared/WizardTypes'
import { inputCls } from '../shared/WizardTypes'
import { getBudgetRecommendation } from '../shared/WizardValidation'
import { GoogleWizardSection } from '../shared/GoogleWizardUI'

const LOW_BUDGET_THRESHOLD = 10

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
    <div className="space-y-8">
      {/* 1. Daily budget input */}
      <GoogleWizardSection
        icon={<DollarSign className="w-[18px] h-[18px]" />}
        title={t('budget.dailyBudget')}
      >
        <Field label={t('budget.dailyBudget')} required>
          <div className="relative max-w-[240px]">
            <input
              className={`${inputCls} pr-12 ${hasInvalidBudget ? 'border-red-300 ring-1 ring-red-300' : ''}`}
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
          <div className="flex items-center gap-2 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {t('validation.minBudget')}
          </div>
        )}

        <div className="flex items-start gap-2 p-4 mt-4 rounded-xl bg-primary/5 border border-primary/20">
          <DollarSign className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-primary">{t('budget.recommendationTitle')}</p>
            <p className="text-sm text-primary mt-1">
              {t('budget.recommendationLine', { amount: recommended, currency: t('budget.trySuffix') })}
            </p>
            {showRecommendationWarning && (
              <p className="text-sm text-gray-800 mt-2 font-medium">
                {t('validation.minBudget')} {t('budget.recommendedForStrategy', { amount: recommended, currency: t('budget.trySuffix') })}
              </p>
            )}
          </div>
        </div>

        {showLowBudgetWarning && (
          <div className="flex items-start gap-2 mt-3 p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{t('budget.lowBudgetWarning')}</span>
          </div>
        )}

        {(hasTargetCpa || hasTargetRoas || isManualCpc) && (
          <div className="flex items-start gap-2 mt-3 p-3.5 rounded-xl bg-gray-50 border border-gray-200">
            <Info className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700">
              {hasTargetCpa && <p>{t('budget.strategyNoteCpa')}</p>}
              {hasTargetRoas && !hasTargetCpa && <p>{t('budget.strategyNoteRoas')}</p>}
              {isManualCpc && !hasTargetCpa && !hasTargetRoas && <p>{t('budget.manualCpcNote')}</p>}
            </div>
          </div>
        )}
      </GoogleWizardSection>

      {/* 2. Delivery / learning info */}
      <GoogleWizardSection
        icon={<Info className="w-[18px] h-[18px]" />}
        title={t('budget.deliveryLearningTitle')}
        description={t('budget.deliveryLearningText')}
      >
        <p className="text-xs text-gray-500">{t('budget.deliveryLearningText')}</p>
      </GoogleWizardSection>

      {/* 3. Date range summary (read-only) */}
      <GoogleWizardSection
        icon={<Calendar className="w-[18px] h-[18px]" />}
        title={t('budget.dateRangeTitle')}
      >
        <p className="text-sm text-gray-700">
          {state.startDate && state.endDate
            ? t('budget.dateRangeSet', { start: state.startDate, end: state.endDate })
            : state.startDate
              ? t('budget.dateRangeStartOnly', { start: state.startDate })
              : t('budget.dateRangeNone')}
        </p>
        <p className="text-xs text-gray-400 mt-1">{t('budget.dateRangeHint')}</p>
      </GoogleWizardSection>
    </div>
  )
}
