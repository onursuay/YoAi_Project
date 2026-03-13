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
      <div className="flex justify-between items-center mb-2">
        {steps.map(({ step, label, percent }) => (
          <div
            key={step}
            onClick={() => onStepClick?.(step as 1 | 2 | 3 | 4)}
            className={`flex flex-col items-center flex-1 min-w-0 ${step <= currentStep ? 'text-primary' : 'text-gray-400'} ${onStepClick ? 'cursor-pointer' : ''}`}
          >
            <div
              className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full flex items-center justify-center text-sm font-semibold border-2 ${
                step < currentStep
                  ? 'bg-primary border-primary text-white'
                  : step === currentStep
                  ? 'border-2 border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                  : 'border-gray-300 bg-white text-gray-400'
              }`}
            >
              {step < currentStep ? '✓' : step}
            </div>
            <span className="mt-1 text-[10px] font-medium text-center whitespace-nowrap">{label}</span>
          </div>
        ))}
      </div>
      {!compact && (
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${currentPercent}%` }}
          />
        </div>
      )}
    </div>
  )
}
