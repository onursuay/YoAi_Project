'use client'

import { useRef, useState } from 'react'
import { Upload, X, Loader2, Youtube, Image as ImageIcon, Sparkles, Shapes, Film } from 'lucide-react'
import type { StepProps, DisplayAsset, DisplayAssetKind } from '../../shared/WizardTypes'
import { inputCls } from '../../shared/WizardTypes'
import DisplayStockImagePicker from './DisplayStockImagePicker'
import DisplayLogoPicker from './DisplayLogoPicker'
import DisplayVideoPicker from './DisplayVideoPicker'
import { IMAGE_SPECS, validateImageForKind, readImageDimensions, MAX_IMAGE_BYTES } from './displayImageSpecs'

function updateHeadline(state: StepProps['state'], index: number, value: string) {
  const next = [...state.displayHeadlines]
  next[index] = value
  return { displayHeadlines: next }
}

function updateDescription(state: StepProps['state'], index: number, value: string) {
  const next = [...state.displayDescriptions]
  next[index] = value
  return { displayDescriptions: next }
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

const KIND_CONFIG: Record<Exclude<DisplayAssetKind, 'YOUTUBE_VIDEO'>, { labelKey: string; hintKey: string; required?: boolean }> = {
  MARKETING_IMAGE: { labelKey: 'display.imageLandscape', hintKey: 'display.imageLandscapeHint', required: true },
  SQUARE_MARKETING_IMAGE: { labelKey: 'display.imageSquare', hintKey: 'display.imageSquareHint', required: true },
  PORTRAIT_MARKETING_IMAGE: { labelKey: 'display.imagePortrait', hintKey: 'display.imagePortraitHint' },
  LOGO: { labelKey: 'display.logoLandscape', hintKey: 'display.logoLandscapeHint' },
  SQUARE_LOGO: { labelKey: 'display.logoSquare', hintKey: 'display.logoSquareHint' },
}

function ImageUploader({ kind, state, update, t }: { kind: Exclude<DisplayAssetKind, 'YOUTUBE_VIDEO'> } & StepProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const assetsOfKind = state.displayAssets.filter(a => a.kind === kind)
  const cfg = KIND_CONFIG[kind]

  const onPick = async (file: File) => {
    setErr(null)
    if (!/^image\/(jpeg|png|gif)$/i.test(file.type)) {
      setErr(t('display.uploadErrorType'))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErr(t('display.uploadErrorSize'))
      return
    }
    // Boyut/oran kontrolü (Google Ads RDA şartları)
    let dims: { width: number; height: number }
    try {
      dims = await readImageDimensions(file)
    } catch {
      setErr(t('display.uploadErrorType'))
      return
    }
    const validation = validateImageForKind(dims.width, dims.height, file.size, kind)
    if (!validation.ok) {
      const spec = IMAGE_SPECS[kind]
      if (validation.code === 'wrongRatio') {
        const ratioLabel = spec.ratio === 1 ? '1:1' : spec.ratio === 1.91 ? '1.91:1' : spec.ratio === 4 ? '4:1' : '4:5'
        setErr(t('display.validation.wrongRatio', { expected: ratioLabel, actual: `${dims.width}×${dims.height}` }))
      } else if (validation.code === 'tooSmall') {
        setErr(t('display.validation.tooSmall', { min: `${spec.minWidth}×${spec.minHeight}` }))
      } else if (validation.code === 'tooBig') {
        setErr(t('display.validation.tooBig', { max: `${spec.maxWidth}×${spec.maxHeight}` }))
      } else {
        setErr(t('display.uploadErrorSize'))
      }
      return
    }
    setUploading(true)
    try {
      const data = await fileToBase64(file)
      const res = await fetch('/api/integrations/google-ads/assets/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name: file.name, data }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErr(json.error ?? t('display.uploadErrorGeneric'))
        return
      }
      const previewUrl = URL.createObjectURL(file)
      const newAsset: DisplayAsset = {
        resourceName: json.resourceName,
        kind,
        previewUrl,
        name: file.name,
      }
      update({ displayAssets: [...state.displayAssets, newAsset] })
    } catch {
      setErr(t('display.uploadErrorGeneric'))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onRemove = (resourceName: string) => {
    update({ displayAssets: state.displayAssets.filter(a => a.resourceName !== resourceName) })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-gray-700">
          {t(cfg.labelKey)} {cfg.required && <span className="text-red-500">*</span>}
        </label>
        <span className="text-xs text-gray-500">{t(cfg.hintKey)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {assetsOfKind.map(a => (
          <div key={a.resourceName} className="relative w-20 h-20 rounded border border-gray-200 overflow-hidden bg-gray-50 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.previewUrl} alt={a.name} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(a.resourceName)}
              className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"
              aria-label={t('display.removeAsset')}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-20 h-20 rounded border-2 border-dashed border-gray-300 hover:border-blue-400 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) void onPick(f)
          }}
        />
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
    </div>
  )
}

export default function DisplayStepAds({ state, update, t }: StepProps) {
  const [stockOpen, setStockOpen] = useState(false)
  const [logoOpen, setLogoOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)

  const addFromStock = (asset: DisplayAsset) => {
    update({ displayAssets: [...state.displayAssets, asset] })
  }

  const addLogo = (asset: DisplayAsset) => {
    update({ displayAssets: [...state.displayAssets, asset] })
  }

  const removeAsset = (resourceName: string) => {
    update({ displayAssets: state.displayAssets.filter(a => a.resourceName !== resourceName) })
  }

  const logoAssets = state.displayAssets.filter(a => a.kind === 'LOGO' || a.kind === 'SQUARE_LOGO')
  const videoAssets = state.displayAssets.filter(a => a.kind === 'YOUTUBE_VIDEO')

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('display.finalUrl')} <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          className={inputCls}
          value={state.finalUrl}
          onChange={e => update({ finalUrl: e.target.value })}
          placeholder="https://example.com"
        />
      </div>

      <section className="space-y-4 border border-gray-200 rounded-lg bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-gray-600" />
            <h4 className="text-[15px] font-semibold text-gray-900">{t('display.assetsSectionTitle')}</h4>
          </div>
          <button
            type="button"
            onClick={() => setStockOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium border border-gray-200 hover:border-blue-400 hover:text-blue-600 rounded-lg text-gray-700 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t('display.addFromStock')}
          </button>
        </div>
        <ImageUploader kind="MARKETING_IMAGE" state={state} update={update} t={t} />
        <ImageUploader kind="SQUARE_MARKETING_IMAGE" state={state} update={update} t={t} />
        <ImageUploader kind="PORTRAIT_MARKETING_IMAGE" state={state} update={update} t={t} />

        {/* Logolar — tek buton, 3-tab picker ile eklenir */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label className="text-sm font-medium text-gray-700">{t('display.logoSectionLabel')}</label>
            <span className="text-xs text-gray-500">{t('display.logoSectionHint')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {logoAssets.map(a => (
              <div key={a.resourceName} className="relative w-20 h-20 rounded border border-gray-200 overflow-hidden bg-white group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.previewUrl} alt={a.name} className="w-full h-full object-contain" />
                <button
                  type="button"
                  onClick={() => removeAsset(a.resourceName)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"
                  aria-label={t('display.removeAsset')}
                >
                  <X className="w-3 h-3" />
                </button>
                <span className="absolute bottom-0 inset-x-0 text-[9px] text-center bg-black/50 text-white py-0.5">
                  {a.kind === 'LOGO' ? '4:1' : '1:1'}
                </span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLogoOpen(true)}
              disabled={logoAssets.length >= 5}
              className="w-20 h-20 rounded border-2 border-dashed border-gray-300 hover:border-blue-400 flex flex-col items-center justify-center text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={t('display.logoAddButton')}
            >
              <Shapes className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">{t('display.logoAddButton')}</span>
            </button>
          </div>
        </div>

        {/* Videolar — 2-tab picker (Öğe Kitaplığı + YouTube'da Ara) */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label className="text-sm font-medium text-gray-700">{t('display.videoSectionLabel')}</label>
            <span className="text-xs text-gray-500">{t('display.videoSectionHint')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {videoAssets.map(v => (
              <div key={v.resourceName} className="relative w-32 h-20 rounded border border-gray-200 overflow-hidden bg-white group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.previewUrl} alt={v.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Youtube className="w-5 h-5 text-white" />
                </div>
                <button
                  type="button"
                  onClick={() => removeAsset(v.resourceName)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"
                  aria-label={t('display.removeAsset')}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              disabled={videoAssets.length >= 5}
              className="w-32 h-20 rounded border-2 border-dashed border-gray-300 hover:border-blue-400 flex flex-col items-center justify-center text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={t('display.videoAddButton')}
            >
              <Film className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">{t('display.videoAddButton')}</span>
            </button>
          </div>
        </div>
      </section>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-sm font-medium text-gray-700">
            {t('display.businessName')} <span className="text-red-500">*</span>
          </label>
          <span className="text-xs text-gray-400">{state.displayBusinessName.length}/25</span>
        </div>
        <input
          className={inputCls}
          maxLength={25}
          value={state.displayBusinessName}
          onChange={e => update({ displayBusinessName: e.target.value.slice(0, 25) })}
          placeholder={t('display.businessNamePlaceholder')}
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700">{t('display.headlines')}</label>
          <span className="text-xs text-gray-500">{t('display.headlinesHint')}</span>
        </div>
        <div className="space-y-2">
          {state.displayHeadlines.map((h, i) => (
            <div key={i}>
              <div className="flex justify-end mb-0.5">
                <span className="text-xs text-gray-400">{h.length}/30</span>
              </div>
              <input
                className={inputCls}
                maxLength={30}
                value={h}
                onChange={e => update(updateHeadline(state, i, e.target.value.slice(0, 30)))}
                placeholder={t('display.headlinePlaceholder', { n: i + 1 })}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-sm font-medium text-gray-700">
            {t('display.longHeadline')} <span className="text-red-500">*</span>
          </label>
          <span className="text-xs text-gray-400">{state.displayLongHeadline.length}/90</span>
        </div>
        <input
          className={inputCls}
          maxLength={90}
          value={state.displayLongHeadline}
          onChange={e => update({ displayLongHeadline: e.target.value.slice(0, 90) })}
          placeholder={t('display.longHeadlinePlaceholder')}
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700">{t('display.descriptions')}</label>
          <span className="text-xs text-gray-500">{t('display.descriptionsHint')}</span>
        </div>
        <div className="space-y-2">
          {state.displayDescriptions.map((d, i) => (
            <div key={i}>
              <div className="flex justify-end mb-0.5">
                <span className="text-xs text-gray-400">{d.length}/90</span>
              </div>
              <textarea
                className={`${inputCls} min-h-[72px] resize-y`}
                maxLength={90}
                value={d}
                onChange={e => update(updateDescription(state, i, e.target.value.slice(0, 90)))}
                placeholder={t('display.descriptionPlaceholder', { n: i + 1 })}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('display.callToActionLabel')}</label>
        <select
          className={inputCls}
          value={state.displayCallToAction}
          onChange={e => update({ displayCallToAction: e.target.value })}
        >
          <option value="">{t('display.ctaAuto')}</option>
          <option value="APPLY_NOW">{t('display.ctaApplyNow')}</option>
          <option value="BOOK_NOW">{t('display.ctaBookNow')}</option>
          <option value="CONTACT_US">{t('display.ctaContactUs')}</option>
          <option value="DOWNLOAD">{t('display.ctaDownload')}</option>
          <option value="LEARN_MORE">{t('display.ctaLearnMore')}</option>
          <option value="SHOP_NOW">{t('display.ctaShopNow')}</option>
          <option value="SIGN_UP">{t('display.ctaSignUp')}</option>
          <option value="SUBSCRIBE">{t('display.ctaSubscribe')}</option>
          <option value="GET_QUOTE">{t('display.ctaGetQuote')}</option>
          <option value="VISIT_SITE">{t('display.ctaVisitSite')}</option>
        </select>
      </div>

      <DisplayStockImagePicker
        isOpen={stockOpen}
        onClose={() => setStockOpen(false)}
        existing={state.displayAssets}
        onAdd={addFromStock}
        t={t}
      />

      <DisplayLogoPicker
        isOpen={logoOpen}
        onClose={() => setLogoOpen(false)}
        existing={state.displayAssets}
        onAdd={addLogo}
        defaultWebUrl={state.finalUrl && state.finalUrl !== 'https://' ? state.finalUrl : ''}
        t={t}
      />

      <DisplayVideoPicker
        isOpen={videoOpen}
        onClose={() => setVideoOpen(false)}
        existing={state.displayAssets}
        onAdd={addLogo}
        t={t}
      />
    </div>
  )
}
