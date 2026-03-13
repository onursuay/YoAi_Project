'use client'

interface AudienceWizardNavigationProps {
  currentStep: number
  totalSteps: number
  onBack: () => void
  onNext: () => void
  canGoNext: boolean
  isSubmitting?: boolean
  nextLabel?: string
  backLabel?: string
  blockedReason?: string | null
}

export default function AudienceWizardNavigation({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  canGoNext,
  isSubmitting = false,
  nextLabel,
  backLabel,
  blockedReason,
}: AudienceWizardNavigationProps) {
  const isFirst = currentStep === 1
  const isLast = currentStep === totalSteps
  const resolvedNext = nextLabel ?? (isLast ? 'Kaydet' : 'Devam')
  const resolvedBack = backLabel ?? 'Geri'

  return (
    <div className="flex items-center justify-between pt-6 border-t border-gray-200 mt-8">
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
        {resolvedBack}
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
          {isSubmitting ? 'İşleniyor...' : resolvedNext}
        </button>
      </div>
    </div>
  )
}
