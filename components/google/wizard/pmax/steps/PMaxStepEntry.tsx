'use client'

import { useEffect, useState } from 'react'
import { ShoppingCart, Users, Globe, Eye, MapPin, Compass, Zap, Globe as GlobeIcon, Info } from 'lucide-react'
import type { PMaxStepProps, PMaxCampaignGoal } from '../shared/PMaxWizardTypes'
import { PMaxGoalsWithPMax, inputCls } from '../shared/PMaxWizardTypes'

const GOAL_ICONS: Record<PMaxCampaignGoal, typeof ShoppingCart> = {
  SALES: ShoppingCart,
  LEADS: Users,
  WEBSITE_TRAFFIC: Globe,
  BRAND_AWARENESS: Eye,
  LOCAL_STORE: MapPin,
  NO_GOAL: Compass,
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

/**
 * GİRİŞ EKRANI — Google PMax parity.
 * Hedef, kampanya türü, dönüşüm hedefleri, ürün (placeholder), final URL.
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

  const handleGoalChange = (goal: PMaxCampaignGoal) => {
    update({ campaignGoal: goal })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">{t('entry.goalQuestion')}</h3>
      </div>

      <section>
        <h4 className="text-sm font-medium text-gray-700 mb-2">{t('goal.selectTitle')}</h4>
        <div className="grid grid-cols-2 gap-3">
          {PMaxGoalsWithPMax.map(id => {
            const active = state.campaignGoal === id
            const Icon = GOAL_ICONS[id]
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleGoalChange(id)}
                className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all ${
                  active
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                } ${id === 'NO_GOAL' ? 'col-span-2' : ''}`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                <div>
                  <p className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-800'}`}>
                    {t(`goal.labels.${id}`)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{t(`goal.descs.${id}`)}</p>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <p className="text-sm font-medium text-gray-700 mb-2">{t('goal.pmaxTypeNote')}</p>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <Zap className="w-5 h-5 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-800">{t('goal.pmaxDescription')}</p>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-2">
          <GlobeIcon className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-semibold text-gray-900">{t('conversion.title')}</h4>
        </div>
        <p className="text-sm text-gray-500 mb-3">{t('conversion.description')}</p>
        {loading ? (
          <p className="text-sm text-gray-500">{t('conversion.loading')}</p>
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
              <p className="text-sm text-gray-500">{t('conversion.empty')}</p>
            )}
          </div>
        )}
        <div className="flex items-start gap-2 mt-2 p-2 rounded bg-gray-50">
          <Info className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600">{t('conversion.optionalNote')}</p>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-sm font-semibold text-gray-900">{t('entry.merchantTitle')}</h4>
        </div>
        <p className="text-xs text-gray-500 p-3 rounded-lg bg-gray-50 border border-gray-200">
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
