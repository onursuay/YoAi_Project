'use client'

import { getLocaleFromCookie, getWizardTranslations } from '@/lib/i18n/wizardTranslations'

interface WizardProgressProps {
  currentStep: 1 | 2 | 3 | 4
  onStepClick?: (step: 1 | 2 | 3 | 4) => void
  compact?: boolean
}

export default function WizardProgress({ currentStep, onStepClick, compact = false }: WizardProgressProps) {
  const t = getWizardTranslations(getLocaleFromCookie())

  const steps = [
    { step: 1, label: t.stepCampaign, percent: 25 },
    { step: 2, label: t.stepAdSet, percent: 50 },
    { step: 3, label: t.stepAdCreative, percent: 75 },
    { step: 4, label: t.stepSummaryPublish, percent: 100 },
  ]

  const currentPercent = steps.find(s => s.step === currentStep)?.percent ?? 0

  return (
    <div className={compact ? '' : 'mb-8'}>
      <div className="relative flex justify-between items-center mb-3">
        {steps.map(({ step, label }) => {
          const isDone = step < currentStep
          const isActive = step === currentStep
          return (
            <div
              key={step}
              onClick={() => onStepClick?.(step as 1 | 2 | 3 | 4)}
              className={`relative flex flex-col items-center flex-1 min-w-0 ${onStepClick ? 'cursor-pointer' : ''}`}
            >
              <div
                className={`
                  ${compact ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'}
                  rounded-full flex items-center justify-center font-bold transition-all duration-300
                  ${isDone
                    ? 'bg-primary shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.18)] text-white'
                    : isActive
                    ? 'bg-white border-2 border-primary text-primary shadow-[0_0_0_4px_rgba(var(--color-primary-rgb),0.12),0_2px_8px_rgba(0,0,0,0.10)]'
                    : 'bg-white border-2 border-gray-200 text-gray-400 shadow-sm'
                  }
                `}
              >
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step}
              </div>
              <span
                className={`mt-1.5 text-[12px] font-medium text-center whitespace-nowrap transition-colors duration-200 ${
                  isActive ? 'text-primary' : isDone ? 'text-primary/70' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {!compact && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200/60">
          <div
            className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500 ease-out rounded-full"
            style={{ width: `${currentPercent}%` }}
          />
        </div>
      )}
    </div>
  )
}
