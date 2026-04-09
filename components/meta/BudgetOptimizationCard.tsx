'use client'

import * as React from 'react'
import { ChevronDown, Check } from 'lucide-react'

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

function CustomDropdown({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`flex items-center justify-between gap-2 px-3.5 py-2.5 border rounded-xl text-sm font-medium text-left bg-white transition-all min-h-[40px] w-full
          shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)]
          ${open ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'}
          ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}
        `}
      >
        <span className="text-gray-800 truncate">{selected?.label ?? ''}</span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 mr-0.5 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[160px] bg-white border border-gray-200 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
          {options.map((o) => {
            const isSelected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors
                  ${isSelected ? 'bg-primary/8 text-primary font-semibold' : 'text-gray-700 hover:bg-gray-50'}
                `}
              >
                <span>{o.label}</span>
                {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
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
  const strategySelectValue = strategyOptions.some((o) => o.value === bidStrategyValue)
    ? bidStrategyValue
    : strategyOptions[0]?.value ?? ''
  const budgetTypeSelectValue = budgetTypeOptions.some((o) => o.value === budgetTypeValue)
    ? budgetTypeValue
    : budgetTypeOptions[0]?.value ?? ''

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)]">
      <div className="flex items-center gap-3">
        {onEnabledChange != null && (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onEnabledChange(!enabled)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              enabled ? 'bg-primary' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        )}
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      </div>

      {description && (
        <p className="mt-2 text-[12px] text-gray-500">{description}</p>
      )}

      <div className="mt-4">
        <label className="mb-2.5 block text-sm font-semibold text-gray-700">{campaignBudgetLabel}</label>
        <div className="flex flex-wrap items-center gap-3">
          <CustomDropdown
            value={strategySelectValue}
            onChange={onBidStrategyChange}
            options={strategyOptions}
            disabled={disabled}
          />
          <CustomDropdown
            value={budgetTypeSelectValue}
            onChange={onBudgetTypeChange}
            options={budgetTypeOptions}
            disabled={disabled}
          />
          <div className="flex flex-1 min-w-[120px] items-center gap-2">
            <input
              type="number"
              min={0}
              step={0.01}
              value={amountValue === '' ? '' : amountValue}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') { onAmountChange(''); return }
                const v = Number(raw)
                onAmountChange(Number.isNaN(v) ? '' : v)
              }}
              placeholder={amountPlaceholder}
              disabled={disabled}
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 min-h-[40px]
                shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)]
                focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all
                disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60
                placeholder:text-gray-400"
            />
            <span className="flex-shrink-0 text-sm font-medium text-gray-600">{currencyLabel}</span>
          </div>
        </div>
        {errorText && (
          <p className="mt-1.5 text-[12px] text-red-600">{errorText}</p>
        )}
      </div>
    </div>
  )
}
