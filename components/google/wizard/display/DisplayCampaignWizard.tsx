'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { defaultState } from '../shared/WizardTypes'
import type { WizardState, CampaignGoal } from '../shared/WizardTypes'
import { validateDisplayStep } from './displayWizardValidation'
import { buildCreatePayload } from '../shared/WizardHelpers'
import GoogleWizardShell, { type ResultBanner } from '../shared/GoogleWizardShell'
import StepConversionAndName from '../steps/StepConversionAndName'
import DisplayStepCampaignSettings from './steps/DisplayStepCampaignSettings'
import DisplayStepBudgetBidding from './steps/DisplayStepBudgetBidding'
import DisplayStepTargeting from './steps/DisplayStepTargeting'
import DisplayStepAds from './steps/DisplayStepAds'
import DisplayStepSummary from './steps/DisplayStepSummary'
import DisplaySidebar from './DisplaySidebar'

export type DisplaySubmitResult = null | 'full' | 'partial' | 'fail'

function buildDisplayInitialState(campaignGoal: CampaignGoal): WizardState {
  return {
    ...defaultState,
    campaignType: 'DISPLAY',
    campaignGoal,
    campaignName: '',
    displayLocationMode: 'ALL',
    displayBiddingFocus: 'CONVERSIONS',
    displayConversionsSub: 'MAXIMIZE_CONVERSIONS',
    displayValueSub: 'MAXIMIZE_CONVERSION_VALUE',
    displayClicksSub: 'MAXIMIZE_CLICKS',
    displayViewableCpm: '',
    displayAssets: [],
    displayCallToAction: '',
    biddingStrategy: 'MAXIMIZE_CONVERSIONS',
    biddingFocus: 'CONVERSION_COUNT',
    networkSettings: { targetGoogleSearch: false, targetSearchNetwork: false, targetContentNetwork: true },
    locations: [],
    languageIds: ['1037'],
    euPoliticalAdsDeclaration: 'NOT_POLITICAL',
    selectedAudienceSegments: [],
    selectedAudienceIds: [],
    dailyBudget: '',
    cpcBid: '',
    targetCpa: '',
    targetRoas: '',
    startDate: '',
    endDate: '',
    finalUrl: 'https://',
    displayBusinessName: '',
    displayHeadlines: ['', '', '', '', ''],
    displayLongHeadline: '',
    displayDescriptions: ['', '', '', '', ''],
    optimizedTargeting: true,
    keywordsRaw: '',
    headlines: ['', '', '', '', ''],
    descriptions: ['', '', ''],
    adSchedule: [],
    conversionActions: [],
    selectedConversionGoalIds: [],
    primaryConversionGoalId: null,
  }
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onToast?: (msg: string, type: 'success' | 'error') => void
  initialCampaignGoal?: CampaignGoal
}

const TOTAL_STEPS = 6

function normalizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const technical = /^(fetch|network|ECONNREFUSED|ETIMEDOUT|Failed to fetch)/i.test(msg)
  return technical ? '' : msg
}

export default function DisplayCampaignWizard({
  isOpen,
  onClose,
  onSuccess,
  onToast,
  initialCampaignGoal = 'SALES',
}: Props) {
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(() => buildDisplayInitialState(initialCampaignGoal))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<DisplaySubmitResult>(null)

  const t = useTranslations('dashboard.google.wizard')

  const PROGRESS_STEPS = [
    { label: t('conversion.title') },
    { label: t('display.steps.campaignSettings') },
    { label: t('display.steps.budgetBidding') },
    { label: t('steps.audience') },
    { label: t('display.steps.ads') },
    { label: t('display.steps.summary') },
  ]

  // Sol sidebar başlığı — kampanya türüne göre dinamik
  const campaignTypeLabel = (() => {
    switch (state.campaignType) {
      case 'DISPLAY': return t('display.campaignTypeDisplay')
      case 'SEARCH': return t('display.campaignTypeSearch')
      case 'PERFORMANCE_MAX': return t('display.campaignTypePerformanceMax')
      case 'VIDEO': return t('display.campaignTypeVideo')
      case 'SHOPPING': return t('display.campaignTypeShopping')
      case 'DEMAND_GEN': return t('display.campaignTypeDemandGen')
      case 'MULTI_CHANNEL': return t('display.campaignTypeApp')
      default: return t('display.campaignTypeDisplay')
    }
  })()

  useEffect(() => {
    if (!isOpen) return
    setStep(0)
    setState(buildDisplayInitialState(initialCampaignGoal))
    setError(null)
    setSubmitResult(null)
  }, [isOpen, initialCampaignGoal])

  const update = useCallback((partial: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])

  const stepProps = { state, update, t }

  const next = () => {
    const err = validateDisplayStep(step, state, t)
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
        const err = validateDisplayStep(i, state, t)
        if (err) {
          setError(err)
          setStep(i)
          return
        }
      }
    }
    setError(null)
    setStep(target)
  }

  const submit = async () => {
    const err = validateDisplayStep(4, state, t)
    if (err) {
      setError(err)
      return
    }
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
      onToast?.(isPartial ? t('toast.partialSuccess') : t('toast.success'), 'success')
    } catch (e: unknown) {
      setSubmitResult('fail')
      const displayMsg = normalizeError(e) || t('toast.networkError')
      setError(displayMsg)
      onToast?.(displayMsg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setStep(0)
    setState(buildDisplayInitialState(initialCampaignGoal))
    setError(null)
    setSubmitResult(null)
    onClose()
  }

  const acknowledgeResult = () => {
    onSuccess()
    handleClose()
  }

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
      title={t('display.wizardHeaderTitle')}
      steps={PROGRESS_STEPS}
      currentStep={step}
      campaignTypeLabel={campaignTypeLabel}
      onStepClick={goToStep}
      rightSummary={<DisplaySidebar state={state} currentStep={step} t={t} />}
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
      {step === 0 && <StepConversionAndName {...stepProps} />}
      {step === 1 && <DisplayStepCampaignSettings {...stepProps} />}
      {step === 2 && <DisplayStepBudgetBidding {...stepProps} />}
      {step === 3 && <DisplayStepTargeting {...stepProps} />}
      {step === 4 && <DisplayStepAds {...stepProps} />}
      {step === 5 && <DisplayStepSummary {...stepProps} />}
    </GoogleWizardShell>
  )
}
