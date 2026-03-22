'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Info,
  Target,
  Star,
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
import { useLocale } from 'next-intl'
import type { StepProps, BiddingStrategy } from '../shared/WizardTypes'
import type { ConversionActionForWizard } from '../shared/WizardTypes'
import { inputCls, CAMPAIGN_TYPE_BIDDING } from '../shared/WizardTypes'
import { getBudgetRecommendation } from '../shared/WizardValidation'

const BIDDING_LABELS: Record<BiddingStrategy, string> = {
  MAXIMIZE_CLICKS: 'Tıklama Sayısını Artır',
  MAXIMIZE_CONVERSIONS: 'Dönüşümleri Artır',
  TARGET_CPA: 'Hedef EBM (CPA)',
  TARGET_ROAS: 'Hedef ROAS',
  MANUAL_CPC: 'Manuel TBM (CPC)',
  TARGET_IMPRESSION_SHARE: 'Hedef Gösterim Payı',
}

const EU_POLICY_URL = 'https://support.google.com/adspolicy/answer/6014595'

function formatUnknownValue(value: string): string {
  if (!value || value === 'UNKNOWN') return ''
  return value.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

function getCategoryIcon(category: string): LucideIcon {
  switch (category) {
    case 'PURCHASE': case 'STORE_SALE': return ShoppingCart
    case 'PAGE_VIEW': return FileText
    case 'PHONE_CALL_LEAD': return Phone
    case 'LEAD': case 'IMPORTED_LEAD': case 'QUALIFIED_LEAD': case 'CONVERTED_LEAD': case 'SUBMIT_LEAD_FORM': return Target
    case 'ADD_TO_CART': case 'BEGIN_CHECKOUT': return CreditCard
    case 'DOWNLOAD': return Download
    case 'OUTBOUND_CLICK': case 'CONTACT': return MousePointer
    case 'GET_DIRECTIONS': case 'STORE_VISIT': return MapPin
    case 'ENGAGEMENT': case 'BOOK_APPOINTMENT': case 'REQUEST_QUOTE': return Mail
    case 'SIGNUP': case 'SUBSCRIBE_PAID': return BarChart2
    default: return Globe
  }
}

export default function StepCampaignSettings({ state, update, t }: StepProps) {
  const budgetNum = parseFloat(state.dailyBudget) || 0
  const recommended = getBudgetRecommendation(state.biddingStrategy)
  const showBudgetWarning = budgetNum > 0 && budgetNum < recommended
  const locale = useLocale()
  const euPolicyUrl = `${EU_POLICY_URL}?hl=${locale === 'tr' ? 'tr' : 'en'}`
  const availableBidding = CAMPAIGN_TYPE_BIDDING[state.campaignType] ?? ['MAXIMIZE_CLICKS']
  const isSearch = state.campaignType === 'SEARCH'

  const [convLoading, setConvLoading] = useState(false)
  const [convError, setConvError] = useState<string | null>(null)
  const selectedIds = state.selectedConversionGoalIds
  const primaryId = state.primaryConversionGoalId
  const conversionActions = state.conversionActions

  useEffect(() => {
    if (conversionActions.length > 0) return
    let cancelled = false
    setConvLoading(true)
    setConvError(null)
    fetch('/api/integrations/google-ads/conversion-actions', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        if (data.error) { setConvError(data.error); setConvLoading(false); return }
        update({ conversionActions: data.conversionActions ?? [] })
        setConvLoading(false)
      })
      .catch(err => { if (!cancelled) { setConvError(err.message ?? 'Failed to load'); setConvLoading(false) } })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleGoal = (resourceName: string) => {
    const nextSelected = selectedIds.includes(resourceName)
      ? selectedIds.filter(x => x !== resourceName)
      : [...selectedIds, resourceName]
    let nextPrimary = primaryId
    if (selectedIds.includes(resourceName) && primaryId === resourceName) nextPrimary = nextSelected[0] ?? null
    else if (!selectedIds.includes(resourceName) && nextSelected.length === 1) nextPrimary = resourceName
    update({ selectedConversionGoalIds: nextSelected, primaryConversionGoalId: nextPrimary })
  }

  const setPrimary = (resourceName: string) => {
    if (selectedIds.includes(resourceName)) update({ primaryConversionGoalId: resourceName })
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

  const primaryAction = conversionActions.find((a: ConversionActionForWizard) => a.resourceName === primaryId)

  return (
    <div className="space-y-4">
      <Field label={t('campaign.name')} required>
        <input className={inputCls} value={state.campaignName} onChange={e => update({ campaignName: e.target.value })} placeholder={t('campaign.namePlaceholder')} />
      </Field>

      <Field label={t('campaign.dailyBudget')} required>
        <input className={inputCls} type="number" min="1" step="1" value={state.dailyBudget} onChange={e => update({ dailyBudget: e.target.value })} placeholder={t('campaign.dailyBudgetPlaceholder')} />
      </Field>

      {showBudgetWarning && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Google bu strateji için minimum <strong>{recommended} TRY/gün</strong> önermektedir.</span>
        </div>
      )}

      <Field label={t('campaign.biddingStrategy')} required>
        <select className={inputCls} value={state.biddingStrategy} onChange={e => update({ biddingStrategy: e.target.value as BiddingStrategy })}>
          {availableBidding.map(bs => (<option key={bs} value={bs}>{BIDDING_LABELS[bs] ?? bs}</option>))}
        </select>
      </Field>

      {state.biddingStrategy === 'TARGET_CPA' && (
        <Field label={t('campaign.targetCpa')} required>
          <input className={inputCls} type="number" min="0" step="0.01" value={state.targetCpa} onChange={e => update({ targetCpa: e.target.value })} placeholder={t('campaign.targetCpaPlaceholder')} />
        </Field>
      )}
      {state.biddingStrategy === 'TARGET_ROAS' && (
        <Field label={t('campaign.targetRoas')} required>
          <input className={inputCls} type="number" min="0" step="0.01" value={state.targetRoas} onChange={e => update({ targetRoas: e.target.value })} placeholder={t('campaign.targetRoasPlaceholder')} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('campaign.startDate')}>
          <input className={inputCls} type="date" value={state.startDate} onChange={e => update({ startDate: e.target.value })} />
        </Field>
        <Field label={t('campaign.endDate')}>
          <input className={inputCls} type="date" value={state.endDate} onChange={e => update({ endDate: e.target.value })} />
        </Field>
      </div>

      {/* Network Settings — only shown for SEARCH campaigns */}
      {isSearch && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Ağ Ayarları</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked disabled className="rounded border-gray-300" />
              <span className="text-gray-500">Google Arama <span className="text-xs text-gray-400">(her zaman aktif)</span></span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={state.networkSettings.targetSearchNetwork} onChange={e => update({ networkSettings: { ...state.networkSettings, targetSearchNetwork: e.target.checked } })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-gray-700">Arama Ağı Ortakları</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={state.networkSettings.targetContentNetwork} onChange={e => update({ networkSettings: { ...state.networkSettings, targetContentNetwork: e.target.checked } })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-gray-700">Görüntülü Reklam Ağı</span>
            </label>
          </div>
        </div>
      )}

      {/* Dönüşüm Hedefleri */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-blue-600" />
          <label className="text-[15px] font-semibold text-gray-900">{t('conversion.title')}</label>
        </div>
        <p className="text-[13px] text-gray-500 mb-3">{t('conversion.description')}</p>

        {convLoading && (
          <div className="flex items-center gap-2 py-8 text-[13px] text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            {t('conversion.loading')}
          </div>
        )}
        {convError && !convLoading && (
          <div className="flex items-start gap-2 p-3 rounded border border-red-200 bg-red-50/50 text-[13px] text-red-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{t('conversion.error')} {convError}</span>
          </div>
        )}
        {!convLoading && !convError && conversionActions.length === 0 && (
          <div className="flex items-start gap-2 p-3 rounded border border-amber-200 bg-amber-50/50 text-[13px] text-amber-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{t('conversion.empty')}</span>
          </div>
        )}
        {!convLoading && !convError && conversionActions.length > 0 && (
          <>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {conversionActions.map((goal: ConversionActionForWizard) => {
                const isSelected = selectedIds.includes(goal.resourceName)
                const isPrimary = primaryId === goal.resourceName
                const CategoryIcon = getCategoryIcon(goal.category)
                const isEnabled = goal.status === 'ENABLED'
                return (
                  <label key={goal.resourceName} className={`flex items-center gap-2.5 py-2 px-2.5 rounded border cursor-pointer transition-colors ${isSelected ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/30'}`}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleGoal(goal.resourceName)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0" />
                    <div className="flex items-center justify-center w-6 h-6 rounded bg-gray-50 text-gray-500 shrink-0">
                      <CategoryIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium text-gray-900 block">{goal.name}</span>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[13px] text-gray-500">{getCategoryLabel(goal.category)}</span>
                        <span className="text-gray-300 text-[13px]">·</span>
                        <span className="text-[13px] text-gray-500">{getOriginLabel(goal.origin)}</span>
                        {!isEnabled && (<><span className="text-gray-300 text-[13px]">·</span><span className="text-[13px] text-amber-600">{t('conversion.statusUnenabled')}</span></>)}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isSelected ? (
                        <button type="button" onClick={e => { e.preventDefault(); setPrimary(goal.resourceName) }}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[13px] font-medium transition-colors ${isPrimary ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                          title={isPrimary ? t('conversion.primaryGoalTitle') : t('conversion.setAsPrimaryTitle')}>
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
                {primaryAction && (<> · {t('conversion.primaryLabel')} <strong>{primaryAction.name}</strong></>)}
              </p>
            )}
          </>
        )}
      </div>

      {/* AB Siyasi Reklamları */}
      <section className="border border-gray-100 rounded-md bg-white p-4">
        <p className="text-[13px] text-gray-600 mb-3">{t('settings.euPoliticalQuestion')}</p>
        <div className="space-y-1">
          <label className={`flex items-center gap-3 py-2.5 px-3 rounded border cursor-pointer transition-colors ${state.euPoliticalAdsDeclaration === 'NOT_POLITICAL' ? 'border-blue-300 bg-blue-50/50' : 'border-gray-100 hover:border-gray-200 bg-gray-50/30'}`}>
            <input type="radio" name="euPoliticalAdsDeclaration" value="NOT_POLITICAL" checked={state.euPoliticalAdsDeclaration === 'NOT_POLITICAL'} onChange={() => update({ euPoliticalAdsDeclaration: 'NOT_POLITICAL' })} className="text-blue-600 focus:ring-blue-500" />
            <span className="text-[13px] font-medium text-gray-900">{t('settings.euPoliticalNotPolitical')}</span>
          </label>
          {state.euPoliticalAdsDeclaration === 'NOT_POLITICAL' && (
            <p className="text-[12px] text-gray-500 pl-8 mt-0.5 mb-1">{t('settings.euPoliticalHelperNote')} {t('settings.euPoliticalHelperNoteOptional')}</p>
          )}
          <label className={`flex items-center gap-3 py-2.5 px-3 rounded border cursor-pointer transition-colors ${state.euPoliticalAdsDeclaration === 'POLITICAL' ? 'border-blue-300 bg-blue-50/50' : 'border-gray-100 hover:border-gray-200 bg-gray-50/30'}`}>
            <input type="radio" name="euPoliticalAdsDeclaration" value="POLITICAL" checked={state.euPoliticalAdsDeclaration === 'POLITICAL'} onChange={() => update({ euPoliticalAdsDeclaration: 'POLITICAL' })} className="text-blue-600 focus:ring-blue-500" />
            <span className="text-[13px] font-medium text-gray-900">{t('settings.euPoliticalPolitical')}</span>
          </label>
          {state.euPoliticalAdsDeclaration === 'POLITICAL' && (
            <div className="flex items-start gap-2 p-3 mt-1 rounded border border-amber-200 bg-amber-50/60 text-[13px] text-amber-900">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-medium">{t('settings.euPoliticalWarningLine1')}</p>
                <p className="mt-1 text-amber-800">{t('settings.euPoliticalWarningLine2')}</p>
                <a href={euPolicyUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-blue-600 hover:text-blue-700 underline">
                  {t('settings.euPoliticalWarningLearnMore')}
                </a>
              </div>
            </div>
          )}
        </div>
      </section>
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
