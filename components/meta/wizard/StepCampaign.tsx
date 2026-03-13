'use client'

import { useState } from 'react'
import type { WizardState } from './types'
import { getWizardTranslations, getLocaleFromCookie, getObjectiveInfoTranslations } from '@/lib/i18n/wizardTranslations'
import { getAllowedBuyingTypes } from '@/lib/meta/spec/objectiveSpec'
import BudgetOptimizationCard from '../BudgetOptimizationCard'

interface StepCampaignProps {
  state: WizardState['campaign']
  onChange: (updates: Partial<WizardState['campaign']>) => void
  errors?: Record<string, string>
  /** Pre-computed min-budget inline error from CampaignWizard (null = no error) */
  minBudgetError?: string | null
}

export default function StepCampaign({ state, onChange, errors = {}, minBudgetError }: StepCampaignProps) {
  const locale = getLocaleFromCookie()
  const t = getWizardTranslations(locale)
  const oi = getObjectiveInfoTranslations(locale)
  const [buyingTypeOpen, setBuyingTypeOpen] = useState(false)

  const OBJECTIVES = [
    { value: 'OUTCOME_AWARENESS', label: t.OUTCOME_AWARENESS },
    { value: 'OUTCOME_TRAFFIC', label: t.OUTCOME_TRAFFIC },
    { value: 'OUTCOME_ENGAGEMENT', label: t.OUTCOME_ENGAGEMENT },
    { value: 'OUTCOME_LEADS', label: t.OUTCOME_LEADS },
    { value: 'OUTCOME_APP_PROMOTION', label: t.OUTCOME_APP_PROMOTION },
    { value: 'OUTCOME_SALES', label: t.OUTCOME_SALES },
  ]

  const SPECIAL_CATEGORIES = [
    { value: 'HOUSING', label: t.HOUSING },
    { value: 'EMPLOYMENT', label: t.EMPLOYMENT },
    { value: 'CREDIT', label: t.CREDIT },
    { value: 'SOCIAL_ISSUES_ELECTIONS_POLITICS', label: t.SOCIAL_ISSUES_ELECTIONS_POLITICS },
  ]

  const toggleSpecialCategory = (value: string) => {
    const next = state.specialAdCategories.includes(value)
      ? state.specialAdCategories.filter((c) => c !== value)
      : [...state.specialAdCategories, value]
    onChange({ specialAdCategories: next })
  }

  return (
    <div className="space-y-4">
      <div className="light-sweep-wrapper rounded-md w-fit">
        <h3 className="text-lg font-semibold text-gray-900">{t.campaignInfo}</h3>
      </div>

      {getAllowedBuyingTypes(state.objective).length > 1 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t.buyingTypeLabel}
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="buyingType"
                value="AUCTION"
                checked={(state.buyingType ?? 'AUCTION') === 'AUCTION'}
                onChange={() => onChange({ buyingType: 'AUCTION' })}
                className="text-primary focus:ring-primary"
              />
              <span className="text-sm">{t.buyingTypeAuction}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="buyingType"
                value="REACH_AND_FREQUENCY"
                checked={state.buyingType === 'REACH_AND_FREQUENCY'}
                onChange={() => onChange({ buyingType: 'REACH_AND_FREQUENCY' })}
                className="text-primary focus:ring-primary"
              />
              <span className="text-sm">{t.buyingTypeRF}</span>
            </label>
          </div>
          {state.buyingType === 'REACH_AND_FREQUENCY' && (
            <div className="mt-2 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
              {t.buyingTypeRFNote}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {t.campaignName} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={state.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t.campaignNamePlaceholder}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          maxLength={256}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {t.campaignObjective} <span className="text-red-500">*</span>
        </label>
        <select
          value={state.objective}
          onChange={(e) => onChange({ objective: e.target.value })}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
        >
          {OBJECTIVES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>


      {/* App Promotion (Uygulama Tanıtımı): Uygulama ID + Mağaza linki — Step 1'de zorunlu */}
      {state.objective === 'OUTCOME_APP_PROMOTION' && (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Uygulama <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={state.appId ?? ''}
              onChange={(e) => onChange({ appId: e.target.value || undefined })}
              placeholder="Facebook App ID (örn. 123456789)"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
            {errors.app_id && <p className="mt-1 text-sm text-red-600">{errors.app_id}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Mağaza Linki <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={state.appStoreUrl ?? ''}
              onChange={(e) => onChange({ appStoreUrl: e.target.value || undefined })}
              placeholder="https://play.google.com/store/apps/details?id=com.example.app"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
            {errors.app_store_url && <p className="mt-1 text-sm text-red-600">{errors.app_store_url}</p>}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="advantage-plus-app"
              checked={state.advantagePlusApp !== false}
              onChange={(e) => onChange({ advantagePlusApp: e.target.checked })}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="advantage-plus-app" className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-gray-700">Advantage+ Uygulama Kampanyası</span>
              <span className="text-caption text-gray-500">Meta, hedeflemeyi ve yerleşimleri otomatik optimize eder</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ios14-campaign"
              checked={state.ios14Campaign === true}
              onChange={(e) => onChange({ ios14Campaign: e.target.checked })}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="ios14-campaign" className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-gray-700">iOS 14+ kampanyası</span>
              <span className="text-caption text-gray-500">Apple'ın App Tracking Transparency (ATT) kısıtlamalarına uyumlu kampanya. iOS uygulamaları için zorunlu olabilir.</span>
            </label>
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t.specialAdCategory}
        </label>
        <div className="flex flex-wrap gap-2">
          {SPECIAL_CATEGORIES.map((c) => (
            <label
              key={c.value}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
            >
              <input
                type="checkbox"
                checked={state.specialAdCategories.includes(c.value)}
                onChange={() => toggleSpecialCategory(c.value)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm">{c.label}</span>
            </label>
          ))}
        </div>
      </div>


      {state.objective !== 'OUTCOME_APP_PROMOTION' && (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t.budgetOptimizationLabel}
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="budgetOptimization"
              checked={state.budgetOptimization === 'adset'}
              onChange={() => onChange({ budgetOptimization: 'adset' })}
              className="text-primary focus:ring-primary"
            />
            <span className="text-sm">{t.adsetBudget}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="budgetOptimization"
              checked={state.budgetOptimization === 'campaign'}
              onChange={() => onChange({ budgetOptimization: 'campaign' })}
              className="text-primary focus:ring-primary"
            />
            <span className="text-sm">{t.advantageCampaignBudget}</span>
          </label>
        </div>

        {state.budgetOptimization === 'campaign' && (
          <div className="mt-3">
            <BudgetOptimizationCard
              enabled={true}
              onEnabledChange={(v) => onChange({ budgetOptimization: v ? 'campaign' : 'adset' })}
              title={t.advantageCampaignBudget}
              description={t.budgetOptimizationCardDesc}
              strategyOptions={[
                { value: 'MAX_VOLUME', label: t.campaignStrategyMaxVolume },
                { value: 'BID_CAP', label: t.campaignStrategyBidCap },
                { value: 'COST_CAP', label: t.campaignStrategyCostCap },
              ]}
              bidStrategyValue={state.campaignBidStrategy ?? 'MAX_VOLUME'}
              onBidStrategyChange={(v) => onChange({ campaignBidStrategy: v })}
              budgetTypeOptions={[
                { value: 'daily', label: t.dailyBudget },
                { value: 'lifetime', label: t.lifetimeBudget },
              ]}
              budgetTypeValue={state.campaignBudgetType ?? 'daily'}
              onBudgetTypeChange={(v) => onChange({ campaignBudgetType: v as 'daily' | 'lifetime' })}
              amountValue={state.campaignBudget ?? ''}
              onAmountChange={(v) => onChange({ campaignBudget: v === '' ? undefined : v })}
              currencyLabel="TRY"
              errorText={minBudgetError ?? undefined}
              amountPlaceholder={t.campaignBudgetPlaceholder}
              campaignBudgetLabel={`${t.campaignBudgetLabel} *`}
            />
          </div>
        )}
      </div>
      )}

      {/* Objective Info Card */}
      {(() => {
        const info = oi.objectives[state.objective as keyof typeof oi.objectives]
        if (!info) return null
        return (
          <div
            className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
            style={{ display: 'grid', gridTemplateColumns: '220px 1fr', alignItems: 'stretch', columnGap: '0' }}
          >
            {/* Sol: görsel */}
            {info.image ? (
              <div className="bg-gray-50/60" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '8px' }}>
                <img
                  src={info.image}
                  alt={info.title}
                  style={{ width: '100%', height: 'auto', objectFit: 'contain', maxHeight: '180px' }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '16px' }}>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={info.icon} />
                  </svg>
                </div>
              </div>
            )}
            {/* Sağ: metin */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignSelf: 'stretch', padding: '20px 24px', textAlign: 'left', width: '100%' }}>
              <p className="text-base font-bold text-gray-900 mb-2">{info.title}</p>
              <p className="text-sm text-gray-600 mb-3">{info.description}</p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{oi.suitableFor}</p>
                <ul className="space-y-1">
                  {info.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                      <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
