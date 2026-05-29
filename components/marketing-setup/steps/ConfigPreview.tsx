'use client'

import { useTranslations } from 'next-intl'
import {
  Check,
  Tags,
  BarChart3,
  Building2,
  Search,
  Globe,
} from 'lucide-react'
import { STANDARD_EVENTS } from '@/lib/marketing-setup/constants'
import type { StepProps } from '@/components/marketing-setup/wizardTypes'

interface PlatformItem {
  label: string
  detail?: string
}

export default function ConfigPreview({ state, goNext, goBack }: StepProps) {
  const t = useTranslations('marketingSetup')

  const conn = state.connections
  const selectedDefs = STANDARD_EVENTS.filter((e) => state.selectedEvents.includes(e.key))
  const conversionDefs = selectedDefs.filter((e) => e.isConversion)
  const conversionList = conversionDefs.map((d) => t(`events.${d.i18nKey}`)).join(', ')
  const eventList = selectedDefs.map((d) => t(`events.${d.i18nKey}`)).join(', ')

  // What each platform needs to be set up:
  //  GTM / GA4 / GSC → the "setup consent" (write scopes); Meta → Meta connection;
  //  Google Ads → Google Ads connection.
  const setupReady = !!conn?.setupConsent.connected
  const metaReady = !!conn?.meta.connected
  const adsReady = !!conn?.googleAds.connected
  // Kurulum (deploy) yalnızca en az bir platform bağlıyken anlamlı — aksi halde
  // "Onayla" otomatik dağıtımı tetikler ama hiçbir adım çalışmaz.
  const anyReady = setupReady || metaReady || adsReady

  const cards: {
    key: string
    icon: React.ReactNode
    title: string
    enabled: boolean
    items: PlatformItem[]
  }[] = [
    {
      key: 'gtm',
      icon: <Tags className="w-5 h-5" />,
      title: t('preview.gtm'),
      enabled: setupReady,
      items: [
        { label: t('preview.gtmGa4Base') },
        ...(metaReady ? [{ label: t('preview.gtmMetaBase') }] : []),
        ...(selectedDefs.length ? [{ label: t('preview.gtmEventTag'), detail: eventList }] : []),
      ],
    },
    {
      key: 'ga4',
      icon: <BarChart3 className="w-5 h-5" />,
      title: t('preview.ga4'),
      enabled: setupReady,
      items: [
        ...(conversionDefs.length
          ? [{ label: t('preview.ga4KeyEvents'), detail: conversionList }]
          : []),
        { label: t('preview.ga4Audiences') },
        { label: t('preview.ga4CustomDimensions') },
      ],
    },
    {
      key: 'meta',
      icon: <Building2 className="w-5 h-5" />,
      title: t('preview.meta'),
      enabled: metaReady,
      items: [
        { label: t('preview.metaPixelSetup') },
        { label: t('preview.metaCapi') },
        ...(conversionDefs.length
          ? [{ label: t('preview.metaCustomConversions'), detail: conversionList }]
          : []),
        // Bu akışta GERÇEKTEN oluşturuluyor (meta deploy → website + benzer kitle).
        { label: t('preview.metaCustomAudiences') },
        { label: t('preview.metaLookalikes') },
      ],
    },
    {
      key: 'googleAds',
      icon: <Globe className="w-5 h-5" />,
      title: t('preview.googleAds'),
      enabled: adsReady,
      items: [
        ...(conversionDefs.length
          ? [{ label: t('preview.googleAdsConversions'), detail: conversionList }]
          : []),
        { label: t('preview.googleAdsRemarketing') },
        // GA4 → Ads içe aktarma bağlantısı GA4 deploy adımında gerçekten kurulur.
        { label: t('preview.googleAdsGa4Import') },
      ],
    },
    {
      key: 'gsc',
      icon: <Search className="w-5 h-5" />,
      title: t('preview.gsc'),
      enabled: setupReady,
      items: [{ label: t('preview.gscVerify'), detail: state.siteUrl || undefined }],
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">{t('preview.title')}</h2>
        <p className="mt-2 text-base text-gray-500">{t('preview.description')}</p>
      </div>

      {/* Platform cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <div
            key={c.key}
            className={`flex flex-col h-full rounded-2xl border bg-white p-5 shadow-sm transition-all ${
              c.enabled
                ? 'border-gray-200 hover:shadow-md hover:border-primary/30'
                : 'border-gray-100 opacity-70'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  c.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {c.icon}
              </span>
              <h3 className="flex-1 text-sm font-semibold text-gray-900">{c.title}</h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  c.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {c.enabled ? t('preview.willCreate') : t('common.notConnected')}
              </span>
            </div>
            <ul className="space-y-2">
              {c.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check
                    className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                      c.enabled ? 'text-emerald-500' : 'text-gray-300'
                    }`}
                  />
                  <span className="text-sm text-gray-700">
                    {item.label}
                    {item.detail && (
                      <span className="block text-sm text-gray-400 mt-0.5">{item.detail}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* En az bir platform bağlı değilse uyarı */}
      {!anyReady && (
        <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          {t('preview.nothingToSetup')}
        </div>
      )}

      {/* Footer nav */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition-colors"
        >
          {t('common.back')}
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!anyReady}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('preview.confirm')}
        </button>
      </div>
    </div>
  )
}
