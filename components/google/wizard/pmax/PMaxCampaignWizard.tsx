'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { defaultPMaxState } from './shared/PMaxWizardTypes'
import type { PMaxWizardState } from './shared/PMaxWizardTypes'
import { validatePMaxStep, getPMaxBlockingIssues } from './shared/PMaxWizardValidation'
import { buildPerformanceMaxCreatePayload } from './shared/PMaxCreatePayload'
import GoogleWizardShell, { type ResultBanner, type WizardShellStep } from '../shared/GoogleWizardShell'
import PMaxSummaryPanel from './PMaxSummaryPanel'
import PMaxStepEntry from './steps/PMaxStepEntry'
import PMaxStepBiddingAcquisition from './steps/PMaxStepBiddingAcquisition'
import PMaxStepCampaignSettings from './steps/PMaxStepCampaignSettings'
import PMaxStepAssetGroup from './steps/PMaxStepAssetGroup'
import PMaxStepBudget from './steps/PMaxStepBudget'
import PMaxStepSummary from './steps/PMaxStepSummary'

export type PMaxSubmitResult = null | 'full' | 'partial' | 'fail'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onToast?: (msg: string, type: 'success' | 'error') => void
}

const TOTAL_STEPS = 6

function normalizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const technical = /^(fetch|network|ECONNREFUSED|ETIMEDOUT|Failed to fetch)/i.test(msg)
  return technical ? '' : msg
}

export default function PMaxCampaignWizard({ isOpen, onClose, onSuccess, onToast }: Props) {
  const [step, setStep] = useState(0)
  const [state, setState] = useState<PMaxWizardState>(defaultPMaxState)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<PMaxSubmitResult>(null)

  const t = useTranslations('dashboard.google.pmaxWizard')
  const tCommon = useTranslations('dashboard.google.wizard')

  const CAMPAIGN_SETTINGS_SUBS: { id: string; label: string }[] = [
    { id: 'pmax-settings-section-0', label: t('settings.locationsTitle') },
    { id: 'pmax-settings-section-1', label: t('settings.languagesTitle') },
    { id: 'pmax-settings-section-2', label: t('settings.euPoliticalTitle') },
    { id: 'pmax-settings-section-3', label: t('settings.devicesTitle') },
    { id: 'pmax-settings-section-4', label: t('settings.scheduleTitle') },
    { id: 'pmax-settings-section-5', label: t('settings.datesTitle') },
    { id: 'pmax-settings-section-6', label: t('settings.urlOptionsTitle') },
    { id: 'pmax-settings-section-7', label: t('settings.pageFeedsTitle') },
    { id: 'pmax-settings-section-8', label: t('settings.brandExclusionsTitle') },
  ]

  const STEPS: WizardShellStep[] = [
    { label: t('steps.entry') },
    { label: t('steps.bidding') },
    { label: t('steps.campaignSettings'), subItems: CAMPAIGN_SETTINGS_SUBS },
    { label: t('steps.assetGroup') },
    { label: t('steps.budget') },
    { label: t('steps.summary') },
  ]

  useEffect(() => {
    if (isOpen) {
      setStep(0)
      setState(defaultPMaxState)
      setError(null)
      setSubmitResult(null)
    }
  }, [isOpen])

  const update = (partial: Partial<PMaxWizardState>) => setState(prev => ({ ...prev, ...partial }))

  const next = () => {
    const err = validatePMaxStep(step, state, t)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setStep(s => s + 1)
  }

  const back = () => {
    setError(null)
    setStep(s => s - 1)
  }

  const goToStep = (target: number) => {
    if (target === step) return
    if (target > step) {
      for (let i = step; i < target; i++) {
        const err = validatePMaxStep(i, state, t)
        if (err) { setError(err); setStep(i); return }
      }
    }
    setError(null)
    setStep(target)
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    setSubmitResult(null)
    try {
      const payload = buildPerformanceMaxCreatePayload(state)
      const res = await fetch('/api/integrations/google-ads/campaigns/create-performance-max', {
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

      const isPartial = Boolean(data.partialSuccess || data.conversionGoalsWarning)
      setSubmitResult(isPartial ? 'partial' : 'full')
      onToast?.(
        isPartial ? (t('toast.partialSuccess') || data.conversionGoalsWarning) : t('toast.success'),
        'success'
      )
    } catch (err) {
      setSubmitResult('fail')
      const displayMsg = normalizeError(err) || t('toast.networkError')
      setError(displayMsg)
      onToast?.(displayMsg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setStep(0)
    setState(defaultPMaxState)
    setError(null)
    setSubmitResult(null)
    onClose()
  }

  const acknowledgeResult = () => {
    onSuccess()
    handleClose()
  }

  const stepProps = { state, update, t }
  const blockingIssues = step === 5 ? getPMaxBlockingIssues(state, t) : []
  const hasBlockingIssues = blockingIssues.length > 0

  const isFirstStep = step === 0
  const isLastStep = step === TOTAL_STEPS - 1
  const isResultShown = submitResult === 'full' || submitResult === 'partial'
  // PMax giriş ekranı (step 0) seçim/entry niteliğindedir — özet paneli yalnızca
  // gerçek form adımlarında (step > 0) görünür.
  const showPMaxSummary = step > 0

  // Step status: validated done/error before current; current; pending after
  const stepStatusOf = (i: number): 'done' | 'error' | 'current' | 'pending' => {
    if (i === step) return 'current'
    if (i > step) return 'pending'
    const err = validatePMaxStep(i, state, t)
    return err ? 'error' : 'done'
  }

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
      eyebrow={tCommon('display.wizardHeaderEyebrow')}
      title={t('title')}
      steps={STEPS}
      currentStep={step}
      campaignTypeLabel={tCommon('display.campaignTypePerformanceMax')}
      onStepClick={goToStep}
      stepStatusOf={stepStatusOf}
      rightSummary={
        showPMaxSummary ? (
          <PMaxSummaryPanel
            state={state}
            currentStep={step}
            t={t}
            sidebarTitle={tCommon('display.summarySidebarTitle')}
            readyLabel={tCommon('display.summaryReadyLabel')}
            missingLabel={tCommon('display.summaryMissingLabel')}
          />
        ) : null
      }
      errorMessage={error}
      resultBanner={resultBanner}
      isFirstStep={isFirstStep}
      isLastStep={isLastStep}
      submitting={submitting}
      submitDisabled={hasBlockingIssues}
      submitDisabledReason={blockingIssues[0]}
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
      {step === 0 && <PMaxStepEntry {...stepProps} />}
      {step === 1 && <PMaxStepBiddingAcquisition {...stepProps} />}
      {step === 2 && <PMaxStepCampaignSettings {...stepProps} />}
      {step === 3 && <PMaxStepAssetGroup {...stepProps} />}
      {step === 4 && <PMaxStepBudget {...stepProps} />}
      {step === 5 && <PMaxStepSummary {...stepProps} />}
    </GoogleWizardShell>
  )
}
