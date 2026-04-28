'use client'

import { useState } from 'react'
import { X, Youtube, Image as ImageIcon, Shapes, Film, Plus, Link2, Building2, Type, AlignLeft, MousePointerClick } from 'lucide-react'
import type { StepProps, DisplayAsset, DisplayAssetKind } from '../../shared/WizardTypes'
import DisplayImagePicker from './DisplayImagePicker'
import DisplayLogoPicker from './DisplayLogoPicker'
import DisplayVideoPicker from './DisplayVideoPicker'
import { DisplaySection, displayInputCls } from '../DisplayWizardUI'
import WizardSelect from '@/components/meta/wizard/WizardSelect'

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
    <div className="space-y-8">
      {/* Final URL */}
      <DisplaySection
        icon={<Link2 className="w-[18px] h-[18px]" />}
        title={t('display.finalUrl')}
      >
        <input
          type="url"
          className={displayInputCls}
          value={state.finalUrl}
          onChange={e => update({ finalUrl: e.target.value })}
          placeholder="https://example.com"
        />
      </DisplaySection>

      {/* Assets */}
      <DisplaySection
        icon={<ImageIcon className="w-[18px] h-[18px]" />}
        title={t('display.assetsSectionTitle')}
      >
        <div className="grid grid-cols-3 gap-4 items-stretch">
          {/* Resimler */}
          <div className="flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden">
            <div className="px-4 pt-4 pb-2 text-center border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">{t('display.imageSectionLabel')}</p>
            </div>
            <div className="flex-1 flex flex-wrap gap-2 items-start p-4 min-h-[120px]">
              {imageAssets.map(a => (
                <div key={a.resourceName} className="relative w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 group shrink-0">
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
                className={`rounded-lg border-2 border-dashed border-gray-300 hover:border-primary flex flex-col items-center justify-center text-gray-400 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${imageAssets.length === 0 ? 'w-full flex-1 min-h-[88px]' : 'w-16 h-16'}`}
              >
                <Plus className="w-5 h-5" />
                <span className="text-[9px] mt-0.5">{t('display.imageAddButton')}</span>
              </button>
            </div>
            <div className="px-4 pb-3 pt-1 border-t border-gray-100 text-center">
              <p className="text-[11px] text-gray-400">{t('display.imageSectionHint', { landscape: landscapeCount, square: squareCount })}</p>
            </div>
          </div>

          {/* Logolar */}
          <div className="flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden">
            <div className="px-4 pt-4 pb-2 text-center border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">{t('display.logoSectionLabel')}</p>
            </div>
            <div className="flex-1 flex flex-wrap gap-2 items-start p-4 min-h-[120px]">
              {logoAssets.map(a => (
                <div key={a.resourceName} className="relative w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-white group shrink-0">
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
                className={`rounded-lg border-2 border-dashed border-gray-300 hover:border-primary flex flex-col items-center justify-center text-gray-400 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${logoAssets.length === 0 ? 'w-full flex-1 min-h-[88px]' : 'w-16 h-16'}`}
              >
                <Shapes className="w-5 h-5" />
                <span className="text-[9px] mt-0.5">{t('display.logoAddButton')}</span>
              </button>
            </div>
            <div className="px-4 pb-3 pt-1 border-t border-gray-100 text-center">
              <p className="text-[11px] text-gray-400">{t('display.logoSectionHint')}</p>
            </div>
          </div>

          {/* Videolar */}
          <div className="flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden">
            <div className="px-4 pt-4 pb-2 text-center border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">{t('display.videoSectionLabel')}</p>
            </div>
            <div className="flex-1 flex flex-wrap gap-2 items-start p-4 min-h-[120px]">
              {videoAssets.map(v => (
                <div key={v.resourceName} className="relative w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-white group shrink-0">
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
                className={`rounded-lg border-2 border-dashed border-gray-300 hover:border-primary flex flex-col items-center justify-center text-gray-400 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${videoAssets.length === 0 ? 'w-full flex-1 min-h-[88px]' : 'w-16 h-16'}`}
              >
                <Film className="w-5 h-5" />
                <span className="text-[9px] mt-0.5">{t('display.videoAddButton')}</span>
              </button>
            </div>
            <div className="px-4 pb-3 pt-1 border-t border-gray-100 text-center">
              <p className="text-[11px] text-gray-400">{t('display.videoSectionHint')}</p>
            </div>
          </div>
        </div>
      </DisplaySection>

      {/* İşletme adı */}
      <DisplaySection
        icon={<Building2 className="w-[18px] h-[18px]" />}
        title={t('display.businessName')}
      >
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-sm font-medium text-gray-800">
              {t('display.businessName')} <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-gray-400">{state.displayBusinessName.length}/25</span>
          </div>
          <input
            className={displayInputCls}
            maxLength={25}
            value={state.displayBusinessName}
            onChange={e => update({ displayBusinessName: e.target.value.slice(0, 25) })}
            placeholder={t('display.businessNamePlaceholder')}
          />
        </div>
      </DisplaySection>

      {/* Başlıklar */}
      <DisplaySection
        icon={<Type className="w-[18px] h-[18px]" />}
        title={t('display.headlines')}
        description={t('display.headlinesHint')}
      >
        <div className="space-y-2">
          {state.displayHeadlines.map((h, i) => (
            <div key={i}>
              <div className="flex justify-end mb-0.5">
                <span className="text-xs text-gray-400">{h.length}/30</span>
              </div>
              <input
                className={displayInputCls}
                maxLength={30}
                value={h}
                onChange={e => update(updateHeadline(state, i, e.target.value.slice(0, 30)))}
                placeholder={t('display.headlinePlaceholder', { n: i + 1 })}
              />
            </div>
          ))}
        </div>

        <div className="mt-5">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-sm font-medium text-gray-800">
              {t('display.longHeadline')} <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-gray-400">{state.displayLongHeadline.length}/90</span>
          </div>
          <input
            className={displayInputCls}
            maxLength={90}
            value={state.displayLongHeadline}
            onChange={e => update({ displayLongHeadline: e.target.value.slice(0, 90) })}
            placeholder={t('display.longHeadlinePlaceholder')}
          />
        </div>
      </DisplaySection>

      {/* Açıklamalar */}
      <DisplaySection
        icon={<AlignLeft className="w-[18px] h-[18px]" />}
        title={t('display.descriptions')}
        description={t('display.descriptionsHint')}
      >
        <div className="space-y-2">
          {state.displayDescriptions.map((d, i) => (
            <div key={i}>
              <div className="flex justify-end mb-0.5">
                <span className="text-xs text-gray-400">{d.length}/90</span>
              </div>
              <textarea
                className={`${displayInputCls} min-h-[72px] resize-y`}
                maxLength={90}
                value={d}
                onChange={e => update(updateDescription(state, i, e.target.value.slice(0, 90)))}
                placeholder={t('display.descriptionPlaceholder', { n: i + 1 })}
              />
            </div>
          ))}
        </div>
      </DisplaySection>

      {/* Call to Action */}
      <DisplaySection
        icon={<MousePointerClick className="w-[18px] h-[18px]" />}
        title={t('display.callToActionLabel')}
      >
        <WizardSelect
          value={state.displayCallToAction}
          onChange={(v) => update({ displayCallToAction: v })}
          placeholder={t('display.ctaAuto')}
          options={[
            { value: '', label: t('display.ctaAuto') },
            { value: 'APPLY_NOW', label: t('display.ctaApplyNow') },
            { value: 'BOOK_NOW', label: t('display.ctaBookNow') },
            { value: 'CONTACT_US', label: t('display.ctaContactUs') },
            { value: 'DOWNLOAD', label: t('display.ctaDownload') },
            { value: 'LEARN_MORE', label: t('display.ctaLearnMore') },
            { value: 'SHOP_NOW', label: t('display.ctaShopNow') },
            { value: 'SIGN_UP', label: t('display.ctaSignUp') },
            { value: 'SUBSCRIBE', label: t('display.ctaSubscribe') },
            { value: 'GET_QUOTE', label: t('display.ctaGetQuote') },
            { value: 'VISIT_SITE', label: t('display.ctaVisitSite') },
          ]}
        />
      </DisplaySection>

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
