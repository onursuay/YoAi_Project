'use client'

import * as React from 'react'

export interface BudgetOptimizationCardProps {
  enabled: boolean
  onEnabledChange?: (enabled: boolean) => void
  title?: string
  description?: string
  strategyOptions: { value: string; label: string }[]
  bidStrategyValue: string
  onBidStrategyChange: (v: string) => void
  budgetTypeOptions: { value: string; label: string }[]
  budgetTypeValue: string
  onBudgetTypeChange: (v: string) => void
  amountValue: number | ''
  onAmountChange: (v: number | '') => void
  currencyLabel?: string
  errorText?: string | null
  amountPlaceholder?: string
  campaignBudgetLabel?: string
}

export default function BudgetOptimizationCard({
  enabled,
  onEnabledChange,
  title = 'Kampanya Bütçe Optimizasyonu',
  description = 'Bütçenizi kampanya seviyesinde ayarlayın. Meta reklam setleri arasında otomatik dağıtım yapar.',
  strategyOptions,
  bidStrategyValue,
  onBidStrategyChange,
  budgetTypeOptions,
  budgetTypeValue,
  onBudgetTypeChange,
  amountValue,
  onAmountChange,
  currencyLabel = 'TRY',
  errorText = null,
  amountPlaceholder,
  campaignBudgetLabel = 'Kampanya Bütçesi',
}: BudgetOptimizationCardProps) {
  const disabled = !enabled
  const strategySelectValue = strategyOptions.some((o) => o.value === bidStrategyValue) ? bidStrategyValue : strategyOptions[0]?.value ?? ''
  const budgetTypeSelectValue = budgetTypeOptions.some((o) => o.value === budgetTypeValue) ? budgetTypeValue : budgetTypeOptions[0]?.value ?? ''

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" style={{ borderRadius: 12, padding: 24 }}>
      <div className="flex items-center gap-3">
        {onEnabledChange != null && (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onEnabledChange(!enabled)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${enabled ? 'bg-primary' : 'bg-gray-200'}`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-4' : 'translate-x-0'}`}
            />
          </button>
        )}
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      </div>
      {description && (
        <p className="mt-2 text-gray-500" style={{ fontSize: '12px' }}>
          {description}
        </p>
      )}
      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">{campaignBudgetLabel}</label>
        <div className="flex flex-wrap items-center gap-3" style={{ gap: '12px 16px' }}>
          <select
            value={strategySelectValue}
            onChange={(e) => onBidStrategyChange(e.target.value)}
            disabled={disabled}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60"
            style={{ minHeight: 40 }}
          >
            {strategyOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={budgetTypeSelectValue}
            onChange={(e) => onBudgetTypeChange(e.target.value)}
            disabled={disabled}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60"
            style={{ minHeight: 40 }}
          >
            {budgetTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="flex flex-1 min-w-[120px] items-center gap-2">
            <input
              type="number"
              min={0}
              step={0.01}
              value={amountValue === '' ? '' : amountValue}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') {
                  onAmountChange('')
                  return
                }
                const v = Number(raw)
                onAmountChange(Number.isNaN(v) ? '' : v)
              }}
              placeholder={amountPlaceholder}
              disabled={disabled}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60"
              style={{ minHeight: 40 }}
            />
            <span className="flex-shrink-0 text-sm font-medium text-gray-600">{currencyLabel}</span>
          </div>
        </div>
        {errorText && (
          <p className="mt-1.5 text-sm text-red-600">{errorText}</p>
        )}
      </div>
    </div>
  )
}
