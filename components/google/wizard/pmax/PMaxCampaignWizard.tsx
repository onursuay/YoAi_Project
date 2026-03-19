'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { X, ChevronLeft, ChevronRight, Check, AlertCircle, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { defaultPMaxState } from './shared/PMaxWizardTypes'
import type { PMaxWizardState } from './shared/PMaxWizardTypes'
import { validatePMaxStep, getPMaxBlockingIssues } from './shared/PMaxWizardValidation'
import { buildPerformanceMaxCreatePayload } from './shared/PMaxCreatePayload'
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
  const STEPS = [
    t('steps.entry'),
    t('steps.bidding'),
    t('steps.campaignSettings'),
    t('steps.assetGroup'),
    t('steps.budget'),
    t('steps.summary'),
  ]

  // Sub-nav items for Campaign Settings step
  const CAMPAIGN_SETTINGS_SUBS = [
    t('settings.locationsTitle'),
    t('settings.languagesTitle'),
    t('settings.euPoliticalTitle'),
    t('settings.devicesTitle'),
    t('settings.scheduleTitle'),
    t('settings.datesTitle'),
    t('settings.urlOptionsTitle'),
    t('settings.pageFeedsTitle'),
    t('settings.brandExclusionsTitle'),
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
  const blockingIssues = step === 5 ? getPMaxBlockingIssues(state, t) : []
  const hasBlockingIssues = blockingIssues.length > 0

  // Step validation status icons for sidebar
  const stepValidated = (i: number): 'done' | 'error' | 'none' => {
    if (i >= step) return 'none'
    const err = validatePMaxStep(i, state, t)
    return err ? 'error' : 'done'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Top header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submitResult === 'full' || submitResult === 'partial' ? acknowledgeResult : handleClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-gray-600">{t('title')}</span>
          </div>
        </div>

        {/* Main layout: sidebar + content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar navigation — Google Ads style */}
          <nav className="w-52 shrink-0 border-r border-gray-200 bg-gray-50/50 overflow-y-auto py-2">
            {STEPS.map((label, i) => {
              const isActive = step === i
              const status = stepValidated(i)
              return (
                <div key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      if (i < step) {
                        setError(null)
                        setStep(i)
                      }
                    }}
                    disabled={i > step}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-white text-blue-700 font-semibold border-l-[3px] border-blue-600'
                        : i < step
                          ? 'text-gray-700 hover:bg-gray-100 cursor-pointer'
                          : 'text-gray-400 cursor-default'
                    }`}
                  >
                    {status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                    {status === 'error' && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
                    {status === 'none' && (
                      <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center text-[10px] font-bold ${
                        isActive ? 'border-blue-600 text-blue-600' : 'border-gray-300 text-gray-400'
                      }`}>
                        {i + 1}
                      </span>
                    )}
                    <span className="truncate">{label}</span>
                  </button>
                  {/* Sub-navigation for Campaign Settings */}
                  {i === 2 && isActive && (
                    <div className="ml-6 border-l border-gray-200 pl-2 py-1">
                      {CAMPAIGN_SETTINGS_SUBS.map((sub, si) => (
                        <a
                          key={si}
                          href={`#pmax-settings-section-${si}`}
                          className="block px-2 py-1 text-xs text-gray-500 hover:text-blue-600 truncate"
                        >
                          {sub}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Right content area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Step title bar */}
            <div className="px-6 pt-4 pb-2">
              <h2 className="text-lg font-semibold text-gray-900">{STEPS[step]}</h2>
              {step === 2 && (
                <p className="text-sm text-gray-500 mt-0.5">{t('settings.subtitle')}</p>
              )}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 pb-4">
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
                    className="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                  >
                    {t('result.acknowledge')}
                  </button>
                </div>
              )}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {!submitResult && step === 0 && <PMaxStepEntry {...stepProps} />}
              {!submitResult && step === 1 && <PMaxStepBiddingAcquisition {...stepProps} />}
              {!submitResult && step === 2 && <PMaxStepCampaignSettings {...stepProps} />}
              {!submitResult && step === 3 && <PMaxStepAssetGroup {...stepProps} />}
              {!submitResult && step === 4 && <PMaxStepBudget {...stepProps} />}
              {!submitResult && step === 5 && <PMaxStepSummary {...stepProps} />}
            </div>

            {/* Bottom navigation */}
            {!submitResult && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-white rounded-b-2xl">
                <button
                  type="button"
                  onClick={step === 0 ? handleClose : back}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                  disabled={submitting}
                >
                  {step === 0 ? t('nav.cancel') : (
                    <>
                      <ChevronLeft className="w-4 h-4" />
                      {t('nav.back')}
                    </>
                  )}
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
                    className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
      </div>
    </div>
  )
}
