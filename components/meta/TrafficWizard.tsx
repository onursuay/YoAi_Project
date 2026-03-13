'use client'

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import TWProgress from './traffic-wizard/TWProgress'
import TWNavigation from './traffic-wizard/TWNavigation'
import TWSidebar from './traffic-wizard/TWSidebar'
import TWStepCampaign from './traffic-wizard/TWStepCampaign'
import TWStepAdSet from './traffic-wizard/TWStepAdSet'
import TWStepCreative from './traffic-wizard/TWStepCreative'
import TWStepSummary from './traffic-wizard/TWStepSummary'
import { getTrafficI18n } from './traffic-wizard/i18n'
import { initialTrafficWizardState } from './traffic-wizard/types'
import type { TrafficWizardState } from './traffic-wizard/types'

interface TrafficWizardProps {
  isOpen: boolean
  onClose: () => void
}

export default function TrafficWizard({ isOpen, onClose }: TrafficWizardProps) {
  const t = getTrafficI18n()
  const [state, setState] = useState<TrafficWizardState>({ ...initialTrafficWizardState })
  const [resetKey, setResetKey] = useState(0)

  // Reset state when opening — force full reset with key increment
  useEffect(() => {
    if (isOpen) {
      setState({ ...initialTrafficWizardState })
      setResetKey(prev => {
        const newKey = prev + 1
        console.log('[TrafficWizard] Reset triggered, new key:', newKey)
        return newKey
      })
    }
  }, [isOpen])

  // Lock body scroll & Escape key
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)

    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, onClose])

  const currentStep = state.currentStep

  const goNext = useCallback(() => {
    if (currentStep < 4) {
      setState(prev => ({ ...prev, currentStep: (prev.currentStep + 1) as 1 | 2 | 3 | 4 }))
    }
  }, [currentStep])

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setState(prev => ({ ...prev, currentStep: (prev.currentStep - 1) as 1 | 2 | 3 | 4 }))
    }
  }, [currentStep])

  const updateState = useCallback((updates: Partial<TrafficWizardState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  const goToStep = useCallback((step: 1 | 2 | 3 | 4) => {
    setState(prev => ({ ...prev, currentStep: step }))
  }, [])

  // Step validation: required name fields
  const canGoNext =
    currentStep === 1 ? state.campaign.name.trim().length > 0
    : currentStep === 2 ? state.adset.name.trim().length > 0
    : true

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ── Header ── */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-4">
          <img src="/meta-logo.png" alt="Meta" width={28} height={28} className="shrink-0" />
          <h2 className="text-base font-semibold text-gray-900">{t.wizardTitle}</h2>
        </div>

        <div className="flex-1 flex justify-center">
          <TWProgress currentStep={currentStep} onStepClick={goToStep} />
        </div>

        <button
          onClick={onClose}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Body: 2-column layout ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <div className="grid grid-cols-3 gap-8">
            {/* Left column — Step content */}
            <div className="col-span-2">
              {currentStep === 1 && (
                <TWStepCampaign key={`campaign-${resetKey}`} state={state} onChange={updateState} />
              )}
              {currentStep === 2 && <TWStepAdSet key={`adset-${resetKey}`} state={state} onChange={updateState} />}
              {currentStep === 3 && <TWStepCreative key={`creative-${resetKey}`} state={state} onChange={updateState} />}
              {currentStep === 4 && <TWStepSummary key={`summary-${resetKey}`} state={state} onGoToStep={goToStep} onClose={onClose} />}
            </div>

            {/* Right column — Sticky sidebar */}
            <div className="col-span-1">
              <TWSidebar state={state} currentStep={currentStep} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <TWNavigation
        currentStep={currentStep}
        onBack={goBack}
        onNext={goNext}
        canGoNext={canGoNext}
      />
    </div>
  )
}
