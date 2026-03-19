'use client'

import { useEffect, useState } from 'react'
import { Globe as GlobeIcon, Info } from 'lucide-react'
import type { PMaxStepProps } from '../shared/PMaxWizardTypes'
import { inputCls } from '../shared/PMaxWizardTypes'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

/**
 * GİRİŞ EKRANI — Google PMax parity.
 * Dönüşüm hedefleri, ürün (placeholder), kampanya adı, final URL.
 */
export default function PMaxStepEntry({ state, update, t }: PMaxStepProps) {
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (state.conversionActions.length > 0) return
    setLoading(true)
    fetch('/api/integrations/google-ads/conversion-actions')
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data.conversionActions) {
          update({ conversionActions: data.conversionActions })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => { cancelled = true }
  }, [update])

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center gap-2 mb-2">
          <GlobeIcon className="w-4 h-4 text-blue-600" />
          <h4 className="text-[15px] font-semibold text-gray-900">{t('conversion.title')}</h4>
        </div>
        <p className="text-[13px] text-gray-500 mb-3">{t('conversion.description')}</p>
        {loading ? (
          <p className="text-[13px] text-gray-500">{t('conversion.loading')}</p>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
            {(state.conversionActions || []).slice(0, 10).map(ca => {
              const selected = state.selectedConversionGoalIds.includes(ca.resourceName)
              return (
                <label
                  key={ca.resourceName}
                  className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => {
                      const ids = selected
                        ? state.selectedConversionGoalIds.filter(id => id !== ca.resourceName)
                        : [...state.selectedConversionGoalIds, ca.resourceName]
                      update({
                        selectedConversionGoalIds: ids,
                        primaryConversionGoalId:
                          state.primaryConversionGoalId === ca.resourceName ? null : state.primaryConversionGoalId,
                      })
                    }}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm">{ca.name}</span>
                  {state.primaryConversionGoalId === ca.resourceName && (
                    <span className="text-xs text-blue-600">({t('conversion.primary')})</span>
                  )}
                </label>
              )
            })}
            {(!state.conversionActions || state.conversionActions.length === 0) && (
              <p className="text-[13px] text-gray-500">{t('conversion.empty')}</p>
            )}
          </div>
        )}
        <div className="flex items-start gap-2 mt-2 p-2 rounded bg-gray-50">
          <Info className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
          <p className="text-[12px] text-gray-500">{t('conversion.optionalNote')}</p>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-[15px] font-semibold text-gray-900">{t('entry.merchantTitle')}</h4>
        </div>
        <p className="text-[12px] text-gray-500 p-3 rounded-lg bg-gray-50 border border-gray-200">
          {t('entry.merchantPlaceholder')}
        </p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">{t('entry.landingTitle')}</h4>
        <Field label={t('conversion.campaignName')} required>
          <input
            className={inputCls}
            value={state.campaignName}
            onChange={e => update({ campaignName: e.target.value })}
            placeholder={t('conversion.namePlaceholder')}
          />
        </Field>
        <Field label={t('conversion.finalUrl')} required>
          <input
            className={`${inputCls} mt-2`}
            value={state.finalUrl}
            onChange={e => update({ finalUrl: e.target.value })}
            placeholder="https://example.com"
          />
        </Field>
      </section>
    </div>
  )
}
