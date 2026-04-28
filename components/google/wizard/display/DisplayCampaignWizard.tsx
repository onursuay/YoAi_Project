'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { X, AlertCircle, Loader2, CheckCircle2, AlertTriangle, Check } from 'lucide-react'
import { defaultState } from '../shared/WizardTypes'
import type { WizardState, CampaignGoal } from '../shared/WizardTypes'
import { validateDisplayStep } from './displayWizardValidation'
import { buildCreatePayload } from '../shared/WizardHelpers'
import StepConversionAndName from '../steps/StepConversionAndName'
import DisplayStepCampaignSettings from './steps/DisplayStepCampaignSettings'
import DisplayStepBudgetBidding from './steps/DisplayStepBudgetBidding'
import DisplayStepTargeting from './steps/DisplayStepTargeting'
import DisplayStepAds from './steps/DisplayStepAds'
import DisplayStepSummary from './steps/DisplayStepSummary'
import { DisplayProgress } from './DisplayWizardUI'
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

  useEffect(() => {
    if (!isOpen) return
    setStep(0)
    setState(buildDisplayInitialState(initialCampaignGoal))
    setError(null)
    setSubmitResult(null)
  }, [isOpen, initialCampaignGoal])

  // Lock body scroll & Escape key
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', handleKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

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

  const acknowledgeResult = () => {
    onSuccess()
    handleClose()
  }

  const handleClose = () => {
    setStep(0)
    setState(buildDisplayInitialState(initialCampaignGoal))
    setError(null)
    setSubmitResult(null)
    onClose()
  }

  if (!isOpen) return null

  const isFirstStep = step === 0
  const isLastStep = step === TOTAL_STEPS - 1
  const isResultShown = submitResult === 'full' || submitResult === 'partial'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ── Header ── */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">G</span>
          </div>
          <h2 className="text-base font-semibold text-gray-900">{t('display.wizardTitle')}</h2>
        </div>

        <div className="flex-1 flex justify-center">
          <DisplayProgress
            steps={PROGRESS_STEPS}
            currentStep={step}
            onStepClick={isResultShown ? undefined : goToStep}
          />
        </div>

        <div className="min-w-[200px] flex justify-end">
          <button
            onClick={isResultShown ? acknowledgeResult : handleClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={t('nav.cancel')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Body: 2-column layout ── */}
      <div className="flex-1 relative overflow-hidden bg-white">
        {/* Google-renkli yılan ışık — viewport frame'inde, kartların altında */}
        <div className="google-snake-border" aria-hidden="true" />
        <div className="absolute inset-0 overflow-y-auto z-10">
          <div className="max-w-6xl mx-auto px-8 py-8">
            <div className="grid grid-cols-3 gap-8">
            {/* Left column — Step content */}
            <div className="col-span-2 space-y-4">
              {submitResult === 'full' && (
                <div className="flex flex-col items-center justify-center py-10 px-6 rounded-xl bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mb-3" />
                  <h3 className="text-lg font-semibold text-emerald-800 mb-1">{t('result.fullTitle')}</h3>
                  <p className="text-sm text-emerald-700 text-center mb-4">{t('result.fullMessage')}</p>
                  <button
                    type="button"
                    onClick={acknowledgeResult}
                    className="px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    {t('result.acknowledge')}
                  </button>
                </div>
              )}
              {submitResult === 'partial' && (
                <div className="flex flex-col items-center justify-center py-10 px-6 rounded-xl bg-gray-50 border border-gray-200">
                  <AlertTriangle className="w-12 h-12 text-gray-600 mb-3" />
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">{t('result.partialTitle')}</h3>
                  <p className="text-sm text-gray-700 text-center mb-4">{t('result.partialMessage')}</p>
                  <button
                    type="button"
                    onClick={acknowledgeResult}
                    className="px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    {t('result.acknowledge')}
                  </button>
                </div>
              )}
              {error && !isResultShown && (
                <div className="flex items-start gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {!isResultShown && (
                <>
                  {step === 0 && <StepConversionAndName {...stepProps} />}
                  {step === 1 && <DisplayStepCampaignSettings {...stepProps} />}
                  {step === 2 && <DisplayStepBudgetBidding {...stepProps} />}
                  {step === 3 && <DisplayStepTargeting {...stepProps} />}
                  {step === 4 && <DisplayStepAds {...stepProps} />}
                  {step === 5 && <DisplayStepSummary {...stepProps} />}
                </>
              )}
            </div>

            {/* Right column — Sticky sidebar */}
            <div className="col-span-1">
              <DisplaySidebar state={state} currentStep={step} t={t} />
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      {!isResultShown && (
        <div className="h-16 flex items-center justify-between px-8 border-t border-gray-200 bg-white flex-shrink-0">
          <button
            type="button"
            onClick={isFirstStep ? handleClose : back}
            disabled={submitting}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isFirstStep
                ? 'text-gray-700 hover:bg-gray-50'
                : 'text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {isFirstStep ? t('nav.cancel') : t('nav.back')}
          </button>

          <span className="text-xs text-gray-400">
            {step + 1} / {TOTAL_STEPS}
          </span>

          {isLastStep ? (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {submitting ? t('nav.submitting') : t('nav.submit')}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {t('nav.next')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
