'use client'

import { Check } from 'lucide-react'
import { getTrafficI18n } from './i18n'

interface TWProgressProps {
  currentStep: 1 | 2 | 3 | 4
  onStepClick?: (step: 1 | 2 | 3 | 4) => void
}

export default function TWProgress({ currentStep, onStepClick }: TWProgressProps) {
  const t = getTrafficI18n()

  const steps = [
    { step: 1 as const, label: t.stepCampaign },
    { step: 2 as const, label: t.stepAdSet },
    { step: 3 as const, label: t.stepCreative },
    { step: 4 as const, label: t.stepSummary },
  ]

  return (
    <div className="flex items-center gap-1">
      {steps.map(({ step, label }, i) => {
        const isCompleted = step < currentStep
        const isCurrent = step === currentStep
        const isLast = i === steps.length - 1
        const isClickable = isCompleted && !!onStepClick

        return (
          <div key={step} className="flex items-center">
            {/* Step circle + label */}
            <button
              type="button"
              onClick={() => isClickable && onStepClick?.(step)}
              disabled={!isClickable}
              className={`flex items-center gap-2 ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
                  isCompleted
                    ? 'bg-primary border-primary text-white'
                    : isCurrent
                    ? 'border-primary bg-white text-primary'
                    : 'border-gray-300 bg-white text-gray-400'
                } ${isClickable ? 'hover:opacity-80' : ''}`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : step}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  isCurrent ? 'text-primary' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                } ${isClickable ? 'hover:text-primary' : ''}`}
              >
                {label}
              </span>
            </button>
            {/* Connecting line */}
            {!isLast && (
              <div
                className={`w-8 h-0.5 mx-2 ${
                  isCompleted ? 'bg-primary' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
