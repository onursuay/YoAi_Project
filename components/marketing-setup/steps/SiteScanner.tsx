'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Search, Loader2, CheckCircle2, Globe, Sparkles } from 'lucide-react'
import { STANDARD_EVENTS, type StandardEventKey } from '@/lib/marketing-setup/constants'
import type { SiteScanResult, DetectedAction } from '@/lib/marketing-setup/types'
import type { StepProps } from '@/components/marketing-setup/wizardTypes'

export default function SiteScanner({ state, update, goNext }: StepProps) {
  const t = useTranslations('marketingSetup')
  const [siteUrl, setSiteUrl] = useState(state.siteUrl || '')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scan = state.scan
  const selected = state.selectedEvents

  // Kalıcı kayıt mount'tan SONRA (async hydrate) geldiğinde URL kutusunu senkronize
  // et — aksi halde "tarandı" sonucu görünürken adres kutusu boş kalıyordu.
  useEffect(() => {
    if (state.siteUrl) setSiteUrl(state.siteUrl)
  }, [state.siteUrl])

  // URL boşsa İşletme Profili'nin website_url'inden önbesleme (kullanıcı yine
  // değiştirip silebilir — input düzenlenebilir kalır).
  useEffect(() => {
    if (state.siteUrl || siteUrl) return
    let cancelled = false
    fetch('/api/yoai/business-profile', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        const wu =
          d?.profile?.website_url ||
          d?.website_url ||
          d?.profile?.businessProfile?.website_url ||
          ''
        if (typeof wu === 'string' && wu.trim()) setSiteUrl(wu.trim())
      })
      .catch(() => { /* yoksa boş kal */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runScan() {
    const url = siteUrl.trim()
    if (!url || scanning) return
    setScanning(true)
    setError(null)
    try {
      const res = await fetch('/api/marketing-setup/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl: url }),
      })
      const data = (await res.json()) as
        | { ok: true; scan: SiteScanResult }
        | { ok: false; error: string }
      if (!data.ok) {
        setError(t('scan.errorScan'))
        return
      }
      const recommended = data.scan.recommendedEvents.map((r) => r.event)
      update({ siteUrl: url, scan: data.scan, selectedEvents: recommended })
      void persistSelection(recommended)
    } catch {
      setError(t('scan.errorScan'))
    } finally {
      setScanning(false)
    }
  }

  async function persistSelection(events: StandardEventKey[]) {
    try {
      await fetch('/api/marketing-setup/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch: { selected_events: events } }),
      })
    } catch {
      /* best-effort persistence; selection stays in wizard state */
    }
  }

  function toggleEvent(key: StandardEventKey) {
    const next = selected.includes(key)
      ? selected.filter((e) => e !== key)
      : [...selected, key]
    update({ selectedEvents: next })
    void persistSelection(next)
  }

  // Group detected actions by event for display.
  const actionsByEvent = new Map<StandardEventKey, DetectedAction[]>()
  for (const a of scan?.detectedActions ?? []) {
    const list = actionsByEvent.get(a.event) ?? []
    list.push(a)
    actionsByEvent.set(a.event, list)
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-gray-900">{t('scan.title')}</h2>
        <p className="mt-2 text-sm text-gray-500">{t('scan.description')}</p>
      </div>

      {/* URL input + scan */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('scan.urlLabel')}
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="url"
              inputMode="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runScan()
              }}
              placeholder={t('scan.urlPlaceholder')}
              disabled={scanning}
              className="w-full pl-11 pr-3.5 py-3 border border-gray-200 rounded-xl text-sm shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:bg-gray-50 disabled:opacity-60"
            />
          </div>
          <button
            type="button"
            onClick={runScan}
            disabled={scanning || !siteUrl.trim()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            {scanning ? t('scan.scanning') : t('scan.scanButton')}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {scan && !error && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">{t('scan.scanned')}</span>
            {scan.siteUrl && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-gray-600 font-mono text-sm break-all">{scan.siteUrl}</span>
              </>
            )}
            <span className="text-gray-300">·</span>
            <span className="text-gray-500">
              {t('scan.pagesScanned', { count: scan.pagesScanned })}
            </span>
          </div>
        )}
      </div>

      {/* Scan results */}
      {scan && (
        <div className="mt-6 space-y-6">
          {/* Site Analizi (Claude) — işletme türü + özet */}
          {scan.businessAnalysis && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-base font-semibold text-gray-900">
                  {t('scan.businessAnalysisTitle')}
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 text-sm">
                <span className="text-gray-500">{t('scan.businessTypeLabel')}</span>
                <span className="text-gray-800 font-medium">{scan.businessAnalysis.type}</span>
                {scan.businessAnalysis.summary && (
                  <>
                    <span className="text-gray-500">{t('scan.businessSummaryLabel')}</span>
                    <span className="text-gray-700">{scan.businessAnalysis.summary}</span>
                  </>
                )}
              </div>
            </div>
          )}
          {/* Detected actions — event bazında tekilleştirilmiş, sayfa frekansıyla */}
          {actionsByEvent.size > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                {t('scan.detectedActions')}
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {STANDARD_EVENTS.filter((e) => actionsByEvent.has(e.key)).map((def) => {
                  const pageCount = actionsByEvent.get(def.key)?.length ?? 0
                  return (
                    <span
                      key={def.key}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-700 px-4 py-1.5 text-sm font-medium"
                    >
                      {t(`events.${def.i18nKey}`)}
                      <span className="text-emerald-500/70">
                        {t('scan.foundOnPages', { count: pageCount })}
                      </span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recommended events checklist (all STANDARD_EVENTS) */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-base font-semibold text-gray-900">
                {t('scan.recommendedEvents')}
              </h3>
              <span className="text-sm text-gray-400">
                {t('scan.selectedCount', { count: selected.length })}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-4">{t('scan.selectEventsHint')}</p>

            {scan.detectedActions.length === 0 && scan.recommendedEvents.length === 0 && (
              <p className="mb-3 text-sm text-gray-500">{t('scan.noEventsFound')}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STANDARD_EVENTS.map((def) => {
                const checked = selected.includes(def.key)
                const rec = scan.recommendedEvents.find((r) => r.event === def.key)
                const isRecommended = !!rec
                const detected = actionsByEvent.get(def.key)
                const conf = rec?.confidence ?? detected?.[0]?.confidence
                return (
                  <label
                    key={def.key}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 cursor-pointer transition-all ${
                      checked
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEvent(def.key)}
                      className="mt-0.5 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary/30 accent-[var(--primary,#16a34a)]"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800">
                          {t(`events.${def.i18nKey}`)}
                        </span>
                        {isRecommended && (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                            {t('common.recommended')}
                          </span>
                        )}
                      </span>
                      {rec?.reason && (
                        <span className="mt-1 block text-xs text-gray-600 italic leading-relaxed">
                          {rec.reason}
                        </span>
                      )}
                      {typeof conf === 'number' && (
                        <span className="mt-1 block text-xs text-gray-400">
                          {t('scan.confidence')}: {Math.round(conf * 100)}%
                        </span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer nav */}
      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={goNext}
          disabled={!scan}
          className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-primary text-white text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('common.next')}
        </button>
      </div>
    </div>
  )
}
