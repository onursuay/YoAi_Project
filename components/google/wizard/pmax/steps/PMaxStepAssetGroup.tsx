'use client'

import { Image, Type } from 'lucide-react'
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

export default function PMaxStepAssetGroup({ state, update, t }: PMaxStepProps) {
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
        <div className="flex items-center gap-2 p-4 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
          <Image className="w-8 h-8 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-600">{t('assetGroup.imagesPlaceholder')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('assetGroup.imagesPlaceholderHint')}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
