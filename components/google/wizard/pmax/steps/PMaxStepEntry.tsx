'use client'

import { useEffect, useState } from 'react'
import {
  Target,
  Star,
  AlertCircle,
  Loader2,
  ShoppingCart,
  FileText,
  Phone,
  Globe,
  Download,
  MousePointer,
  MapPin,
  Mail,
  BarChart2,
  CreditCard,
  type LucideIcon,
} from 'lucide-react'
import type { PMaxStepProps, PMaxConversionAction } from '../shared/PMaxWizardTypes'
import { inputCls } from '../shared/PMaxWizardTypes'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[13px] font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

/** Safe fallback when category/origin has no locale mapping */
function formatUnknownValue(value: string): string {
  if (!value || value === 'UNKNOWN') return ''
  return value
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function getCategoryIcon(category: string): LucideIcon {
  switch (category) {
    case 'PURCHASE':
    case 'STORE_SALE':
      return ShoppingCart
    case 'PAGE_VIEW':
      return FileText
    case 'PHONE_CALL_LEAD':
      return Phone
    case 'LEAD':
    case 'IMPORTED_LEAD':
    case 'QUALIFIED_LEAD':
    case 'CONVERTED_LEAD':
    case 'SUBMIT_LEAD_FORM':
      return Target
    case 'ADD_TO_CART':
    case 'BEGIN_CHECKOUT':
      return CreditCard
    case 'DOWNLOAD':
      return Download
    case 'OUTBOUND_CLICK':
    case 'CONTACT':
      return MousePointer
    case 'GET_DIRECTIONS':
    case 'STORE_VISIT':
      return MapPin
    case 'ENGAGEMENT':
    case 'BOOK_APPOINTMENT':
    case 'REQUEST_QUOTE':
      return Mail
    case 'SIGNUP':
    case 'SUBSCRIBE_PAID':
      return BarChart2
    default:
      return Globe
  }
}

/**
 * GİRİŞ EKRANI — Google PMax parity.
 * Dönüşüm hedefleri, ürün (placeholder), kampanya adı, final URL.
 */
export default function PMaxStepEntry({ state, update, t }: PMaxStepProps) {
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

  const getCategoryLabel = (category: string): string => {
    const key = `conversion.categoryLabels.${category}`
    const translated = t(key)
    if (translated && translated !== key) return translated
    return formatUnknownValue(category) || category
  }

  const getOriginLabel = (origin: string): string => {
    const key = `conversion.originLabels.${origin}`
    const translated = t(key)
    if (translated && translated !== key) return translated
    return formatUnknownValue(origin) || origin
  }

  const primaryAction = conversionActions.find(a => a.resourceName === primaryId)

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-blue-600" />
          <h4 className="text-[15px] font-semibold text-gray-900">{t('conversion.title')}</h4>
        </div>
        <p className="text-[13px] text-gray-500 mb-3">{t('conversion.description')}</p>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-[13px] text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            {t('conversion.loading')}
          </div>
        )}

        {fetchError && !loading && (
          <div className="flex items-start gap-2 p-3 rounded border border-red-200 bg-red-50/50 text-[13px] text-red-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{t('conversion.error')} {fetchError}</span>
          </div>
        )}

        {!loading && !fetchError && conversionActions.length === 0 && (
          <div className="flex items-start gap-2 p-3 rounded border border-amber-200 bg-amber-50/50 text-[13px] text-amber-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{t('conversion.empty')}</span>
          </div>
        )}

        {!loading && !fetchError && conversionActions.length > 0 && (
          <>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {conversionActions.map((goal: PMaxConversionAction) => {
                const isSelected = selectedIds.includes(goal.resourceName)
                const isPrimary = primaryId === goal.resourceName
                const CategoryIcon = getCategoryIcon(goal.category)
                const categoryLabel = getCategoryLabel(goal.category)
                const originLabel = getOriginLabel(goal.origin)
                const isEnabled = goal.status === 'ENABLED'
                return (
                  <label
                    key={goal.resourceName}
                    className={`flex items-center gap-2.5 py-2 px-2.5 rounded border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-blue-200 bg-blue-50/40'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleGoal(goal.resourceName)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0"
                    />
                    <div className="flex items-center justify-center w-6 h-6 rounded bg-gray-50 text-gray-500 shrink-0">
                      <CategoryIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium text-gray-900 block">{goal.name}</span>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[13px] text-gray-500">{categoryLabel}</span>
                        <span className="text-gray-300 text-[13px]">·</span>
                        <span className="text-[13px] text-gray-500">{originLabel}</span>
                        {!isEnabled && (
                          <>
                            <span className="text-gray-300 text-[13px]">·</span>
                            <span className="text-[13px] text-amber-600">
                              {t('conversion.statusUnenabled')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isSelected ? (
                        <button
                          type="button"
                          onClick={e => {
                            e.preventDefault()
                            setPrimary(goal.resourceName)
                          }}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[13px] font-medium transition-colors ${
                            isPrimary
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                          }`}
                          title={isPrimary ? t('conversion.primaryGoalTitle') : t('conversion.setAsPrimaryTitle')}
                        >
                          <Star className={`w-3 h-3 ${isPrimary ? 'fill-amber-500 text-amber-500' : ''}`} />
                          {isPrimary ? t('conversion.primary') : t('conversion.set')}
                        </button>
                      ) : (
                        <span className="text-gray-300 text-[13px]">—</span>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>

            {selectedIds.length > 0 && (
              <p className="mt-2 text-[13px] text-gray-500">
                {t('conversion.goalsSelected', { count: selectedIds.length })}
                {primaryAction && (
                  <> · {t('conversion.primaryLabel')} <strong>{primaryAction.name}</strong></>
                )}
              </p>
            )}
          </>
        )}
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
