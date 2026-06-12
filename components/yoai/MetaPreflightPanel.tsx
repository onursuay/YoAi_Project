'use client'

/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Meta Preflight Panel

   Kullanım: AdCreationWizard içinde preview sonrası gösterilir.
   - /api/yoai/preflight çağırır
   - Capability (supported/unsupported) gösterir
   - Page seçimi (ambiguous ise radio, tekse bilgi)
   - Eksik asset'leri listeler + pixel/form seçimi sunar
   - Website URL input (eksikse)
   - Kullanıcı "Taslağı Oluştur" → parent onConfirm(resolved) çağrısı

   Bu panel HİÇBİR Meta kaynağı oluşturmaz; sadece doğrulama yapar.
   ────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'

export interface PreflightConfirmPayload {
  explicitPageId: string | null
  pixelId: string | null
  conversionEvent: string | null
  websiteUrl: string | null
  leadFormId: string | null
  creativeReady: boolean
  allBlockingResolved: boolean
}

interface Asset {
  pages: Array<{ id: string; name: string }>
  pixels: Array<{ id: string; name: string }>
  leadForms: Array<{ id: string; name: string; page_id: string }>
}

interface PreflightResponse {
  ok: boolean
  status: 'ok' | 'requires_selection' | 'missing_assets' | 'unsupported'
  message: string
  preflight: {
    capability: {
      supported: boolean
      unsupportedReason?: string
      requiredAssets: string[]
      note?: string
    }
    pageSelection: {
      source: string
      pageId: string | null
      options?: Array<{ id: string; name: string }>
      message?: string
    }
    missing: Array<{ asset: string; reason: string }>
  }
  assets: Asset
}

interface Props {
  objective: string
  destination: string
  initialWebsiteUrl?: string | null
  creativeAvailable?: boolean
  onConfirm: (payload: PreflightConfirmPayload) => void
  onBack: () => void
}

const ASSET_LABEL_KEYS: Record<string, string> = {
  page: 'assetPage',
  pixel: 'assetPixel',
  lead_form: 'assetLeadForm',
  conversion_event: 'assetConversionEvent',
  website_url: 'assetWebsiteUrl',
  creative: 'assetCreative',
}

