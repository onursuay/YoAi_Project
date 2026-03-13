'use client'

import type { StepProps } from '../shared/WizardTypes'
import { inputCls } from '../shared/WizardTypes'

export default function StepAdCreation({ state, update, t }: StepProps) {
  return (
    <div className="space-y-4">
      <Field label={t('ad.finalUrl')} required>
        <input className={inputCls} type="url" value={state.finalUrl} onChange={e => update({ finalUrl: e.target.value })} placeholder={t('ad.finalUrlPlaceholder')} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('ad.path1')}>
          <input className={inputCls} maxLength={15} value={state.path1} onChange={e => update({ path1: e.target.value })} placeholder={t('ad.path1Placeholder')} />
        </Field>
        <Field label={t('ad.path2')}>
          <input className={inputCls} maxLength={15} value={state.path2} onChange={e => update({ path2: e.target.value })} placeholder={t('ad.path2Placeholder')} />
        </Field>
      </div>

      {/* Headlines */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('ad.headlines')} <span className="text-red-500">*</span>
          <span className="text-gray-400 font-normal ml-1">({t('ad.headlinesNote')})</span>
        </label>
        <div className="space-y-2">
          {state.headlines.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-4">{i + 1}</span>
              <input
                className={`${inputCls} flex-1`}
                maxLength={30}
                value={h}
                onChange={e => {
                  const hs = [...state.headlines]
                  hs[i] = e.target.value
                  if (i === hs.length - 1 && e.target.value && hs.length < 15) hs.push('')
                  update({ headlines: hs })
                }}
                placeholder={i < 3 ? t('ad.headlineRequired', { n: i + 1 }) : t('ad.headlineOptional', { n: i + 1 })}
              />
              <span className="text-xs text-gray-400 w-8 text-right">{h.length}/30</span>
            </div>
          ))}
        </div>
      </div>

      {/* Descriptions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('ad.descriptions')} <span className="text-red-500">*</span>
          <span className="text-gray-400 font-normal ml-1">({t('ad.descriptionsNote')})</span>
        </label>
        <div className="space-y-2">
          {state.descriptions.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-4">{i + 1}</span>
              <input
                className={`${inputCls} flex-1`}
                maxLength={90}
                value={d}
                onChange={e => {
                  const ds = [...state.descriptions]
                  ds[i] = e.target.value
                  if (i === ds.length - 1 && e.target.value && ds.length < 4) ds.push('')
                  update({ descriptions: ds })
                }}
                placeholder={i < 2 ? t('ad.descriptionRequired', { n: i + 1 }) : t('ad.descriptionOptional', { n: i + 1 })}
              />
              <span className="text-xs text-gray-400 w-8 text-right">{d.length}/90</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

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
