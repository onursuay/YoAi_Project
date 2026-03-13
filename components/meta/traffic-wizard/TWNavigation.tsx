'use client'

import { getTrafficI18n } from './i18n'

interface TWNavigationProps {
  currentStep: 1 | 2 | 3 | 4
  onBack: () => void
  onNext: () => void
  canGoNext: boolean
}

export default function TWNavigation({ currentStep, onBack, onNext, canGoNext }: TWNavigationProps) {
  const t = getTrafficI18n()
  const isFirst = currentStep === 1
  const isLast = currentStep === 4

  return (
    <div className="h-16 flex items-center justify-between px-8 border-t border-gray-200 bg-white flex-shrink-0">
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
        {t.back}
      </button>

      <span className="text-xs text-gray-400">
        {t.stepOf.replace('{current}', String(currentStep)).replace('{total}', '4')}
      </span>

      {isLast ? (
        <div className="w-[100px]" />
      ) : (
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.next}
        </button>
      )}
    </div>
  )
}
