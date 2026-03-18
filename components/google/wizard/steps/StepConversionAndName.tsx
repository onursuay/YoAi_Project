'use client'

import { useEffect, useState } from 'react'
import { Target, Star, Info, AlertCircle, Loader2 } from 'lucide-react'
import type { StepProps } from '../shared/WizardTypes'
import { inputCls } from '../shared/WizardTypes'

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

export default function StepConversionAndName({ state, update, t }: StepProps) {
  const selectedIds = state.selectedConversionGoalIds
  const primaryId = state.primaryConversionGoalId
  const conversionActions = state.conversionActions
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFetchError(null)
    fetch('/api/integrations/google-ads/conversion-actions', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        if (data.error) {
          setFetchError(data.error)
          setLoading(false)
          return
        }
        const actions = data.conversionActions ?? []
        update({ conversionActions: actions })
        setLoading(false)
      })
      .catch(err => {
        if (!cancelled) {
          setFetchError(err.message ?? 'Failed to load')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount; update is stable in practice
  }, [])

  const toggleGoal = (resourceName: string) => {
    const nextSelected = selectedIds.includes(resourceName)
      ? selectedIds.filter(x => x !== resourceName)
      : [...selectedIds, resourceName]
    let nextPrimary = primaryId
    if (selectedIds.includes(resourceName) && primaryId === resourceName) {
      nextPrimary = nextSelected[0] ?? null
    } else if (!selectedIds.includes(resourceName) && nextSelected.includes(resourceName)) {
      nextPrimary = nextSelected.length === 1 ? resourceName : primaryId
    }
    update({
      selectedConversionGoalIds: nextSelected,
      primaryConversionGoalId: nextPrimary,
    })
  }

  const setPrimary = (resourceName: string) => {
    if (selectedIds.includes(resourceName)) {
      update({ primaryConversionGoalId: resourceName })
    }
  }

  const primaryAction = conversionActions.find(a => a.resourceName === primaryId)

  return (
    <div className="space-y-5">
      <Field label={t('campaign.name')} required>
        <input
          className={inputCls}
          value={state.campaignName}
          onChange={e => update({ campaignName: e.target.value })}
          placeholder={t('campaign.namePlaceholder')}
        />
      </Field>

      {/* Conversion goals — real data from Google Ads API */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-blue-600" />
          <label className="text-[15px] font-semibold text-gray-900">
            {t('conversion.title')}
          </label>
        </div>
        <p className="text-[13px] text-gray-500 mb-3">
          {t('conversion.description')}
        </p>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            {t('conversion.loading')}
          </div>
        )}

        {fetchError && !loading && (
          <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{t('conversion.error')} {fetchError}</span>
          </div>
        )}

        {!loading && !fetchError && conversionActions.length === 0 && (
          <div className="flex items-start gap-2 p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{t('conversion.empty')}</span>
          </div>
        )}

        {!loading && !fetchError && conversionActions.length > 0 && (
          <>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-600 border-b border-gray-200">
                <span className="w-8" />
                <span>{t('conversion.conversionAction')}</span>
                <span>{t('conversion.category')}</span>
                <span className="text-right w-20">{t('conversion.primary')}</span>
              </div>
              <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {conversionActions.map(goal => {
                  const isSelected = selectedIds.includes(goal.resourceName)
                  const isPrimary = primaryId === goal.resourceName
                  return (
                    <div
                      key={goal.resourceName}
                      className={`grid grid-cols-[auto_1fr_1fr_auto] gap-3 items-center px-4 py-2.5 text-sm hover:bg-gray-50/80 ${
                        isSelected ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleGoal(goal.resourceName)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                      </label>
                      <span className="font-medium text-gray-900">{goal.name}</span>
                      <span className="text-gray-600">{goal.category}</span>
                      <div className="flex justify-end">
                        {isSelected ? (
                          <button
                            type="button"
                            onClick={() => setPrimary(goal.resourceName)}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                              isPrimary
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                            }`}
                            title={isPrimary ? t('conversion.primaryGoalTitle') : t('conversion.setAsPrimaryTitle')}
                          >
                            <Star className={`w-3 h-3 ${isPrimary ? 'fill-amber-500 text-amber-500' : ''}`} />
                            {isPrimary ? t('conversion.primary') : t('conversion.set')}
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {selectedIds.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                {t('conversion.goalsSelected', { count: selectedIds.length })}
                {primaryAction && (
                  <> · {t('conversion.primaryLabel')} <strong>{primaryAction.name}</strong></>
                )}
              </p>
            )}
          </>
        )}

        {!loading && !fetchError && conversionActions.length > 0 && t('conversion.uiOnlyNote') && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700/90">
            <Info className="w-3.5 h-3.5 shrink-0" />
            {t('conversion.uiOnlyNote')}
          </p>
        )}
      </div>
    </div>
  )
}
