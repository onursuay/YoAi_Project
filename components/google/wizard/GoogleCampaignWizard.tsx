'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { defaultState } from './shared/WizardTypes'
import type { WizardState, CampaignGoal } from './shared/WizardTypes'
import { validateStep } from './shared/WizardValidation'
import { buildCreatePayload } from './shared/WizardHelpers'
import GoogleWizardShell, { type ResultBanner } from './shared/GoogleWizardShell'
import StepGoalType from './steps/StepGoalType'
import StepConversionAndName from './steps/StepConversionAndName'
import StepBiddingAcquisition from './steps/StepBiddingAcquisition'
import StepCampaignSettingsSearch from './steps/StepCampaignSettingsSearch'
import StepAIMax from './steps/StepAIMax'
import StepKeywordsAndAds from './steps/StepKeywordsAndAds'
import StepBudget from './steps/StepBudget'
import StepSummary from './steps/StepSummary'

export type SubmitResult = null | 'full' | 'partial' | 'fail'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onToast?: (msg: string, type: 'success' | 'error') => void
  /** When PERFORMANCE_MAX selected on step 0 and Next clicked — close this wizard and open PMax wizard */
  onOpenPMaxWizard?: () => void
  /** When DISPLAY selected on step 0 and Next clicked — close this wizard and open Display wizard */
  onOpenDisplayWizard?: (payload: { campaignGoal: CampaignGoal }) => void
}

const TOTAL_STEPS = 8

/** Normalize error for display — avoid exposing raw technical messages to users. */
function normalizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const technical = /^(fetch|network|ECONNREFUSED|ETIMEDOUT|Failed to fetch)/i.test(msg)
  return technical ? '' : msg
}

export default function GoogleCampaignWizard({
  isOpen,
  onClose,
  onSuccess,
  onToast,
  onOpenPMaxWizard,
  onOpenDisplayWizard,
}: Props) {
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(defaultState)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmitResult>(null)

  const t = useTranslations('dashboard.google.wizard')
  // Search-specific 8-step flow
  const STEPS = [
    { label: t('steps.goal') },
    { label: t('steps.conversionAndName') },
    { label: t('steps.bidding') },
    { label: t('steps.campaignSettings') },
    { label: t('steps.aiMax') },
    { label: t('steps.keywordsAndAds') },
    { label: t('steps.budget') },
    { label: t('steps.summary') },
  ]

  useEffect(() => {
    if (isOpen) { setStep(0); setState(defaultState); setError(null); setSubmitResult(null) }
  }, [isOpen])

  const update = (partial: Partial<WizardState>) => setState(prev => ({ ...prev, ...partial }))

  const next = () => {
    // PERFORMANCE_MAX: route to PMax wizard — campaign type based entry
    if (step === 0 && state.campaignType === 'PERFORMANCE_MAX') {
      if (onOpenPMaxWizard) {
        onOpenPMaxWizard()
        handleClose()
      } else {
        setError(t('performanceMaxNotReady'))
      }
      return
    }
    if (step === 0 && state.campaignType === 'DISPLAY') {
      if (onOpenDisplayWizard) {
        onOpenDisplayWizard({ campaignGoal: state.campaignGoal })
        handleClose()
      } else {
        setError(t('displayNotReady'))
      }
      return
    }
    const err = validateStep(step, state, t)
    if (err) { setError(err); return }
    setError(null)
    setStep(s => s + 1)
  }

  const back = () => { setError(null); setStep(s => s - 1) }

  const goToStep = (target: number) => {
    if (target === step) return
    if (target > step) {
      for (let i = step; i < target; i++) {
        const err = validateStep(i, state, t)
        if (err) { setError(err); setStep(i); return }
      }
    }
    setError(null)
    setStep(target)
  }

  const submit = async () => {
    // PERFORMANCE_MAX: do not submit — has separate flow
    if (state.campaignType === 'PERFORMANCE_MAX') return
    setSubmitting(true)
    setError(null)
    setSubmitResult(null)
    try {
      const payload = buildCreatePayload(state, t('adgroup.defaultNameFallback'))
      const res = await fetch('/api/integrations/google-ads/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setSubmitResult('fail')
        setError(data.error ?? t('toast.error'))
        onToast?.(data.error ?? t('toast.error'), 'error')
        return
      }

      const isPartial = Boolean(data.conversionGoalsWarning)
      setSubmitResult(isPartial ? 'partial' : 'full')
      onToast?.(
        isPartial ? t('toast.partialSuccess') : t('toast.success'),
        'success'
      )
    } catch (e: unknown) {
      setSubmitResult('fail')
      const displayMsg = normalizeError(e) || t('toast.networkError')
      setError(displayMsg)
      onToast?.(displayMsg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => { setStep(0); setState(defaultState); setError(null); setSubmitResult(null); onClose() }

  const acknowledgeResult = () => {
    onSuccess()
    handleClose()
  }

  const stepProps = { state, update, t }
  const isFirstStep = step === 0
  const isLastStep = step === TOTAL_STEPS - 1
  const isResultShown = submitResult === 'full' || submitResult === 'partial'

  const resultBanner: ResultBanner | null = isResultShown
    ? {
        variant: submitResult === 'full' ? 'full' : 'partial',
        title: submitResult === 'full' ? t('result.fullTitle') : t('result.partialTitle'),
        message: submitResult === 'full' ? t('result.fullMessage') : t('result.partialMessage'),
        acknowledgeLabel: t('result.acknowledge'),
        onAcknowledge: acknowledgeResult,
      }
    : null

  return (
    <GoogleWizardShell
      isOpen={isOpen}
      onClose={isResultShown ? acknowledgeResult : handleClose}
      eyebrow={t('display.wizardHeaderEyebrow')}
      title={t('title')}
      steps={STEPS}
      currentStep={step}
      campaignTypeLabel={t('display.campaignTypeSearch')}
      onStepClick={goToStep}
      errorMessage={error}
      resultBanner={resultBanner}
      isFirstStep={isFirstStep}
      isLastStep={isLastStep}
      submitting={submitting}
      onBack={back}
      onNext={next}
      onSubmit={submit}
      labels={{
        cancel: t('nav.cancel'),
        back: t('nav.back'),
        next: t('nav.next'),
        submit: t('nav.submit'),
        submitting: t('nav.submitting'),
      }}
    >
      {step === 0 && (
        <>
          <StepGoalType {...stepProps} />
          {state.campaignType === 'PERFORMANCE_MAX' && (
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-medium text-primary">{t('performanceMaxPlaceholder')}</p>
            </div>
          )}
          {state.campaignType === 'DISPLAY' && (
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-medium text-primary">{t('displayPlaceholder')}</p>
            </div>
          )}
        </>
      )}
      {step >= 1 && state.campaignType === 'PERFORMANCE_MAX' && (
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center">
          <p className="text-sm font-medium text-primary">{t('performanceMaxPlaceholder')}</p>
        </div>
      )}
      {step >= 1 && state.campaignType !== 'PERFORMANCE_MAX' && (
        <>
          {step === 1 && <StepConversionAndName {...stepProps} />}
          {step === 2 && <StepBiddingAcquisition {...stepProps} />}
          {step === 3 && <StepCampaignSettingsSearch {...stepProps} />}
          {step === 4 && <StepAIMax {...stepProps} />}
          {step === 5 && <StepKeywordsAndAds {...stepProps} />}
          {step === 6 && <StepBudget {...stepProps} />}
          {step === 7 && <StepSummary {...stepProps} />}
        </>
      )}
    </GoogleWizardShell>
  )
}
