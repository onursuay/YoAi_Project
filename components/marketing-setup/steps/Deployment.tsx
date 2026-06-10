'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  MinusCircle,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react'
import type { SetupStepName } from '@/lib/marketing-setup/constants'
import type { DeployStepResult } from '@/lib/marketing-setup/types'
import type { StepProps } from '@/components/marketing-setup/wizardTypes'
import { stepErrorKey, stepErrorHintKey } from '@/components/marketing-setup/stepError'

// Sequence of deploy steps: API route (hyphenated) → SetupStepName (underscored).
// Order matters: GA4 provisions ga4_measurement_id and Meta sets meta_pixel_id
// BEFORE GTM, so GTM tags are fully wired; Search Console runs last so the
// GTM/GA4 tag is live for verification.
const SEQUENCE: { route: string; step: SetupStepName; labelKey: string }[] = [
  { route: 'ga4', step: 'ga4', labelKey: 'deploy.stepGa4' },
  { route: 'meta', step: 'meta', labelKey: 'deploy.stepMeta' },
  { route: 'gtm', step: 'gtm', labelKey: 'deploy.stepGtm' },
  { route: 'google-ads', step: 'google_ads', labelKey: 'deploy.stepGoogleAds' },
  { route: 'search-console', step: 'search_console', labelKey: 'deploy.stepGsc' },
]

const PLATFORM_TABS = [
  { id: 'nextjs', labelKey: 'deploy.platformNextjs' },
  { id: 'wordpress', labelKey: 'deploy.platformWordpress' },
  { id: 'shopify', labelKey: 'deploy.platformShopify' },
  { id: 'webflow', labelKey: 'deploy.platformWebflow' },
  { id: 'other', labelKey: 'deploy.platformOther' },
] as const

