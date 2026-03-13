'use client'

import { getLocaleFromCookie, getWizardTranslations } from '@/lib/i18n/wizardTranslations'

interface WizardNavigationProps {
  currentStep: 1 | 2 | 3 | 4
  onBack: () => void
  onNext: () => void
  canGoNext: boolean
  isSubmitting?: boolean
  nextLabel?: string
  backLabel?: string
  blockedReason?: string | null
  asFooter?: boolean
}

export default function WizardNavigation({
  currentStep,
  onBack,
  onNext,
  canGoNext,
  isSubmitting = false,
  nextLabel,
  backLabel,
  blockedReason,
  asFooter = false,
}: WizardNavigationProps) {
  const t = getWizardTranslations(getLocaleFromCookie())
  const resolvedNextLabel = nextLabel ?? t.next
  const resolvedBackLabel = backLabel ?? t.back
  const isFirst = currentStep === 1

  return (
    <div className={asFooter ? "flex items-center justify-between px-6 h-16 border-t border-gray-200 bg-white flex-shrink-0" : "flex items-center justify-between pt-6 border-t border-gray-200 mt-8"}>
      <button
        type="button"
        onClick={onBack}
        disabled={isFirst}
        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isFirst
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-gray-700 border border-gray-300 hover:bg-gray-50'
        }`}
      >
        {resolvedBackLabel}
      </button>
      <div className="flex flex-col items-end gap-1">
        {!canGoNext && blockedReason && (
          <p className="text-caption text-amber-600">{blockedReason}</p>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext || isSubmitting}
          className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? t.navigationProcessing : resolvedNextLabel}
        </button>
      </div>
    </div>
  )
}
