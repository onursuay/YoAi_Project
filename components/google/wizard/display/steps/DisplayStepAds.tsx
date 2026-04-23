'use client'

import { useState } from 'react'
import { X, Youtube, Image as ImageIcon, Shapes, Film, Plus } from 'lucide-react'
import type { StepProps, DisplayAsset, DisplayAssetKind } from '../../shared/WizardTypes'
import { inputCls } from '../../shared/WizardTypes'
import DisplayImagePicker from './DisplayImagePicker'
import DisplayLogoPicker from './DisplayLogoPicker'
import DisplayVideoPicker from './DisplayVideoPicker'

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

const IMAGE_KIND_RATIO_LABEL: Record<DisplayAssetKind, string> = {
  MARKETING_IMAGE: '1.91:1',
  SQUARE_MARKETING_IMAGE: '1:1',
  PORTRAIT_MARKETING_IMAGE: '4:5',
  LOGO: '4:1',
  SQUARE_LOGO: '1:1',
  YOUTUBE_VIDEO: '—',
}

export default function DisplayStepAds({ state, update, t }: StepProps) {
  const [imageOpen, setImageOpen] = useState(false)
  const [logoOpen, setLogoOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)

  const addAsset = (asset: DisplayAsset) => {
    update({ displayAssets: [...state.displayAssets, asset] })
  }

  const removeAsset = (resourceName: string) => {
    update({ displayAssets: state.displayAssets.filter(a => a.resourceName !== resourceName) })
  }

  const imageAssets = state.displayAssets.filter(a =>
    a.kind === 'MARKETING_IMAGE' || a.kind === 'SQUARE_MARKETING_IMAGE' || a.kind === 'PORTRAIT_MARKETING_IMAGE'
  )
  const logoAssets = state.displayAssets.filter(a => a.kind === 'LOGO' || a.kind === 'SQUARE_LOGO')
  const videoAssets = state.displayAssets.filter(a => a.kind === 'YOUTUBE_VIDEO')

  const landscapeCount = imageAssets.filter(a => a.kind === 'MARKETING_IMAGE').length
  const squareCount = imageAssets.filter(a => a.kind === 'SQUARE_MARKETING_IMAGE').length

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

      <section className="space-y-6 border border-gray-200 rounded-lg bg-white p-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-gray-600" />
          <h4 className="text-[15px] font-semibold text-gray-900">{t('display.assetsSectionTitle')}</h4>
        </div>

        {/* Resimler */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label className="text-sm font-medium text-gray-700">{t('display.imageSectionLabel')}</label>
            <span className="text-xs text-gray-500">{t('display.imageSectionHint', { landscape: landscapeCount, square: squareCount })}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {imageAssets.map(a => (
              <div key={a.resourceName} className="relative w-24 h-24 rounded border border-gray-200 overflow-hidden bg-gray-50 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.previewUrl} alt={a.name} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeAsset(a.resourceName)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"
                  aria-label={t('display.removeAsset')}
                >
                  <X className="w-3 h-3" />
                </button>
                <span className="absolute bottom-0 inset-x-0 text-[9px] text-center bg-black/50 text-white py-0.5">
                  {IMAGE_KIND_RATIO_LABEL[a.kind]}
                </span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setImageOpen(true)}
              disabled={imageAssets.length >= 15}
              className="w-24 h-24 rounded border-2 border-dashed border-gray-300 hover:border-blue-400 flex flex-col items-center justify-center text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={t('display.imageAddButton')}
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">{t('display.imageAddButton')}</span>
            </button>
          </div>
        </div>

        {/* Logolar — 3-tab picker */}
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

        {/* Videolar — 2-tab picker */}
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

      <DisplayImagePicker
        isOpen={imageOpen}
        onClose={() => setImageOpen(false)}
        existing={state.displayAssets}
        onAdd={addAsset}
        defaultWebUrl={state.finalUrl && state.finalUrl !== 'https://' ? state.finalUrl : ''}
        t={t}
      />

      <DisplayLogoPicker
        isOpen={logoOpen}
        onClose={() => setLogoOpen(false)}
        existing={state.displayAssets}
        onAdd={addAsset}
        defaultWebUrl={state.finalUrl && state.finalUrl !== 'https://' ? state.finalUrl : ''}
        t={t}
      />

      <DisplayVideoPicker
        isOpen={videoOpen}
        onClose={() => setVideoOpen(false)}
        existing={state.displayAssets}
        onAdd={addAsset}
        t={t}
      />
    </div>
  )
}