export default function Deployment({ state, update, goNext, goBack }: StepProps) {
  const t = useTranslations('marketingSetup')
  const [running, setRunning] = useState(false)
  const [activeStep, setActiveStep] = useState<SetupStepName | null>(null)
  const [finished, setFinished] = useState(false)
  const [copied, setCopied] = useState<'head' | 'body' | null>(null)
  const [platformTab, setPlatformTab] = useState<(typeof PLATFORM_TABS)[number]['id']>('nextjs')

  const deploySteps = state.deploySteps

  // Accumulate results in a ref to avoid a stale-closure bug: merging into a
  // value captured from render (state.deploySteps) made each step overwrite the
  // previous one, leaving only the last step. The ref always holds the latest.
  const resultsRef = useRef<Partial<Record<SetupStepName, DeployStepResult>>>(state.deploySteps || {})

  const pushResult = useCallback(
    (step: SetupStepName, value: DeployStepResult) => {
      resultsRef.current = { ...resultsRef.current, [step]: value }
      update({ deploySteps: { ...resultsRef.current } })
    },
    [update],
  )

  const runStep = useCallback(
    async (route: string, step: SetupStepName): Promise<DeployStepResult> => {
      setActiveStep(step)
      pushResult(step, { step, status: 'running' }) // immediate UI feedback
      try {
        const res = await fetch(`/api/marketing-setup/${route}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const data = (await res.json()) as DeployStepResult
        const normalized: DeployStepResult = {
          step,
          status: data?.status ?? 'error',
          result: data?.result,
          error: data?.error ?? null,
        }
        pushResult(step, normalized)
        return normalized
      } catch {
        const errored: DeployStepResult = { step, status: 'error', error: 'deployFailed' }
        pushResult(step, errored)
        return errored
      }
    },
    [pushResult],
  )

  const runAll = useCallback(async () => {
    if (running) return
    setRunning(true)
    setFinished(false)
    // Sequential — partial success allowed (errors do not stop the chain).
    for (const { route, step } of SEQUENCE) {
      // eslint-disable-next-line no-await-in-loop
      await runStep(route, step)
    }
    setActiveStep(null)
    setRunning(false)
    setFinished(true)
  }, [running, runStep])

  // Daha önce bir deploy çalıştıysa (geri/ileri gezinme) tekrar tetiklenmez.
  const alreadyRan = Object.values(deploySteps || {}).some((s) => s && s.status !== 'pending')

  // Adım 3'teki "Onayla ve Kuruluma Başla" sonrası buraya gelince kurulum
  // OTOMATİK başlar — ayrı bir "Başlat" butonu YOK (tek tık akışı).
  // Bu adıma yalnız önizleme onayından geçilir; deploy route'ları kendi ön
  // koşullarını ayrıca doğruladığı için otomatik başlatmak güvenli.
  const autoStartedRef = useRef(false)
  useEffect(() => {
    if (autoStartedRef.current || running || alreadyRan) return
    autoStartedRef.current = true
    void runAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function retryStep(route: string, step: SetupStepName) {
    if (running) return
    setRunning(true)
    await runStep(route, step)
    setActiveStep(null)
    setRunning(false)
  }

  function statusIcon(status?: DeployStepResult['status']) {
    if (status === 'done') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />
    if (status === 'error') return <XCircle className="w-5 h-5 text-red-500" />
    if (status === 'skipped') return <MinusCircle className="w-5 h-5 text-gray-400" />
    if (status === 'running') return <Loader2 className="w-5 h-5 text-primary animate-spin" />
    return <Circle className="w-5 h-5 text-gray-300" />
  }

  function statusLabel(status?: DeployStepResult['status']) {
    if (status === 'done') return t('deploy.done')
    if (status === 'error') return t('deploy.error')
    if (status === 'skipped') return t('deploy.skipped')
    if (status === 'running') return t('deploy.running')
    return t('deploy.pending')
  }

  async function copySnippet(which: 'head' | 'body', value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(which)
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 1800)
    } catch {
      /* clipboard unavailable */
    }
  }

  const gtmResult = deploySteps.gtm
  const gtmDone = gtmResult?.status === 'done'
  const headSnippet =
    (gtmResult?.result?.snippetHead as string | undefined) ??
    (gtmResult?.result?.gtm_snippet_head as string | undefined) ??
    ''
  const bodySnippet =
    (gtmResult?.result?.snippetBody as string | undefined) ??
    (gtmResult?.result?.gtm_snippet_body as string | undefined) ??
    ''

  const anyError = SEQUENCE.some((s) => deploySteps[s.step]?.status === 'error')

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-gray-900">{t('deploy.title')}</h2>
        <p className="mt-2 text-sm text-gray-500">{t('deploy.description')}</p>
      </div>

      {/* Step rows — kurulum bu adıma girince otomatik başlar (ayrı buton yok) */}
      <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 shadow-sm overflow-hidden">
        {SEQUENCE.map(({ route, step, labelKey }) => {
          const result = deploySteps[step]
          const isActive = activeStep === step
          return (
            <div
              key={step}
              className={`flex items-center gap-3 px-5 py-4 ${isActive ? 'bg-primary/5' : ''}`}
            >
              {statusIcon(result?.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{t(labelKey)}</p>
                <p
                  className={`text-sm ${
                    result?.status === 'error'
                      ? 'text-red-600'
                      : result?.status === 'done'
                        ? 'text-emerald-600'
                        : 'text-gray-400'
                  }`}
                >
                  {result?.status === 'error'
                    ? t(stepErrorKey(result.error))
                    : statusLabel(result?.status)}
                </p>
                {result?.status === 'error' && stepErrorHintKey(result.error) && (
                  <p className="mt-0.5 text-xs text-gray-500">{t(stepErrorHintKey(result.error) as string)}</p>
                )}
              </div>
              {result?.status === 'error' && (
                <button
                  type="button"
                  onClick={() => retryStep(route, step)}
                  disabled={running}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {t('deploy.retryStep')}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {finished && anyError && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-700">
          {t('deploy.partial')}
        </div>
      )}

      {/* GTM snippets + install guide */}
      {gtmDone && (headSnippet || bodySnippet) && (
        <div className="mt-5 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-3">{t('deploy.snippetTitle')}</h3>

          {headSnippet && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-gray-500">{t('deploy.snippetHead')}</span>
                <button
                  type="button"
                  onClick={() => copySnippet('head', headSnippet)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  {copied === 'head' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === 'head' ? t('common.copied') : t('common.copy')}
                </button>
              </div>
              <pre className="overflow-x-auto rounded-xl bg-gray-900 text-gray-100 text-sm p-3.5 whitespace-pre-wrap break-all">
                {headSnippet}
              </pre>
            </div>
          )}

          {bodySnippet && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-gray-500">{t('deploy.snippetBody')}</span>
                <button
                  type="button"
                  onClick={() => copySnippet('body', bodySnippet)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  {copied === 'body' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === 'body' ? t('common.copied') : t('common.copy')}
                </button>
              </div>
              <pre className="overflow-x-auto rounded-xl bg-gray-900 text-gray-100 text-sm p-3.5 whitespace-pre-wrap break-all">
                {bodySnippet}
              </pre>
            </div>
          )}

          {/* Install guide tabs */}
          <div className="mt-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('deploy.guideTitle')}</h4>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPlatformTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    platformTab === tab.id
                      ? 'bg-primary/8 text-primary'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t(tab.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer nav */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={running}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition-colors disabled:opacity-50"
        >
          {t('common.back')}
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={(!finished && !alreadyRan) || running}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('common.next')}
        </button>
      </div>
    </div>
  )
}