export default function MetaPreflightPanel({
  objective,
  destination,
  initialWebsiteUrl,
  creativeAvailable = false,
  onConfirm,
  onBack,
}: Props) {
  const t = useTranslations('dashboard.yoai.preflight')
  const tc = useTranslations('common')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [resp, setResp] = useState<PreflightResponse | null>(null)

  const [pageId, setPageId] = useState<string | null>(null)
  const [pixelId, setPixelId] = useState<string | null>(null)
  const [leadFormId, setLeadFormId] = useState<string | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState<string>(initialWebsiteUrl || '')
  const [conversionEvent, setConversionEvent] = useState<string>('')
  const [ackCreativeLater, setAckCreativeLater] = useState<boolean>(false)

  async function runPreflight(overrides?: Partial<PreflightConfirmPayload>) {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/yoai/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective,
          destination,
          explicitPageId: overrides?.explicitPageId ?? pageId,
          pixelId: overrides?.pixelId ?? pixelId,
          conversionEvent: overrides?.conversionEvent ?? conversionEvent,
          websiteUrl: overrides?.websiteUrl ?? (websiteUrl || initialWebsiteUrl || null),
          leadFormId: overrides?.leadFormId ?? leadFormId,
          creativeReady: overrides?.creativeReady ?? creativeAvailable,
        }),
      })
      const json: PreflightResponse = await res.json()
      setResp(json)

      if (json.preflight?.pageSelection?.pageId && !pageId) {
        setPageId(json.preflight.pageSelection.pageId)
      }
      if (json.assets.pixels.length === 1 && !pixelId) {
        setPixelId(json.assets.pixels[0].id)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('requestFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runPreflight()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objective, destination])

  useEffect(() => {
    if (!resp) return
    const t = setTimeout(() => runPreflight(), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, pixelId, leadFormId, websiteUrl, conversionEvent])

  if (loading && !resp) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
        <p className="text-sm text-slate-400">{t('running')}</p>
      </div>
    )
  }

  if (err) {
    return (
      <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-sm text-red-200">
        {err}
      </div>
    )
  }

  if (!resp) return null

  const pf = resp.preflight
  const cap = pf.capability
  const pageSel = pf.pageSelection
  const ambiguous = pageSel.source === 'ambiguous'
  const pagesForForm =
    pageSel.source === 'ambiguous' || pageSel.source === 'missing'
      ? pageSel.options || resp.assets.pages
      : resp.assets.pages
  const requiredAssets = cap.requiredAssets || []
  const missing = pf.missing || []
  const missingNames = new Set(missing.map((m) => m.asset))

  const requiresLeadForm = requiredAssets.includes('lead_form')
  const requiresPixel = requiredAssets.includes('pixel')
  const requiresConversionEvent = requiredAssets.includes('conversion_event')
  const requiresWebsiteUrl = requiredAssets.includes('website_url')
  const requiresCreative = requiredAssets.includes('creative')

  const formsForPage = pageId
    ? resp.assets.leadForms.filter((f) => f.page_id === pageId)
    : resp.assets.leadForms

  const statusCls =
    resp.status === 'ok'
      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
      : resp.status === 'unsupported'
        ? 'bg-red-950/40 border-red-500/40 text-red-200'
        : 'bg-slate-800/60 border-slate-700/40 text-slate-300'

  const StatusIcon =
    resp.status === 'ok' ? CheckCircle2 : resp.status === 'unsupported' ? XCircle : AlertTriangle

  const nonCreativeMissing = missing.filter((m) => m.asset !== 'creative')
  const onlyCreativeMissing = missing.length > 0 && nonCreativeMissing.length === 0
  const blocking =
    resp.status === 'unsupported' ||
    ambiguous ||
    !pageId ||
    nonCreativeMissing.length > 0 ||
    (onlyCreativeMissing && !ackCreativeLater)

  const handleConfirm = () => {
    onConfirm({
      explicitPageId: pageId,
      pixelId,
      conversionEvent: conversionEvent || null,
      websiteUrl: websiteUrl || null,
      leadFormId,
      creativeReady: creativeAvailable,
      allBlockingResolved: !blocking,
    })
  }

  const inputCls = 'w-full bg-[#0f172a] border border-[#1e2d45] text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/60'
  const cardCls = 'border border-[#1e2d45] rounded-xl p-4'

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${statusCls}`}>
        <StatusIcon className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium">
            {resp.status === 'ok' && t('statusOk')}
            {resp.status === 'requires_selection' && t('statusRequiresSelection')}
            {resp.status === 'missing_assets' && t('statusMissingAssets')}
            {resp.status === 'unsupported' && t('statusUnsupported')}
          </p>
          {cap.note && <p className="text-xs mt-1 opacity-80">{cap.note}</p>}
          {resp.status === 'unsupported' && (
            <p className="text-xs mt-1 opacity-70">
              {t('unsupportedHint')}
            </p>
          )}
        </div>
      </div>

      {resp.status !== 'unsupported' && (
        <>
          {/* Facebook Page */}
          <div className={cardCls}>
            <p className="text-sm font-semibold text-white mb-2">{t('facebookPage')}</p>
            {pagesForForm.length === 0 ? (
              <p className="text-sm text-red-300">{t('noPageConnected')}</p>
            ) : ambiguous ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-400 mb-1">
                  {t('multiplePages')}
                </p>
                {pagesForForm.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                      pageId === p.id
                        ? 'border-emerald-500/60 bg-emerald-500/5 text-white'
                        : 'border-[#1e2d45] hover:bg-white/5 text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pageId"
                      checked={pageId === p.id}
                      onChange={() => setPageId(p.id)}
                      className="accent-emerald-500"
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-300">{pageSel.message}</div>
            )}
          </div>

          {/* Pixel */}
          {requiresPixel && (
            <div className={cardCls}>
              <p className="text-sm font-semibold text-white mb-2">Meta Pixel</p>
              {resp.assets.pixels.length === 0 ? (
                <p className="text-sm text-red-300">
                  {t('noPixel')}
                </p>
              ) : (
                <select
                  value={pixelId || ''}
                  onChange={(e) => setPixelId(e.target.value || null)}
                  className={inputCls}
                >
                  <option value="">{t('selectPixel')}</option>
                  {resp.assets.pixels.map((px) => (
                    <option key={px.id} value={px.id}>
                      {px.name} ({px.id})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Conversion event */}
          {requiresConversionEvent && (
            <div className={cardCls}>
              <p className="text-sm font-semibold text-white mb-2">{t('conversionEvent')}</p>
              <select
                value={conversionEvent}
                onChange={(e) => setConversionEvent(e.target.value)}
                className={inputCls}
              >
                <option value="">{t('selectEvent')}</option>
                <option value="PURCHASE">{t('eventPurchase')}</option>
                <option value="LEAD">{t('eventLead')}</option>
                <option value="COMPLETE_REGISTRATION">{t('eventCompleteRegistration')}</option>
                <option value="ADD_TO_CART">{t('eventAddToCart')}</option>
                <option value="INITIATE_CHECKOUT">{t('eventInitiateCheckout')}</option>
                <option value="CONTACT">{t('eventContact')}</option>
                <option value="SUBMIT_APPLICATION">{t('eventSubmitApplication')}</option>
                <option value="SUBSCRIBE">{t('eventSubscribe')}</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-2 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                {t('conversionEventHint')}
              </p>
            </div>
          )}

          {/* Website URL */}
          {requiresWebsiteUrl && (
            <div className={cardCls}>
              <p className="text-sm font-semibold text-white mb-2">{t('websiteUrl')}</p>
              <input
                type="url"
                placeholder="https://..."
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className={inputCls}
              />
            </div>
          )}

          {/* Lead Form */}
          {requiresLeadForm && (
            <div className={cardCls}>
              <p className="text-sm font-semibold text-white mb-2">Instant Form</p>
              {formsForPage.length === 0 ? (
                <p className="text-sm text-red-300">
                  {pageId
                    ? t('noLeadForm')
                    : t('selectPageFirst')}
                </p>
              ) : (
                <select
                  value={leadFormId || ''}
                  onChange={(e) => setLeadFormId(e.target.value || null)}
                  className={inputCls}
                >
                  <option value="">{t('selectForm')}</option>
                  {formsForPage.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Creative acknowledgement */}
          {requiresCreative && !creativeAvailable && (
            <div className="border border-[#1e2d45] bg-slate-800/30 rounded-xl p-4">
              <p className="text-sm font-semibold text-white mb-1">{t('creativeNotReady')}</p>
              <p className="text-xs text-slate-400 mb-3">
                {t('creativeNotReadyDesc')}
              </p>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ackCreativeLater}
                  onChange={(e) => setAckCreativeLater(e.target.checked)}
                  className="accent-emerald-500"
                />
                {t('creativeAckLater')}
              </label>
            </div>
          )}

          {/* Missing assets list */}
          {missing.length > 0 && (
            <div className="border border-[#1e2d45] rounded-xl p-4 bg-slate-800/20">
              <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                {t('missingAssets')}
              </p>
              <ul className="space-y-1">
                {missing.map((m) => (
                  <li key={m.asset} className="text-xs text-slate-400 flex items-start gap-2">
                    <span
                      className={`shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${
                        missingNames.has(m.asset) ? 'bg-slate-400' : 'bg-slate-600'
                      }`}
                    />
                    <span>
                      <strong className="text-slate-300">{ASSET_LABEL_KEYS[m.asset] ? t(ASSET_LABEL_KEYS[m.asset]) : m.asset}:</strong>{' '}
                      {m.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm text-slate-400 hover:bg-white/5 rounded-lg transition-colors"
        >
          {tc('back')}
        </button>
        <button
          onClick={handleConfirm}
          disabled={blocking}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            blocking
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {blocking ? t('completeMissing') : t('createDraft')}
        </button>
      </div>
    </div>
  )
}
