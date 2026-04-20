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
  /** Yeni akış: kreatif zaten hazırsa true. v1 UI'da false (creative pipeline Faz 3). */
  creativeAvailable?: boolean
  onConfirm: (payload: PreflightConfirmPayload) => void
  onBack: () => void
}

export default function MetaPreflightPanel({
  objective,
  destination,
  initialWebsiteUrl,
  creativeAvailable = false,
  onConfirm,
  onBack,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [resp, setResp] = useState<PreflightResponse | null>(null)

  // user selections
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

      // Auto-fill single-choice assets so user sees the picker already resolved
      if (json.preflight?.pageSelection?.pageId && !pageId) {
        setPageId(json.preflight.pageSelection.pageId)
      }
      if (json.assets.pixels.length === 1 && !pixelId) {
        setPixelId(json.assets.pixels[0].id)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Preflight isteği başarısız.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runPreflight()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objective, destination])

  // Rerun preflight when key user selections change (debounced via simple effect)
  useEffect(() => {
    if (!resp) return
    const t = setTimeout(() => runPreflight(), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, pixelId, leadFormId, websiteUrl, conversionEvent])

  if (loading && !resp) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
        <p className="text-sm text-gray-500">Ön kontrol yapılıyor…</p>
      </div>
    )
  }

  if (err) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
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

  const statusColor =
    resp.status === 'ok'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : resp.status === 'unsupported'
        ? 'bg-red-50 border-red-200 text-red-700'
        : 'bg-gray-50 border-gray-200 text-gray-700'
  const StatusIcon =
    resp.status === 'ok' ? CheckCircle2 : resp.status === 'unsupported' ? XCircle : AlertTriangle

  // Blocking kararı: UI user'ın devam etmesini ne zaman engellesin?
  // - unsupported → her zaman engelli
  // - ambiguous page → page seçilene kadar engelli
  // - missing non-creative asset → engelli
  // - sadece "creative" eksikse → kullanıcı "kreatifi sonra ekleyeceğim" onayıyla devam edebilir (legacy path)
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

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${statusColor}`}>
        <StatusIcon className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium">
            {resp.status === 'ok' && 'Ön kontrol başarılı. Taslak oluşturulabilir.'}
            {resp.status === 'requires_selection' && 'Sayfa seçimi gerekli.'}
            {resp.status === 'missing_assets' && 'Bazı varlıklar eksik.'}
            {resp.status === 'unsupported' && 'Bu kombinasyon v1 kapsamında desteklenmiyor.'}
          </p>
          {cap.note && <p className="text-xs mt-1 opacity-80">{cap.note}</p>}
          {resp.status === 'unsupported' && (
            <p className="text-xs mt-1">{cap.unsupportedReason}</p>
          )}
        </div>
      </div>

      {resp.status !== 'unsupported' && (
        <>
          {/* Page selection */}
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-900">Facebook Sayfası</p>
              <span className="text-[10px] uppercase tracking-wider text-gray-400">
                {pageSel.source}
              </span>
            </div>
            {pagesForForm.length === 0 ? (
              <p className="text-sm text-red-600">Bağlı sayfa yok. Meta hesabınıza sayfa bağlayın.</p>
            ) : ambiguous ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-1">
                  Birden fazla sayfa var. Kullanmak istediğinizi seçin.
                </p>
                {pagesForForm.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm ${
                      pageId === p.id
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pageId"
                      checked={pageId === p.id}
                      onChange={() => setPageId(p.id)}
                    />
                    <span>{p.name}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">{p.id}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-700">
                {pageSel.message}
              </div>
            )}
          </div>

          {/* Missing assets — specific pickers */}
          {requiresPixel && (
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">Meta Pixel</p>
              {resp.assets.pixels.length === 0 ? (
                <p className="text-sm text-red-600">
                  Pixel bulunamadı. Meta Events Manager'dan bir pixel oluşturun.
                </p>
              ) : (
                <select
                  value={pixelId || ''}
                  onChange={(e) => setPixelId(e.target.value || null)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Pixel seçin —</option>
                  {resp.assets.pixels.map((px) => (
                    <option key={px.id} value={px.id}>
                      {px.name} ({px.id})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {requiresConversionEvent && (
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">Dönüşüm Olayı</p>
              <select
                value={conversionEvent}
                onChange={(e) => setConversionEvent(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Event seçin —</option>
                <option value="PURCHASE">Purchase (Satın Alma)</option>
                <option value="LEAD">Lead (Potansiyel Müşteri)</option>
                <option value="COMPLETE_REGISTRATION">Complete Registration</option>
                <option value="ADD_TO_CART">Add to Cart</option>
                <option value="INITIATE_CHECKOUT">Initiate Checkout</option>
                <option value="CONTACT">Contact</option>
                <option value="SUBMIT_APPLICATION">Submit Application</option>
                <option value="SUBSCRIBE">Subscribe</option>
              </select>
              <p className="text-[11px] text-gray-500 mt-2 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5" />
                Seçtiğiniz event'in pixel'inizde aktif olarak tetiklendiğinden emin olun.
              </p>
            </div>
          )}

          {requiresWebsiteUrl && (
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">Web Sitesi URL</p>
              <input
                type="url"
                placeholder="https://..."
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          {requiresLeadForm && (
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">Instant Form</p>
              {formsForPage.length === 0 ? (
                <p className="text-sm text-red-600">
                  {pageId
                    ? 'Seçili sayfada Instant Form yok. Meta\'da önce form oluşturun.'
                    : 'Önce sayfa seçin.'}
                </p>
              ) : (
                <select
                  value={leadFormId || ''}
                  onChange={(e) => setLeadFormId(e.target.value || null)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Form seçin —</option>
                  {formsForPage.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {requiresCreative && !creativeAvailable && (
            <div className="border border-gray-200 bg-gray-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-800 mb-1">Kreatif Hazır Değil</p>
              <p className="text-xs text-gray-700 mb-3">
                Reklam görseli/videosu bu sürümde wizard'da üretilmiyor. Kampanya ve reklam seti
                oluşturulur, reklam kreatifini Meta Ads Manager'dan eklemeniz gerekir.
              </p>
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={ackCreativeLater}
                  onChange={(e) => setAckCreativeLater(e.target.checked)}
                />
                Kreatifi Ads Manager'dan ekleyeceğim, devam et.
              </label>
            </div>
          )}

          {/* Missing reasons (for visibility) */}
          {missing.length > 0 && (
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                Eksik Varlıklar
              </p>
              <ul className="space-y-1">
                {missing.map((m) => (
                  <li key={m.asset} className="text-xs text-gray-600 flex items-start gap-2">
                    <span
                      className={`shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${
                        missingNames.has(m.asset) ? 'bg-gray-500' : 'bg-gray-300'
                      }`}
                    />
                    <span>
                      <strong className="text-gray-800">{m.asset}:</strong> {m.reason}
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
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Geri
        </button>
        <button
          onClick={handleConfirm}
          disabled={blocking}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            blocking
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary/90'
          }`}
        >
          {blocking ? 'Eksikleri Tamamlayın' : 'Taslağı Oluştur (PAUSED)'}
        </button>
      </div>
    </div>
  )
}
