'use client'

import { useState } from 'react'
import { Image, Type, Radio, Users, X } from 'lucide-react'
import type { PMaxStepProps } from '../shared/PMaxWizardTypes'
import { inputCls } from '../shared/PMaxWizardTypes'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

/**
 * ÖĞE GRUBU — Google PMax parity.
 * Asset group + Signals (arama temaları, kitle sinyali) aynı step içinde.
 */
export default function PMaxStepAssetGroup({ state, update, t }: PMaxStepProps) {
  const [searchThemeInput, setSearchThemeInput] = useState('')
  const addHeadline = () => {
    if (state.headlines.length < 15) {
      update({ headlines: [...state.headlines, ''] })
    }
  }
  const removeHeadline = (i: number) => {
    if (state.headlines.length > 3) {
      update({ headlines: state.headlines.filter((_, idx) => idx !== i) })
    }
  }
  const addDescription = () => {
    if (state.descriptions.length < 5) {
      update({ descriptions: [...state.descriptions, ''] })
    }
  }
  const removeDescription = (i: number) => {
    if (state.descriptions.length > 2) {
      update({ descriptions: state.descriptions.filter((_, idx) => idx !== i) })
    }
  }

  const addSearchTheme = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const lower = trimmed.toLowerCase()
    const existingLower = new Set(state.searchThemes.map(st => st.text.trim().toLowerCase()).filter(Boolean))
    if (existingLower.has(lower)) return
    update({ searchThemes: [...state.searchThemes, { text: trimmed }] })
    setSearchThemeInput('')
  }
  const removeSearchTheme = (i: number) => {
    update({ searchThemes: state.searchThemes.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="space-y-6">
      <Field label={t('assetGroup.assetGroupName')} required>
        <input
          className={inputCls}
          value={state.assetGroupName}
          onChange={e => update({ assetGroupName: e.target.value })}
          placeholder={t('assetGroup.assetGroupNamePlaceholder')}
        />
      </Field>

      <Field label={t('assetGroup.businessName')} required>
        <input
          className={inputCls}
          value={state.businessName}
          onChange={e => update({ businessName: e.target.value })}
          placeholder={t('assetGroup.businessNamePlaceholder')}
        />
      </Field>

      <section>
        <div className="flex items-center gap-2 mb-2">
          <Type className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-semibold text-gray-900">{t('assetGroup.headlinesTitle')}</h4>
        </div>
        <p className="text-xs text-gray-500 mb-2">{t('assetGroup.headlinesHint')}</p>
        <div className="space-y-2">
          {state.headlines.map((h, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={`${inputCls} flex-1`}
                value={h}
                onChange={e => {
                  const next = [...state.headlines]
                  next[i] = e.target.value.slice(0, 30)
                  update({ headlines: next })
                }}
                placeholder={`${t('assetGroup.headlinePlaceholder')} ${i + 1} (max 30)`}
                maxLength={30}
              />
              <button
                type="button"
                onClick={() => removeHeadline(i)}
                disabled={state.headlines.length <= 3}
                className="px-2 text-gray-500 hover:text-red-600 disabled:opacity-40 shrink-0"
              >
                ×
              </button>
            </div>
          ))}
          {state.headlines.length < 15 && (
            <button
              type="button"
              onClick={addHeadline}
              className="text-sm text-blue-600 hover:underline"
            >
              + {t('assetGroup.addHeadline')}
            </button>
          )}
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">{t('assetGroup.longHeadlinesTitle')}</h4>
        <p className="text-xs text-gray-500 mb-2">{t('assetGroup.longHeadlinesHint')}</p>
        <div className="space-y-2">
          {state.longHeadlines.map((h, i) => (
            <input
              key={i}
              className={inputCls}
              value={h}
              onChange={e => {
                const next = [...state.longHeadlines]
                next[i] = e.target.value.slice(0, 90)
                update({ longHeadlines: next })
              }}
              placeholder={`${t('assetGroup.longHeadlinePlaceholder')} (max 90)`}
              maxLength={90}
            />
          ))}
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">{t('assetGroup.descriptionsTitle')}</h4>
        <p className="text-xs text-gray-500 mb-2">{t('assetGroup.descriptionsHint')}</p>
        <div className="space-y-2">
          {state.descriptions.map((d, i) => (
            <div key={i} className="flex gap-2">
              <textarea
                className={`${inputCls} flex-1 min-h-[60px]`}
                value={d}
                onChange={e => {
                  const next = [...state.descriptions]
                  next[i] = e.target.value.slice(0, 90)
                  update({ descriptions: next })
                }}
                placeholder={`${t('assetGroup.descriptionPlaceholder')} (max 90)`}
                maxLength={90}
                rows={2}
              />
              <button
                type="button"
                onClick={() => removeDescription(i)}
                disabled={state.descriptions.length <= 2}
                className="px-2 text-gray-500 hover:text-red-600 disabled:opacity-40 shrink-0 self-start"
              >
                ×
              </button>
            </div>
          ))}
          {state.descriptions.length < 5 && (
            <button type="button" onClick={addDescription} className="text-sm text-blue-600 hover:underline">
              + {t('assetGroup.addDescription')}
            </button>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-2">
          <Image className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-semibold text-gray-900">{t('assetGroup.imagesTitle')}</h4>
        </div>
        <p className="text-xs text-gray-500 mb-2">{t('assetGroup.imagesHint')}</p>
        <Field label={t('assetGroup.marketingImageUrl')} required>
          <input
            className={inputCls}
            value={state.images[0]?.url ?? ''}
            onChange={e => {
              const next = [...state.images]
              if (next[0]) next[0] = { ...next[0], url: e.target.value.trim(), id: next[0].id }
              else next.push({ id: `img-${Date.now()}`, url: e.target.value.trim() })
              update({ images: next })
            }}
            placeholder="https://example.com/image.jpg"
          />
        </Field>
        <Field label={t('assetGroup.logoUrl')} required>
          <input
            className={inputCls}
            value={state.logos[0]?.url ?? ''}
            onChange={e => {
              const next = [...state.logos]
              if (next[0]) next[0] = { ...next[0], url: e.target.value.trim(), id: next[0].id }
              else next.push({ id: `logo-${Date.now()}`, url: e.target.value.trim() })
              update({ logos: next })
            }}
            placeholder="https://example.com/logo.png"
          />
        </Field>
      </section>

      <section className="pt-4 border-t border-gray-200">
        <div className="flex items-start gap-2 p-4 rounded-lg bg-blue-50 border border-blue-200 mb-4">
          <Radio className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-900">{t('signals.title')}</h4>
            <p className="text-sm text-blue-800 mt-1">{t('signals.description')}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-900">{t('signals.audienceTitle')}</h4>
          <span className="text-sm text-gray-600">{t('signals.audienceCount', { count: state.selectedAudienceSegments.length })}</span>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200 mb-4">
          <Users className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600">{t('signals.audienceNote')}</p>
        </div>

        <h4 className="text-sm font-semibold text-gray-900 mb-2">{t('signals.searchThemesTitle')}</h4>
        <p className="text-xs text-gray-500 mb-3">{t('signals.searchThemesHint')}</p>
        <div className="flex gap-2 flex-wrap items-center">
          {state.searchThemes
            .map((st, i) => ({ st, i }))
            .filter(({ st }) => st.text.trim())
            .map(({ st, i }) => (
              <span
                key={`${st.text}-${i}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 text-sm border border-blue-200"
              >
                {st.text.trim()}
                <button
                  type="button"
                  onClick={() => removeSearchTheme(i)}
                  className="hover:text-red-600 p-0.5 rounded-full hover:bg-blue-100"
                  aria-label={t('signals.removeTheme')}
                >
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
              disabled={!searchThemeInput.trim()}
              className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
            >
              {t('signals.addSearchTheme')}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">{t('signals.searchThemeEnterHint')}</p>
      </section>
    </div>
  )
}
