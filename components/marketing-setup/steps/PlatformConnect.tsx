'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, ShieldCheck, ExternalLink, Building2, BarChart3 } from 'lucide-react'
import WizardSelect from '@/components/meta/wizard/WizardSelect'
import GoogleCloudSetupModal from '@/components/marketing-setup/GoogleCloudSetupModal'
import type { StepProps } from '@/components/marketing-setup/wizardTypes'

export default function PlatformConnect({ state, update, goNext, goBack }: StepProps) {
  const t = useTranslations('marketingSetup')
  const [cloudOpen, setCloudOpen] = useState(false)
  const [containers, setContainers] = useState<{ publicId: string; name: string }[]>([])

  const conn = state.connections
  const metaConnected = !!conn?.meta.connected
  const setupConnected = !!conn?.setupConsent.connected

  // Üç Google servisi ayrı ayrı gösterilir — biri bağlı diye hepsi "bağlı" sayılmaz.
  const googleServices = [
    { label: t('preview.googleAds'), connected: !!conn?.googleAds.connected, href: '/api/integrations/google-ads/start' },
    { label: t('preview.ga4'), connected: !!conn?.ga4.connected, href: '/api/integrations/google-analytics/start' },
    { label: t('preview.gsc'), connected: !!conn?.gsc.connected, href: '/api/integrations/google-search-console/start' },
  ]

  // Ad account identifiers are fed from the existing Entegrasyon connections —
  // never typed manually. resolveMetaContext / Google Ads connection provide them.
  const metaAcct = conn?.meta.adAccountId ?? ''
  const metaName = conn?.meta.adAccountName ?? ''
  const adsCust = conn?.googleAds.customerId ?? ''
  const adsName = conn?.googleAds.customerName ?? ''

  async function persist(patch: Record<string, unknown>) {
    try {
      await fetch('/api/marketing-setup/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch }),
      })
    } catch {
      /* best-effort; values remain in wizard state */
    }
  }

  // Mirror the integration-resolved ids into wizard state + persist them once.
  useEffect(() => {
    const patch: Record<string, unknown> = {}
    if (metaAcct && metaAcct !== state.metaAdAccountId) {
      update({ metaAdAccountId: metaAcct })
      patch.meta_ad_account_id = metaAcct
    }
    if (adsCust && adsCust !== state.googleAdsCustomerId) {
      update({ googleAdsCustomerId: adsCust })
      patch.google_ads_customer_id = adsCust
    }
    if (Object.keys(patch).length) void persist(patch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaAcct, adsCust])

  // Auto-detect existing GTM containers via the setup-consent token so the user
  // picks one instead of typing a GTM-XXXXXXX id. If exactly the account has
  // containers and none is chosen yet, preselect the first (mode → existing).
  useEffect(() => {
    if (!setupConnected) return
    let cancelled = false
    fetch('/api/marketing-setup/gtm-containers', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.ok) return
        const list = (d.containers ?? []) as { publicId: string; name: string }[]
        setContainers(list)
        if (list.length && !state.gtmContainerId) {
          update({ gtmMode: 'existing', gtmContainerId: list[0].publicId })
          void persist({ gtm_container_id: list[0].publicId })
        }
      })
      .catch(() => { /* leave manual entry available */ })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupConnected])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{t('connect.title')}</h2>
        <p className="mt-1.5 text-sm text-gray-500">{t('connect.description')}</p>
      </div>

      {/* Connection cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Google */}
        <div className="flex flex-col bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-1.5">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold text-gray-900">{t('connect.googleTitle')}</h3>
          </div>
          <p className="text-xs text-gray-500 flex-1">{t('connect.googleDescription')}</p>
          <div className="mt-4 space-y-2">
            {googleServices.map((svc) => (
              <div key={svc.label} className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-600">{svc.label}</span>
                {svc.connected ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t('common.connected')}
                  </span>
                ) : (
                  <a
                    href={svc.href}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {t('connect.connectService')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-col bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-1.5">
            <Building2 className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold text-gray-900">{t('connect.metaTitle')}</h3>
          </div>
          <p className="text-xs text-gray-500 flex-1">{t('connect.metaDescription')}</p>
          <div className="mt-4">
            {metaConnected ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                {t('common.connected')}
              </span>
            ) : (
              <a
                href="/api/meta/login"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-medium shadow-sm hover:bg-primary/90 transition-colors"
              >
                {t('connect.connectMeta')}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Setup permissions */}
      <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">{t('connect.setupConsentTitle')}</h3>
            <p className="mt-1 text-xs text-gray-500">{t('connect.setupConsentDescription')}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {setupConnected ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  {t('connect.setupConsentConnected')}
                </span>
              ) : (
                <a
                  href="/api/oauth/setup-google/start"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-medium shadow-sm hover:bg-primary/90 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {t('connect.setupConsentConnect')}
                </a>
              )}
              <button
                type="button"
                onClick={() => setCloudOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t('connect.cloudSetupGuide')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Account / identifier inputs */}
      <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        {/* Meta ad account id — auto-fed from the Meta integration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('connect.metaAdAccountId')}
          </label>
          {metaAcct ? (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-emerald-800 truncate">
                  {metaName || metaAcct}
                </span>
                {metaName && (
                  <span className="block font-mono text-[11px] text-emerald-600/70 truncate">{metaAcct}</span>
                )}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 flex-shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('connect.autoFromIntegration')}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
              <span className="text-sm text-gray-500 truncate">{t('connect.connectFromIntegration')}</span>
              <a
                href="/entegrasyon"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline flex-shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t('connect.goToIntegrations')}
              </a>
            </div>
          )}
        </div>

        {/* Google Ads customer id — auto-fed from the Google Ads integration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('connect.googleAdsCustomerId')}
            <span className="ml-2 text-xs font-normal text-gray-400">{t('common.optional')}</span>
          </label>
          {adsCust ? (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-emerald-800 truncate">
                  {adsName || adsCust}
                </span>
                {adsName && (
                  <span className="block font-mono text-[11px] text-emerald-600/70 truncate">{adsCust}</span>
                )}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 flex-shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('connect.autoFromIntegration')}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
              <span className="text-sm text-gray-500 truncate">{t('connect.connectFromIntegration')}</span>
              <a
                href="/entegrasyon"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline flex-shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t('connect.goToIntegrations')}
              </a>
            </div>
          )}
        </div>

        {/* GTM mode + container id */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('connect.gtmChoiceLabel')}
          </label>
          <WizardSelect
            value={state.gtmMode}
            onChange={(v) => {
              if (v === 'existing') {
                update({ gtmMode: 'existing' })
              } else {
                // "Yeni oluştur"a geçince persist edilmiş kapsayıcı ID'sini de temizle —
                // aksi halde deploy modu (gtm_container_id var mı?) yine "mevcut" sanır.
                update({ gtmMode: 'create', gtmContainerId: '' })
                void persist({ gtm_container_id: null })
              }
            }}
            options={[
              { value: 'create', label: t('connect.gtmCreate') },
              { value: 'existing', label: t('connect.gtmExisting') },
            ]}
          />
          {state.gtmMode === 'existing' &&
            (containers.length > 0 ? (
              <div className="mt-2.5">
                <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('connect.gtmDetected', { count: containers.length })}
                </p>
                <WizardSelect
                  value={state.gtmContainerId}
                  onChange={(v) => {
                    update({ gtmContainerId: v })
                    void persist({ gtm_container_id: v })
                  }}
                  placeholder={t('connect.gtmSelectPlaceholder')}
                  options={containers.map((c) => ({
                    value: c.publicId,
                    label: `${c.name} (${c.publicId})`,
                  }))}
                />
              </div>
            ) : (
              <input
                type="text"
                value={state.gtmContainerId}
                onChange={(e) => update({ gtmContainerId: e.target.value })}
                onBlur={(e) => persist({ gtm_container_id: e.target.value.trim() })}
                placeholder={t('connect.gtmContainerIdPlaceholder')}
                className="mt-2.5 w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            ))}
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
        <button
          type="button"
          onClick={goNext}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors"
        >
          {t('common.next')}
        </button>
      </div>

      <GoogleCloudSetupModal open={cloudOpen} onClose={() => setCloudOpen(false)} />
    </div>
  )
}
