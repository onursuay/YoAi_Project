'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, Image, Type, Radio, Users, X, Plus, Link2, Video } from 'lucide-react'
import type { PMaxStepProps, PMaxSitelink, PMaxCallToAction } from '../shared/PMaxWizardTypes'
import { inputCls, PMaxCallToActionOptions } from '../shared/PMaxWizardTypes'

function Field({ label, required, children, hint }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-500 mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

function CollapsibleSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center justify-between w-full px-5 py-4 text-left">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 pt-0">{children}</div>}
    </div>
  )
}

export default function PMaxStepAssetGroup({ state, update, t }: PMaxStepProps) {
  const [searchThemeInput, setSearchThemeInput] = useState('')

  // Headlines (3-15, max 30 chars)
  const addHeadline = () => { if (state.headlines.length < 15) update({ headlines: [...state.headlines, ''] }) }
  const removeHeadline = (i: number) => { if (state.headlines.length > 3) update({ headlines: state.headlines.filter((_, idx) => idx !== i) }) }

  // Long headlines (1-5, max 90 chars)
  const addLongHeadline = () => { if (state.longHeadlines.length < 5) update({ longHeadlines: [...state.longHeadlines, ''] }) }
  const removeLongHeadline = (i: number) => { if (state.longHeadlines.length > 1) update({ longHeadlines: state.longHeadlines.filter((_, idx) => idx !== i) }) }

  // Descriptions (3-5, max 90 chars)
  const addDescription = () => { if (state.descriptions.length < 5) update({ descriptions: [...state.descriptions, ''] }) }
  const removeDescription = (i: number) => { if (state.descriptions.length > 3) update({ descriptions: state.descriptions.filter((_, idx) => idx !== i) }) }

  // Sitelinks
  const addSitelink = () => {
    if (state.sitelinks.length < 8) update({ sitelinks: [...state.sitelinks, { title: '', description1: '', description2: '', finalUrl: '' }] })
  }
  const removeSitelink = (i: number) => { update({ sitelinks: state.sitelinks.filter((_, idx) => idx !== i) }) }
  const updateSitelink = (i: number, field: keyof PMaxSitelink, val: string) => {
    const next = [...state.sitelinks]
    next[i] = { ...next[i], [field]: val }
    update({ sitelinks: next })
  }

  // Videos
  const addVideo = () => {
    if (state.videos.length < 5) update({ videos: [...state.videos, { id: `vid-${Date.now()}`, url: '' }] })
  }
  const removeVideo = (i: number) => { update({ videos: state.videos.filter((_, idx) => idx !== i) }) }

  // Search themes
  const addSearchTheme = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const existingLower = new Set(state.searchThemes.map(st => st.text.trim().toLowerCase()).filter(Boolean))
    if (existingLower.has(trimmed.toLowerCase())) return
    if (state.searchThemes.length >= 25) return
    update({ searchThemes: [...state.searchThemes, { text: trimmed }] })
    setSearchThemeInput('')
  }
  const removeSearchTheme = (i: number) => { update({ searchThemes: state.searchThemes.filter((_, idx) => idx !== i) }) }

  return (
    <div className="space-y-4 pt-2">
      {/* Asset Group Name */}
      <Field label={t('assetGroup.assetGroupName')} required>
        <input className={inputCls} value={state.assetGroupName} onChange={e => update({ assetGroupName: e.target.value })} placeholder={t('assetGroup.assetGroupNamePlaceholder')} />
      </Field>

      {/* Öğeler section */}
      <CollapsibleSection title={t('assetGroup.assetsSection')}>
        <div className="space-y-5">
          {/* Final URL */}
          <Field label={t('conversion.finalUrl')} required>
            <input className={inputCls} value={state.finalUrl} onChange={e => update({ finalUrl: e.target.value })} placeholder="https://example.com" />
          </Field>

          {/* Business Name */}
          <Field label={t('assetGroup.businessName')} required hint={t('assetGroup.businessNameHint')}>
            <input className={inputCls} value={state.businessName} onChange={e => update({ businessName: e.target.value.slice(0, 25) })} placeholder={t('assetGroup.businessNamePlaceholder')} maxLength={25} />
            <p className="text-xs text-gray-400 mt-1">{state.businessName.length}/25</p>
          </Field>

          {/* Headlines (3-15) */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Type className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-gray-900">{t('assetGroup.headlinesTitle')}</h4>
            </div>
            <p className="text-xs text-gray-500 mb-2">{t('assetGroup.headlinesHint')}</p>
            <div className="space-y-2">
              {state.headlines.map((h, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className={`${inputCls} flex-1`}
                    value={h}
                    onChange={e => { const next = [...state.headlines]; next[i] = e.target.value.slice(0, 30); update({ headlines: next }) }}
                    placeholder={`${t('assetGroup.headlinePlaceholder')} ${i + 1}`}
                    maxLength={30}
                  />
                  <span className="text-xs text-gray-400 w-8 text-right shrink-0">{h.length}/30</span>
                  <button type="button" onClick={() => removeHeadline(i)} disabled={state.headlines.length <= 3} className="px-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30 shrink-0">×</button>
                </div>
              ))}
              {state.headlines.length < 15 && (
                <button type="button" onClick={addHeadline} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  <Plus className="w-3.5 h-3.5" /> {t('assetGroup.addHeadline')}
                </button>
              )}
            </div>
          </section>

          {/* Long Headlines (1-5) */}
          <section>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">{t('assetGroup.longHeadlinesTitle')}</h4>
            <p className="text-xs text-gray-500 mb-2">{t('assetGroup.longHeadlinesHint')}</p>
            <div className="space-y-2">
              {state.longHeadlines.map((h, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className={`${inputCls} flex-1`}
                    value={h}
                    onChange={e => { const next = [...state.longHeadlines]; next[i] = e.target.value.slice(0, 90); update({ longHeadlines: next }) }}
                    placeholder={`${t('assetGroup.longHeadlinePlaceholder')} ${i + 1}`}
                    maxLength={90}
                  />
                  <span className="text-xs text-gray-400 w-8 text-right shrink-0">{h.length}/90</span>
                  <button type="button" onClick={() => removeLongHeadline(i)} disabled={state.longHeadlines.length <= 1} className="px-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30 shrink-0">×</button>
                </div>
              ))}
              {state.longHeadlines.length < 5 && (
                <button type="button" onClick={addLongHeadline} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  <Plus className="w-3.5 h-3.5" /> {t('assetGroup.addLongHeadline')}
                </button>
              )}
            </div>
          </section>

          {/* Descriptions (3-5) */}
          <section>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">{t('assetGroup.descriptionsTitle')}</h4>
            <p className="text-xs text-gray-500 mb-2">{t('assetGroup.descriptionsHint')}</p>
            <div className="space-y-2">
              {state.descriptions.map((d, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <textarea
                    className={`${inputCls} flex-1 min-h-[56px]`}
                    value={d}
                    onChange={e => { const next = [...state.descriptions]; next[i] = e.target.value.slice(0, 90); update({ descriptions: next }) }}
                    placeholder={`${t('assetGroup.descriptionPlaceholder')} ${i + 1}`}
                    maxLength={90}
                    rows={2}
                  />
                  <span className="text-xs text-gray-400 w-8 text-right shrink-0 mt-2">{d.length}/90</span>
                  <button type="button" onClick={() => removeDescription(i)} disabled={state.descriptions.length <= 3} className="px-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30 shrink-0 mt-2">×</button>
                </div>
              ))}
              {state.descriptions.length < 5 && (
                <button type="button" onClick={addDescription} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  <Plus className="w-3.5 h-3.5" /> {t('assetGroup.addDescription')}
                </button>
              )}
            </div>
          </section>

          {/* Images & Logos */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Image className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-gray-900">{t('assetGroup.imagesTitle')}</h4>
            </div>
            <p className="text-xs text-gray-500 mb-3">{t('assetGroup.imagesHint')}</p>
            <div className="space-y-3">
              <Field label={t('assetGroup.marketingImageUrl')} required>
                <input
                  className={inputCls}
                  value={state.images[0]?.url ?? ''}
                  onChange={e => {
                    const next = [...state.images]
                    if (next[0]) next[0] = { ...next[0], url: e.target.value.trim() }
                    else next.push({ id: `img-${Date.now()}`, url: e.target.value.trim() })
                    update({ images: next })
                  }}
                  placeholder="https://example.com/image.jpg (1200×628)"
                />
              </Field>
              <Field label={t('assetGroup.logoUrl')} required>
                <input
                  className={inputCls}
                  value={state.logos[0]?.url ?? ''}
                  onChange={e => {
                    const next = [...state.logos]
                    if (next[0]) next[0] = { ...next[0], url: e.target.value.trim() }
                    else next.push({ id: `logo-${Date.now()}`, url: e.target.value.trim() })
                    update({ logos: next })
                  }}
                  placeholder="https://example.com/logo.png (1200×1200)"
                />
              </Field>
            </div>
          </section>

          {/* Videos (0-5) */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Video className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-gray-900">{t('assetGroup.videosTitle')}</h4>
            </div>
            <p className="text-xs text-gray-500 mb-2">{t('assetGroup.videosHint')}</p>
            <div className="space-y-2">
              {state.videos.map((v, i) => (
                <div key={v.id} className="flex gap-2 items-center">
                  <input
                    className={`${inputCls} flex-1`}
                    value={v.url ?? ''}
                    onChange={e => {
                      const next = [...state.videos]
                      next[i] = { ...next[i], url: e.target.value.trim() }
                      update({ videos: next })
                    }}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <button type="button" onClick={() => removeVideo(i)} className="px-1.5 text-gray-400 hover:text-red-600 shrink-0">×</button>
                </div>
              ))}
              {state.videos.length < 5 && (
                <button type="button" onClick={addVideo} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  <Plus className="w-3.5 h-3.5" /> {t('assetGroup.addVideo')}
                </button>
              )}
            </div>
          </section>

          {/* Sitelinks (0-8, recommended 6+) */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-gray-900">{t('assetGroup.sitelinksTitle')}</h4>
            </div>
            <p className="text-xs text-gray-500 mb-3">{t('assetGroup.sitelinksHint')}</p>
            <div className="space-y-3">
              {state.sitelinks.map((sl, i) => (
                <div key={i} className="p-3 border border-gray-200 rounded-lg space-y-2 relative">
                  <button type="button" onClick={() => removeSitelink(i)} className="absolute top-2 right-2 text-gray-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputCls} value={sl.title} onChange={e => updateSitelink(i, 'title', e.target.value.slice(0, 25))} placeholder={`${t('assetGroup.sitelinkTitle')} (max 25)`} maxLength={25} />
                    <input className={inputCls} value={sl.finalUrl} onChange={e => updateSitelink(i, 'finalUrl', e.target.value)} placeholder={t('assetGroup.sitelinkUrl')} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputCls} value={sl.description1} onChange={e => updateSitelink(i, 'description1', e.target.value.slice(0, 35))} placeholder={`${t('assetGroup.sitelinkDesc')} 1 (max 35)`} maxLength={35} />
                    <input className={inputCls} value={sl.description2} onChange={e => updateSitelink(i, 'description2', e.target.value.slice(0, 35))} placeholder={`${t('assetGroup.sitelinkDesc')} 2 (max 35)`} maxLength={35} />
                  </div>
                </div>
              ))}
              {state.sitelinks.length < 8 && (
                <button type="button" onClick={addSitelink} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  <Plus className="w-3.5 h-3.5" /> {t('assetGroup.addSitelink')}
                </button>
              )}
            </div>
          </section>

          {/* Call to Action */}
          <Field label={t('assetGroup.ctaTitle')}>
            <select
              className={`${inputCls} max-w-[240px]`}
              value={state.callToAction}
              onChange={e => update({ callToAction: e.target.value as PMaxCallToAction })}
            >
              {PMaxCallToActionOptions.map(cta => (
                <option key={cta} value={cta}>{t(`assetGroup.ctaOptions.${cta}`)}</option>
              ))}
            </select>
          </Field>

          {/* Display URL Paths */}
          <Field label={t('assetGroup.displayPathTitle')} hint={t('assetGroup.displayPathHint')}>
            <div className="flex items-center gap-1 max-w-sm">
              <span className="text-sm text-gray-500 shrink-0">example.com/</span>
              <input
                className={`${inputCls} w-28`}
                value={state.displayPaths[0]}
                onChange={e => update({ displayPaths: [e.target.value.slice(0, 15), state.displayPaths[1]] })}
                placeholder={t('assetGroup.displayPath')}
                maxLength={15}
              />
              <span className="text-sm text-gray-400">/</span>
              <input
                className={`${inputCls} w-28`}
                value={state.displayPaths[1]}
                onChange={e => update({ displayPaths: [state.displayPaths[0], e.target.value.slice(0, 15)] })}
                placeholder={t('assetGroup.displayPath')}
                maxLength={15}
              />
            </div>
          </Field>
        </div>
      </CollapsibleSection>

      {/* Asset Optimization */}
      <CollapsibleSection title={t('assetGroup.optimizationTitle')}>
        <div className="space-y-3">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={state.textCustomizationEnabled} onChange={e => update({ textCustomizationEnabled: e.target.checked })} className="rounded border-gray-300 text-blue-600" />
            <div>
              <span className="text-sm font-medium text-gray-700">{t('assetGroup.textCustomization')}</span>
              <p className="text-xs text-gray-500">{t('assetGroup.textCustomizationDesc')}</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={state.finalUrlExpansionEnabled} onChange={e => update({ finalUrlExpansionEnabled: e.target.checked })} className="rounded border-gray-300 text-blue-600" />
            <div>
              <span className="text-sm font-medium text-gray-700">{t('assetGroup.finalUrlExpansion')}</span>
              <p className="text-xs text-gray-500">{t('assetGroup.finalUrlExpansionDesc')}</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={state.imageEnhancementEnabled} onChange={e => update({ imageEnhancementEnabled: e.target.checked })} className="rounded border-gray-300 text-blue-600" />
            <div>
              <span className="text-sm font-medium text-gray-700">{t('assetGroup.imageEnhancement')}</span>
              <p className="text-xs text-gray-500">{t('assetGroup.imageEnhancementDesc')}</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={state.videoEnhancementEnabled} onChange={e => update({ videoEnhancementEnabled: e.target.checked })} className="rounded border-gray-300 text-blue-600" />
            <div>
              <span className="text-sm font-medium text-gray-700">{t('assetGroup.videoEnhancement')}</span>
              <p className="text-xs text-gray-500">{t('assetGroup.videoEnhancementDesc')}</p>
            </div>
          </label>
        </div>
      </CollapsibleSection>

      {/* Search Themes */}
      <CollapsibleSection title={t('signals.searchThemesTitle')}>
        <div className="space-y-3">
          <p className="text-xs text-gray-500">{t('signals.searchThemesHint')}</p>
          <div className="flex gap-2 flex-wrap items-center">
            {state.searchThemes.filter(st => st.text.trim()).map((st, i) => (
              <span key={`${st.text}-${i}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 text-sm border border-blue-200">
                {st.text.trim()}
                <button type="button" onClick={() => removeSearchTheme(i)} className="hover:text-red-600 p-0.5 rounded-full hover:bg-blue-100" aria-label={t('signals.removeTheme')}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            <div className="flex gap-2 flex-1 min-w-[200px]">
              <input
                className={inputCls}
                value={searchThemeInput}
                onChange={e => setSearchThemeInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSearchTheme(searchThemeInput))}
                placeholder={t('signals.searchThemePlaceholder')}
              />
              <button
                type="button"
                onClick={() => addSearchTheme(searchThemeInput)}
                disabled={!searchThemeInput.trim() || state.searchThemes.length >= 25}
                className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
              >
                {t('signals.addSearchTheme')}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400">{state.searchThemes.length}/25</p>
        </div>
      </CollapsibleSection>

      {/* Audience Signals */}
      <CollapsibleSection title={t('signals.audienceTitle')}>
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <Radio className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-blue-900">{t('signals.title')}</h4>
              <p className="text-sm text-blue-800 mt-1">{t('signals.description')}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">{t('signals.audienceTitle')}</span>
            <span className="text-sm text-gray-600">{t('signals.audienceCount', { count: state.selectedAudienceSegments.length })}</span>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
            <Users className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600">{t('signals.audienceNote')}</p>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  )
}
