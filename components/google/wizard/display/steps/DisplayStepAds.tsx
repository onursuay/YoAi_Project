'use client'

import type { StepProps } from '../../shared/WizardTypes'
import { inputCls } from '../../shared/WizardTypes'

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

export default function DisplayStepAds({ state, update, t }: StepProps) {
  return (
    <div className="space-y-5">
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

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        {t('display.adsInfoNote')}
      </div>
    </div>
  )
}
