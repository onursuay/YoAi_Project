'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, ShieldCheck, ExternalLink, Building2, BarChart3, Search, Megaphone } from 'lucide-react'
import WizardSelect from '@/components/meta/wizard/WizardSelect'
import GoogleCloudSetupModal from '@/components/marketing-setup/GoogleCloudSetupModal'
import type { StepProps } from '@/components/marketing-setup/wizardTypes'

export default function PlatformConnect({ state, update, goNext, goBack }: StepProps) {
  const t = useTranslations('marketingSetup')
  const [cloudOpen, setCloudOpen] = useState(false)
  const [containers, setContainers] = useState<{ publicId: string; name: string }[]>([])
  const [metaAccounts, setMetaAccounts] = useState<{ id: string; name: string }[]>([])
  // Google Ads dropdown seçenekleri (MCC manager'ları alt hesaplarıyla düzleştirilmiş).
  const [adsOptions, setAdsOptions] = useState<{ value: string; label: string; disabled?: boolean }[]>([])
  // customerId → loginCustomerId (alt hesap işlemleri MCC üzerinden yetkilenir).
  const adsLoginMap = useRef<Record<string, string>>({})
  const [switching, setSwitching] = useState<'meta' | 'ads' | null>(null)

  const conn = state.connections
  const metaConnected = !!conn?.meta.connected
  const setupConnected = !!conn?.setupConsent.connected

  // Her platform AYRI bir kart — biri bağlı diye diğeri bağlı sayılmaz.
  const platformCards = [
    { key: 'googleAds', icon: Megaphone, title: t('preview.googleAds'), connected: !!conn?.googleAds.connected, href: '/api/integrations/google-ads/start' },
    { key: 'ga4', icon: BarChart3, title: t('preview.ga4'), connected: !!conn?.ga4.connected, href: '/api/integrations/google-analytics/start' },
    { key: 'gsc', icon: Search, title: t('preview.gsc'), connected: !!conn?.gsc.connected, href: '/api/integrations/google-search-console/start' },
    { key: 'meta', icon: Building2, title: t('preview.meta'), connected: metaConnected, href: '/api/meta/login' },
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
    // "Hesap Seçilmedi" seçildiyse global hesabı setup'a geri yazma (opt-out korunur).
    if (!state.googleAdsOptOut && adsCust && adsCust !== state.googleAdsCustomerId) {
      update({ googleAdsCustomerId: adsCust })
      patch.google_ads_customer_id = adsCust
    }
    if (Object.keys(patch).length) void persist(patch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaAcct, adsCust])

  // Multi-account: kullanıcının erişebildiği Meta reklam hesaplarını listele.
  // Birden fazla varsa UI dropdown gösterip seçim değiştirilebilir.
  useEffect(() => {
    if (!metaConnected) return
    let cancelled = false
    fetch('/api/meta/adaccounts', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.accounts) return
        const list = (d.accounts as { id: string; name?: string }[]).map((a) => ({
          id: a.id,
          name: a.name || a.id,
        }))
        setMetaAccounts(list)
      })
      .catch(() => { /* listelenemezse dropdown gösterilmez, salt-okunur kalır */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaConnected])

  // Multi-account: Google Ads müşterilerini listele; MCC (manager) hesaplarını
  // alt hesaplarıyla DÜZLEŞTİR — kullanıcı spesifik bir işlem hesabı seçebilsin.
  useEffect(() => {
    if (!conn?.googleAds.connected) return
    let cancelled = false
    fetch('/api/marketing-setup/google-ads-accounts', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.accounts) return
        type Node = {
          customerId: string
          name: string
          isManager: boolean
          loginCustomerId: string
          children?: { customerId: string; name: string; loginCustomerId: string; isManager?: boolean }[]
        }
        const map: Record<string, string> = {}
        const opts: { value: string; label: string; disabled?: boolean }[] = [
          // Her zaman ilk seçenek — hesap zorunlu değil; aktif hesap seçili kalmaz.
          { value: '', label: t('connect.noAccountSelected') },
        ]
        for (const acc of d.accounts as Node[]) {
          const fmt = (name: string, id: string) => (name && name !== id ? `${name} (${id})` : id)
          if (acc.isManager) {
            // Manager kendisi işlem hesabı olamaz → başlık (disabled), altında çocuklar.
            opts.push({ value: `mgr:${acc.customerId}`, label: `${fmt(acc.name, acc.customerId)} — ${t('connect.managerAccount')}`, disabled: true })
            if (acc.children && acc.children.length) {
              for (const ch of acc.children) {
                if (ch.isManager) continue // alt-manager'lar işlem hesabı değil
                map[ch.customerId] = ch.loginCustomerId || acc.customerId
                opts.push({ value: ch.customerId, label: `   ${fmt(ch.name, ch.customerId)}` })
              }
            } else {
              opts.push({ value: `none:${acc.customerId}`, label: `   ${t('connect.noSubAccounts')}`, disabled: true })
            }
          } else {
            map[acc.customerId] = acc.loginCustomerId || acc.customerId
            opts.push({ value: acc.customerId, label: fmt(acc.name, acc.customerId) })
          }
        }
        adsLoginMap.current = map
        setAdsOptions(opts)
      })
      .catch(() => { /* listelenemezse salt-okunur mevcut hesap kalır */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn?.googleAds.connected])

  // Aktif Meta reklam hesabını değiştir + connections refresh.
  async function switchMetaAccount(id: string) {
    if (switching || !id || id === metaAcct) return
    setSwitching('meta')
    try {
      await fetch('/api/meta/select-adaccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adAccountId: id }),
      })
      const r = await fetch('/api/marketing-setup/connections', { cache: 'no-store' })
      if (r.ok) {
        const data = await r.json()
        update({ connections: data })
      }
    } catch { /* sessizce başarısız */ } finally {
      setSwitching(null)
    }
  }

  // Google Ads müşterisini değiştir. Boş değer = "Hesap Seçilmedi" (opt-out):
  // global seçime (Reklam Yöneticisi) DOKUNMADAN bu kurulumdan Google Ads'i çıkar.
  async function switchAdsAccount(customerId: string) {
    if (switching) return
    // "Hesap Seçilmedi" — global seçimi değiştirme, yalnız setup'tan kaldır.
    if (!customerId) {
      if (state.googleAdsOptOut) return
      setSwitching('ads')
      try {
        update({ googleAdsOptOut: true, googleAdsCustomerId: '' })
        await persist({ google_ads_customer_id: null })
      } finally {
        setSwitching(null)
      }
      return
    }
    if (customerId === adsCust && !state.googleAdsOptOut) return
    setSwitching('ads')
    try {
      const loginCustomerId = adsLoginMap.current[customerId] || customerId
      await fetch('/api/integrations/google-ads/select-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, loginCustomerId }),
      })
      update({ googleAdsOptOut: false })
      const r = await fetch('/api/marketing-setup/connections', { cache: 'no-store' })
      if (r.ok) {
        const data = await r.json()
        update({ connections: data })
      }
    } catch { /* sessizce başarısız */ } finally {
      setSwitching(null)
    }
  }

  // Auto-detect existing GTM containers via the setup-consent token so the user
  // picks one instead of typing a GTM-XXXXXXX id.
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
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-gray-900">{t('connect.title')}</h2>
        <p className="mt-2 text-sm text-gray-500">{t('connect.description')}</p>
      </div>

      {/* Platform kartları — Google Ads / Google Analytics / Search Console / Meta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {platformCards.map((p) => {
          const Icon = p.icon
          return (
            <div
              key={p.key}
              className={`flex flex-col items-start rounded-2xl border-2 bg-white p-5 shadow-sm transition-all ${
                p.connected ? 'border-primary/40' : 'border-gray-200'
              }`}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl mb-3 ${
                  p.connected ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <Icon className="w-6 h-6" />
              </span>
              <h3 className="text-base font-semibold text-gray-900">{p.title}</h3>
              <div className="mt-4 w-full">
                {p.connected ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    {t('common.connected')}
                  </span>
                ) : (
                  <a
                    href={p.href}
                    className="inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors"
                  >
                    {t('connect.connectService')}
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Setup permissions */}
      <div className="mt-5 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900">{t('connect.setupConsentTitle')}</h3>
            <p className="mt-1.5 text-sm text-gray-500">{t('connect.setupConsentDescription')}</p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {setupConnected ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                  {t('connect.setupConsentConnected')}
                </span>
              ) : (
                <a
                  href="/api/oauth/setup-google/start"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors"
                >
                  <ShieldCheck className="w-5 h-5" />
                  {t('connect.setupConsentConnect')}
                </a>
              )}
              <button
                type="button"
                onClick={() => setCloudOpen(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                {t('connect.cloudSetupGuide')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Account / identifier inputs */}
      <div className="mt-5 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
        {/* Meta ad account id — auto-fed from the Meta integration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('connect.metaAdAccountId')}
          </label>
          {metaAcct && metaAccounts.length > 1 ? (
            <div>
              <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                {t('connect.multipleAccountsDetected', { count: metaAccounts.length })}
              </p>
              <WizardSelect
                value={metaAcct}
                onChange={(v) => void switchMetaAccount(v)}
                disabled={switching === 'meta'}
                options={metaAccounts.map((a) => ({
                  value: a.id,
                  label: a.name === a.id ? a.id : `${a.name} (${a.id})`,
                }))}
              />
              {switching === 'meta' && (
                <p className="mt-1 text-xs text-gray-500">{t('connect.switchingAccount')}</p>
              )}
            </div>
          ) : metaAcct ? (
            <div className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-emerald-800 truncate">
                  {metaName || metaAcct}
                </span>
                {metaName && (
                  <span className="block font-mono text-xs text-emerald-600/70 truncate">{metaAcct}</span>
                )}
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 flex-shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                {t('connect.autoFromIntegration')}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50">
              <span className="text-sm text-gray-500 truncate">{t('connect.connectFromIntegration')}</span>
              <a
                href="/entegrasyon"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline flex-shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
                {t('connect.goToIntegrations')}
              </a>
            </div>
          )}
        </div>

        {/* Google Ads customer id — entegrasyondan beslenir; MCC alt hesabı seçilebilir,
            "Hesap Seçilmedi" ile bu kuruluma dahil edilmeyebilir (opsiyonel) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('connect.googleAdsCustomerId')}
            <span className="ml-2 text-sm font-normal text-gray-400">{t('common.optional')}</span>
          </label>
          {conn?.googleAds.connected ? (
            adsOptions.length > 0 ? (
              <div>
                <WizardSelect
                  value={state.googleAdsOptOut ? '' : adsCust}
                  onChange={(v) => void switchAdsAccount(v)}
                  disabled={switching === 'ads'}
                  options={adsOptions}
                />
                {!state.googleAdsOptOut && adsCust ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    {adsName ? `${adsName} (${adsCust})` : adsCust}
                  </p>
                ) : state.googleAdsOptOut ? (
                  <p className="mt-2 text-sm text-gray-500">{t('connect.googleAdsExcluded')}</p>
                ) : null}
                {switching === 'ads' && (
                  <p className="mt-1 text-xs text-gray-500">{t('connect.switchingAccount')}</p>
                )}
              </div>
            ) : adsCust ? (
              // Seçenekler henüz yüklenmedi — mevcut hesabı salt-okunur göster
              <div className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-emerald-800 truncate">
                    {adsName || adsCust}
                  </span>
                  {adsName && (
                    <span className="block font-mono text-xs text-emerald-600/70 truncate">{adsCust}</span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                  {t('connect.autoFromIntegration')}
                </span>
              </div>
            ) : (
              <p className="px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500">
                {t('connect.loadingAccounts')}
              </p>
            )
          ) : (
            <div className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50">
              <span className="text-sm text-gray-500 truncate">{t('connect.connectFromIntegration')}</span>
              <a
                href="/entegrasyon"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline flex-shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
                {t('connect.goToIntegrations')}
              </a>
            </div>
          )}
        </div>

        {/* GTM mode + container id */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('connect.gtmChoiceLabel')}
          </label>
          <WizardSelect
            value={state.gtmMode}
            onChange={(v) => {
              if (v === 'existing') {
                update({ gtmMode: 'existing' })
              } else {
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
              <div className="mt-3">
                <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
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
                className="mt-3 w-full px-4 py-3 border border-gray-200 rounded-xl text-sm shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            ))}
        </div>
      </div>

      {/* Footer nav */}
      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition-colors"
        >
          {t('common.back')}
        </button>
        <button
          type="button"
          onClick={goNext}
          className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-primary text-white text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors"
        >
          {t('common.next')}
        </button>
      </div>

      <GoogleCloudSetupModal open={cloudOpen} onClose={() => setCloudOpen(false)} />
    </div>
  )
}
