'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { X, ChevronLeft, ChevronRight, Check, AlertCircle, Loader2 } from 'lucide-react'
import { defaultState } from './shared/WizardTypes'
import type { WizardState } from './shared/WizardTypes'
import { validateStep } from './shared/WizardValidation'
import { buildCreatePayload } from './shared/WizardHelpers'
import StepGoalType from './steps/StepGoalType'
import StepCampaignSettings from './steps/StepCampaignSettings'
import StepLocationLanguage from './steps/StepLocationLanguage'
import StepAudience from './steps/StepAudience'
import StepAdGroupKeywords from './steps/StepAdGroupKeywords'
import StepAdCreation from './steps/StepAdCreation'
import StepAdSchedule from './steps/StepAdSchedule'
import StepSummary from './steps/StepSummary'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onToast?: (msg: string, type: 'success' | 'error') => void
}

const TOTAL_STEPS = 8

export default function GoogleCampaignWizard({ isOpen, onClose, onSuccess, onToast }: Props) {
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(defaultState)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const t = useTranslations('dashboard.google.wizard')
  const STEPS = [
    t('steps.goal'),
    t('steps.settings'),
    t('steps.location'),
    t('steps.audience'),
    t('steps.adgroup'),
    t('steps.ad'),
    t('steps.schedule'),
    t('steps.summary'),
  ]

  useEffect(() => {
    if (isOpen) { setStep(0); setState(defaultState); setError(null) }
  }, [isOpen])

  const update = (partial: Partial<WizardState>) => setState(prev => ({ ...prev, ...partial }))

  const next = () => {
    const err = validateStep(step, state, t)
    if (err) { setError(err); return }
    setError(null)
    setStep(s => s + 1)
  }

  const back = () => { setError(null); setStep(s => s - 1) }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const payload = buildCreatePayload(state)
      const res = await fetch('/api/integrations/google-ads/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t('toast.error')); return }
      onToast?.(t('toast.success'), 'success')
      onSuccess()
      handleClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => { setStep(0); setState(defaultState); setError(null); onClose() }

  if (!isOpen) return null

  const stepProps = { state, update, t }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
            <p className="text-sm text-gray-500">{step + 1} / {TOTAL_STEPS} — {STEPS[step]}</p>
          </div>
          <button type="button" onClick={handleClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <div key={i} className="flex items-center gap-1 flex-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                  title={STEPS[i]}
                >
                  {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                {i < TOTAL_STEPS - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 0 && <StepGoalType {...stepProps} />}
          {step === 1 && <StepCampaignSettings {...stepProps} />}
          {step === 2 && <StepLocationLanguage {...stepProps} />}
          {step === 3 && <StepAudience {...stepProps} />}
          {step === 4 && <StepAdGroupKeywords {...stepProps} />}
          {step === 5 && <StepAdCreation {...stepProps} />}
          {step === 6 && <StepAdSchedule {...stepProps} />}
          {step === 7 && <StepSummary {...stepProps} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={step === 0 ? handleClose : back}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
            disabled={submitting}
          >
            {step === 0 ? <X className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {step === 0 ? t('nav.cancel') : t('nav.back')}
          </button>
          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={next}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t('nav.next')} <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {submitting ? t('nav.submitting') : t('nav.submit')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
