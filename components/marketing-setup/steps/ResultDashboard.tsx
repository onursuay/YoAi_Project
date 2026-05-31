'use client'

import { useTranslations } from 'next-intl'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Tags,
  BarChart3,
  Building2,
  Globe,
  Search,
  ExternalLink,
  Megaphone,
} from 'lucide-react'
import { STANDARD_EVENTS } from '@/lib/marketing-setup/constants'
import type { SetupStepName } from '@/lib/marketing-setup/constants'
import type { DeployStepResult } from '@/lib/marketing-setup/types'
import type { StepProps } from '@/components/marketing-setup/wizardTypes'
import { stepErrorKey } from '@/components/marketing-setup/stepError'

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export default function ResultDashboard({ state, goBack }: StepProps) {
  const t = useTranslations('marketingSetup')
  const steps = state.deploySteps

  const conversionCount = STANDARD_EVENTS.filter(
    (e) => e.isConversion && state.selectedEvents.includes(e.key),
  ).length

  function statusIcon(status?: DeployStepResult['status']) {
    if (status === 'done') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    if (status === 'error') return <XCircle className="w-4 h-4 text-red-500" />
    if (status === 'running') return <Loader2 className="w-4 h-4 text-primary animate-spin" />
    return null
  }

  const Card = ({
    icon,
    title,
    step,
    statusLabel,
    children,
  }: {
    icon: React.ReactNode
    title: string
    step: SetupStepName
    statusLabel: string
    children?: React.ReactNode
  }) => {
    const r = steps[step]
    const ok = r?.status === 'done'
    return (
      <div
        className={`flex flex-col bg-white border rounded-2xl p-5 shadow-sm ${
          r?.status === 'error' ? 'border-red-200' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <span className="text-primary">{icon}</span>
          <h3 className="text-base font-semibold text-gray-900 flex-1">{title}</h3>
          {statusIcon(r?.status)}
        </div>
        <p
          className={`text-sm font-medium ${
            ok ? 'text-emerald-700' : r?.status === 'error' ? 'text-red-600' : 'text-gray-400'
          }`}
        >
          {r?.status === 'error' ? t(stepErrorKey(r.error)) : ok ? statusLabel : t('deploy.pending')}
        </p>
        {ok && <div className="mt-3 flex-1">{children}</div>}
      </div>
    )
  }

  // GTM preview URL from gtm result, if provided.
  const gtmResult = steps.gtm?.result
  const gtmPreviewUrl =
    (gtmResult?.previewUrl as string | undefined) ??
    (gtmResult?.gtm_preview_url as string | undefined) ??
    null

  // Remarketing summary counts (best-effort from step results).
  const metaResult = steps.meta?.result
  const ga4Result = steps.ga4?.result
  const adsResult = steps.google_ads?.result

  // Özet sayıları YALNIZCA deploy'un gerçekten ürettiği alanlardan okunur.
  // Üretilmeyen/başarısız adım için "seçili event sayısı"na uydurma fallback YOK.
  const metaDone = steps.meta?.status === 'done'
  const adsDone = steps.google_ads?.status === 'done'
  // Kitleler: GA4 (audiencesCreated) + Meta website kitlesi (audiencesCreated) toplamı.
  const audiencesCount =
    (num(ga4Result?.audiencesCreated) ?? 0) + (metaDone ? (num(metaResult?.audiencesCreated) ?? 0) : 0)
  const lookalikesCount = metaDone ? (num(metaResult?.lookalikesCreated) ?? 0) : 0
  const adsConversionsCount = adsDone ? (num(adsResult?.conversionActionsCreated) ?? 0) : 0
  const remarketingListsCount = adsDone ? (num(adsResult?.remarketingListsCreated) ?? 0) : 0
  const ga4AdsLinked = ga4Result?.ga4AdsLinked === true

  // CAPI doğrulama sonucu Meta'nın kabul ettiği olay sayısıdır (events_received) —
  // gerçek "eşleşme kalitesi" skoru değil; etiket buna göre dürüst gösterilir.
  const eventsReceived =
    num(metaResult?.matchQuality) ?? (typeof metaResult?.matchQuality === 'string' ? metaResult.matchQuality : null)
  const capiVerified = metaResult?.capiVerified === true

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-gray-900">{t('result.title')}</h2>
        <p className="mt-2 text-sm text-gray-500">{t('result.description')}</p>
      </div>

      {/* Platform status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card icon={<Tags className="w-5 h-5" />} title={t('preview.gtm')} step="gtm" statusLabel={t('result.statusPublished')}>
          {gtmPreviewUrl ? (
            <a
              href={gtmPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t('result.testGtmPreview')}
            </a>
          ) : null}
        </Card>

        <Card icon={<BarChart3 className="w-5 h-5" />} title={t('preview.ga4')} step="ga4" statusLabel={t('result.statusConnected')}>
          {conversionCount > 0 && (
            <p className="text-sm text-gray-500">{t('result.conversionsMarked', { count: conversionCount })}</p>
          )}
          {ga4AdsLinked && (
            <p className="text-sm text-gray-500">{t('result.ga4AdsLinked')}</p>
          )}
        </Card>

        <Card icon={<Building2 className="w-5 h-5" />} title={t('preview.meta')} step="meta" statusLabel={t('result.statusInstalled')}>
          {capiVerified ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t('result.capiActive')}
            </p>
          ) : (
            <p className="text-sm text-gray-500">{t('result.capiNotVerified')}</p>
          )}
          {eventsReceived != null && (
            <p className="mt-1 text-sm text-gray-500">
              {t('result.eventsReceived', { count: String(eventsReceived) })}
            </p>
          )}
        </Card>

        <Card icon={<Globe className="w-5 h-5" />} title={t('preview.googleAds')} step="google_ads" statusLabel={t('result.statusConnected')}>
          {adsConversionsCount > 0 && (
            <p className="text-sm text-gray-500">{t('result.summaryConversions', { count: adsConversionsCount })}</p>
          )}
        </Card>

        <Card
          icon={<Search className="w-5 h-5" />}
          title={t('preview.gsc')}
          step="search_console"
          statusLabel={steps.search_console?.result?.verified === true ? t('result.statusConnected') : t('result.gscPendingVerification')}
        />
      </div>

      {/* Remarketing summary */}
      <div className="mt-5 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-3">{t('result.remarketingTitle')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-emerald-50 px-3 py-3 text-center">
            <p className="text-lg font-semibold text-emerald-700">{audiencesCount}</p>
            <p className="text-sm text-emerald-700/80">{t('result.summaryAudiences', { count: audiencesCount })}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-3 text-center">
            <p className="text-lg font-semibold text-emerald-700">{lookalikesCount}</p>
            <p className="text-sm text-emerald-700/80">{t('result.summaryLookalikes', { count: lookalikesCount })}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-3 text-center">
            <p className="text-lg font-semibold text-emerald-700">{adsConversionsCount}</p>
            <p className="text-sm text-emerald-700/80">{t('result.summaryConversions', { count: adsConversionsCount })}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-3 text-center">
            <p className="text-lg font-semibold text-emerald-700">{remarketingListsCount}</p>
            <p className="text-sm text-emerald-700/80">{t('result.summaryRemarketingLists', { count: remarketingListsCount })}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <a
            href="/google-ads"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Megaphone className="w-3.5 h-3.5" />
            {t('result.createGoogleAd')}
          </a>
          <a
            href="/meta-ads"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Megaphone className="w-3.5 h-3.5" />
            {t('result.createMetaAd')}
          </a>
        </div>
      </div>

      {/* Footer nav */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition-colors"
        >
          {t('common.back')}
        </button>
      </div>
    </div>
  )
}
