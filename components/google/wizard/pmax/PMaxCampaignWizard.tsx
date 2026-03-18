'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { X, ChevronLeft, ChevronRight, Check, AlertCircle, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { defaultPMaxState } from './shared/PMaxWizardTypes'
import type { PMaxWizardState } from './shared/PMaxWizardTypes'
import { validatePMaxStep, getPMaxBlockingIssues } from './shared/PMaxWizardValidation'
import { buildPerformanceMaxCreatePayload } from './shared/PMaxCreatePayload'
import PMaxStepGoalType from './steps/PMaxStepGoalType'
import PMaxStepConversionAndName from './steps/PMaxStepConversionAndName'
import PMaxStepBiddingAcquisition from './steps/PMaxStepBiddingAcquisition'
import PMaxStepCampaignSettings from './steps/PMaxStepCampaignSettings'
import PMaxStepAssetGroup from './steps/PMaxStepAssetGroup'
import PMaxStepSignals from './steps/PMaxStepSignals'
import PMaxStepBudget from './steps/PMaxStepBudget'
import PMaxStepSummary from './steps/PMaxStepSummary'

export type PMaxSubmitResult = null | 'full' | 'partial' | 'fail'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onToast?: (msg: string, type: 'success' | 'error') => void
}

const TOTAL_STEPS = 8

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
  const STEPS = [
    t('steps.goal'),
    t('steps.conversionAndName'),
    t('steps.bidding'),
    t('steps.campaignSettings'),
    t('steps.assetGroup'),
    t('steps.signals'),
    t('steps.budget'),
    t('steps.summary'),
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

  const acknowledgeResult = () => {
    onSuccess()
    handleClose()
  }

  const handleClose = () => {
    setStep(0)
    setState(defaultPMaxState)
    setError(null)
    setSubmitResult(null)
    onClose()
  }

  if (!isOpen) return null

  const stepProps = { state, update, t }
  const blockingIssues = step === 7 ? getPMaxBlockingIssues(state, t) : []
  const hasBlockingIssues = blockingIssues.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
            <p className="text-sm text-gray-500">
              {step + 1} / {TOTAL_STEPS} — {STEPS[step]}
            </p>
          </div>
          <button
            type="button"
            onClick={submitResult === 'full' || submitResult === 'partial' ? acknowledgeResult : handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
                {i < TOTAL_STEPS - 1 && (
                  <div className={`flex-1 h-0.5 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

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
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!submitResult && step === 0 && <PMaxStepGoalType {...stepProps} />}
          {!submitResult && step === 1 && <PMaxStepConversionAndName {...stepProps} />}
          {!submitResult && step === 2 && <PMaxStepBiddingAcquisition {...stepProps} />}
          {!submitResult && step === 3 && <PMaxStepCampaignSettings {...stepProps} />}
          {!submitResult && step === 4 && <PMaxStepAssetGroup {...stepProps} />}
          {!submitResult && step === 5 && <PMaxStepSignals {...stepProps} />}
          {!submitResult && step === 6 && <PMaxStepBudget {...stepProps} />}
          {!submitResult && step === 7 && <PMaxStepSummary {...stepProps} />}
        </div>

        {!submitResult && (
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
              disabled={submitting || hasBlockingIssues}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              title={hasBlockingIssues ? blockingIssues[0] : undefined}
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
