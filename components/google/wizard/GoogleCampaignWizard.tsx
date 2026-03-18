'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { X, ChevronLeft, ChevronRight, Check, AlertCircle, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { defaultState } from './shared/WizardTypes'
import type { WizardState } from './shared/WizardTypes'
import { validateStep } from './shared/WizardValidation'
import { buildCreatePayload } from './shared/WizardHelpers'
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
}

const TOTAL_STEPS = 8

/** Normalize error for display — avoid exposing raw technical messages to users. */
function normalizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const technical = /^(fetch|network|ECONNREFUSED|ETIMEDOUT|Failed to fetch)/i.test(msg)
  return technical ? '' : msg
}

export default function GoogleCampaignWizard({ isOpen, onClose, onSuccess, onToast }: Props) {
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(defaultState)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmitResult>(null)

  const t = useTranslations('dashboard.google.wizard')
  // Search-specific 8-step flow
  const STEPS = [
    t('steps.goal'),
    t('steps.conversionAndName'),
    t('steps.bidding'),
    t('steps.campaignSettings'),
    t('steps.aiMax'),
    t('steps.keywordsAndAds'),
    t('steps.budget'),
    t('steps.summary'),
  ]

  useEffect(() => {
    if (isOpen) { setStep(0); setState(defaultState); setError(null); setSubmitResult(null) }
  }, [isOpen])

  const update = (partial: Partial<WizardState>) => setState(prev => ({ ...prev, ...partial }))

  const next = () => {
    // PERFORMANCE_MAX: block Search flow — will have its own wizard later
    if (step === 0 && state.campaignType === 'PERFORMANCE_MAX') {
      setError(t('performanceMaxNotReady'))
      return
    }
    const err = validateStep(step, state, t)
    if (err) { setError(err); return }
    setError(null)
    setStep(s => s + 1)
  }

  const back = () => { setError(null); setStep(s => s - 1) }

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

  const acknowledgeResult = () => {
    onSuccess()
    handleClose()
  }

  const handleClose = () => { setStep(0); setState(defaultState); setError(null); setSubmitResult(null); onClose() }

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
          <button
            type="button"
            onClick={submitResult === 'full' || submitResult === 'partial' ? acknowledgeResult : handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
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
          {submitResult === 'full' && (
            <div className="flex flex-col items-center justify-center py-8 px-4 rounded-xl bg-green-50 border border-green-200">
              <CheckCircle2 className="w-12 h-12 text-green-600 mb-3" />
              <h3 className="text-lg font-semibold text-green-800 mb-1">{t('result.fullTitle')}</h3>
              <p className="text-sm text-green-700 text-center mb-4">{t('result.fullMessage')}</p>
              <button
                type="button"
                onClick={acknowledgeResult}
                className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                {t('result.acknowledge')}
              </button>
            </div>
          )}
          {submitResult === 'partial' && (
            <div className="flex flex-col items-center justify-center py-8 px-4 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-12 h-12 text-amber-600 mb-3" />
              <h3 className="text-lg font-semibold text-amber-800 mb-1">{t('result.partialTitle')}</h3>
              <p className="text-sm text-amber-700 text-center mb-4">{t('result.partialMessage')}</p>
              <button
                type="button"
                onClick={acknowledgeResult}
                className="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-white"
              >
                {t('result.acknowledge')}
              </button>
            </div>
          )}
          {error && submitResult !== 'full' && submitResult !== 'partial' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {submitResult !== 'full' && submitResult !== 'partial' && (
            <>
              {step === 0 && (
                <>
                  <StepGoalType {...stepProps} />
                  {state.campaignType === 'PERFORMANCE_MAX' && (
                    <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-medium text-amber-800">{t('performanceMaxPlaceholder')}</p>
                    </div>
                  )}
                </>
              )}
              {step >= 1 && state.campaignType === 'PERFORMANCE_MAX' && (
                <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-6 text-center">
                  <p className="text-sm font-medium text-amber-800">{t('performanceMaxPlaceholder')}</p>
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
            </>
          )}
        </div>

        {/* Footer — hidden when showing success/partial result */}
        {submitResult !== 'full' && submitResult !== 'partial' && (
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
        )}
      </div>
    </div>
  )
}
