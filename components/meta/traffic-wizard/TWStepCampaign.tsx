'use client'

import { useState } from 'react'
import { Globe, Lock, Wallet, Shield, ChevronDown, ChevronRight, Settings, Sparkles } from 'lucide-react'
import { getTrafficI18n } from './i18n'
import type { TrafficWizardState } from './types'

interface TWStepCampaignProps {
  state: TrafficWizardState
  onChange: (updates: Partial<TrafficWizardState>) => void
}

const SPECIAL_AD_CATEGORIES = [
  { value: 'CREDIT', labelKey: 'categoryCredit' as const, descKey: 'categoryCreditDesc' as const },
  { value: 'EMPLOYMENT', labelKey: 'categoryEmployment' as const, descKey: 'categoryEmploymentDesc' as const },
  { value: 'HOUSING', labelKey: 'categoryHousing' as const, descKey: 'categoryHousingDesc' as const },
  { value: 'ISSUES_ELECTIONS_POLITICS', labelKey: 'categorySocialIssues' as const, descKey: 'categorySocialIssuesDesc' as const },
]

const BID_STRATEGIES = [
  { value: 'MAX_VOLUME', labelKey: 'cboBidStrategyMaxVolume' as const },
  { value: 'BID_CAP', labelKey: 'cboBidStrategyBidCap' as const },
  { value: 'COST_CAP', labelKey: 'cboBidStrategyCostCap' as const },
]

export default function TWStepCampaign({ state, onChange }: TWStepCampaignProps) {
  const t = getTrafficI18n()
  const c = state.campaign
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const updateCampaign = (updates: Partial<TrafficWizardState['campaign']>) => {
    onChange({ campaign: { ...c, ...updates } })
  }

  const toggleCategory = (cat: string) => {
    const next = c.specialAdCategories.includes(cat)
      ? c.specialAdCategories.filter(v => v !== cat)
      : [...c.specialAdCategories, cat]
    updateCampaign({ specialAdCategories: next })
  }

  const nameEmpty = c.name.trim().length === 0

  return (
    <div className="space-y-8">

      {/* ═══════════════════════════════════════════════
          SECTION 1: Campaign Identity
          ═══════════════════════════════════════════════ */}
      <Section
        icon={<Globe className="w-[18px] h-[18px]" />}
        title={t.sectionCampaignIdentity}
        description={t.sectionCampaignIdentityDesc}
      >
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1.5">
            {t.campaignName} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={c.name}
            onChange={(e) => updateCampaign({ name: e.target.value })}
            placeholder={t.campaignNamePlaceholder}
            maxLength={256}
            className={`w-full px-4 py-3 border rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
              nameEmpty ? 'border-gray-300' : 'border-primary bg-primary/[0.02]'
            }`}
          />
          {nameEmpty && (
            <p className="mt-1.5 text-xs text-gray-400">{t.campaignNameRequired}</p>
          )}
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════
          SECTION 2: Campaign Objective (locked Traffic)
          ═══════════════════════════════════════════════ */}
      <Section
        icon={<Lock className="w-[18px] h-[18px]" />}
        title={t.sectionObjective}
        description={t.sectionObjectiveDesc}
      >
        <div className="flex items-center gap-4 p-4 bg-primary/[0.04] border border-primary/20 rounded-xl">
          {/* Objective icon */}
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{t.trafficObjective}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-[11px] font-semibold uppercase tracking-wide">
                <Lock className="w-3 h-3" />
                {t.objectiveLocked}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{t.trafficObjectiveDesc}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">{t.objectiveLockedDesc}</p>
      </Section>

      {/* ═══════════════════════════════════════════════
          SECTION 3: Budget Strategy (ABO / CBO)
          ═══════════════════════════════════════════════ */}
      <Section
        icon={<Wallet className="w-[18px] h-[18px]" />}
        title={t.sectionBudgetStrategy}
        description={t.sectionBudgetStrategyDesc}
      >
        <div className="space-y-3">
          {/* ABO Card */}
          <BudgetOptionCard
            selected={c.budgetOptimization === 'adset'}
            onClick={() => updateCampaign({ budgetOptimization: 'adset' })}
            title={t.aboLabel}
            description={t.aboDesc}
            badge={t.aboRecommended}
            badgeColor="blue"
          />

          {/* CBO Card */}
          <BudgetOptionCard
            selected={c.budgetOptimization === 'campaign'}
            onClick={() => updateCampaign({ budgetOptimization: 'campaign' })}
            title={t.cboLabel}
            description={t.cboDesc}
            badge={t.cboAdvantage}
            badgeColor="green"
            badgeIcon={<Sparkles className="w-3 h-3" />}
          />

          {/* CBO Expanded Fields */}
          {c.budgetOptimization === 'campaign' && (
            <div className="ml-1 mt-1 space-y-4 p-5 bg-gray-50/80 border border-gray-200 rounded-xl">
              {/* Bid strategy */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  {t.cboBidStrategy}
                </label>
                <select
                  value={c.campaignBidStrategy ?? 'MAX_VOLUME'}
                  onChange={(e) => updateCampaign({ campaignBidStrategy: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {BID_STRATEGIES.map(({ value, labelKey }) => (
                    <option key={value} value={value}>{t[labelKey]}</option>
                  ))}
                </select>
              </div>
              {/* Budget type + amount row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    {t.cboBudgetType}
                  </label>
                  <select
                    value={c.campaignBudgetType ?? 'daily'}
                    onChange={(e) => updateCampaign({ campaignBudgetType: e.target.value as 'daily' | 'lifetime' })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="daily">{t.cboBudgetDaily}</option>
                    <option value="lifetime">{t.cboBudgetLifetime}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    {t.cboBudgetAmount}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      value={c.campaignBudget ?? ''}
                      onChange={(e) => updateCampaign({ campaignBudget: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 pr-14 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                      {t.cboCurrency}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════
          SECTION 4: Special Ad Categories
          ═══════════════════════════════════════════════ */}
      <Section
        icon={<Shield className="w-[18px] h-[18px]" />}
        title={t.sectionSpecialCategories}
        description={t.sectionSpecialCategoriesDesc}
      >
        <div className="space-y-2">
          {SPECIAL_AD_CATEGORIES.map(({ value, labelKey, descKey }) => {
            const checked = c.specialAdCategories.includes(value)
            return (
              <label
                key={value}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  checked
                    ? 'border-primary/30 bg-primary/[0.04]'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCategory(value)}
                  className="mt-0.5 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary/20"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">{t[labelKey]}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{t[descKey]}</p>
                </div>
              </label>
            )
          })}
        </div>
        {c.specialAdCategories.length === 0 && (
          <p className="text-xs text-gray-400 mt-2">{t.specialAdCategoriesNone}</p>
        )}
      </Section>

      {/* ═══════════════════════════════════════════════
          SECTION 5: Advanced Settings (collapsible)
          ═══════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-gray-50/50 transition-colors"
        >
          <span className="text-gray-400">
            <Settings className="w-[18px] h-[18px]" />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-700">{t.sectionAdvancedSettings}</h3>
            <p className="text-xs text-gray-400">{t.sectionAdvancedSettingsDesc}</p>
          </div>
          {advancedOpen
            ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
            : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          }
        </button>
        {advancedOpen && (
          <div className="px-6 pb-5 border-t border-gray-100">
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <p className="text-sm text-gray-400 italic">{t.advancedComingSoon}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Reusable sub-components ── */

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start gap-3 mb-5">
        <span className="mt-0.5 text-gray-400">{icon}</span>
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function BudgetOptionCard({
  selected,
  onClick,
  title,
  description,
  badge,
  badgeColor,
  badgeIcon,
}: {
  selected: boolean
  onClick: () => void
  title: string
  description: string
  badge: string
  badgeColor: 'blue' | 'green'
  badgeIcon?: React.ReactNode
}) {
  const badgeColors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        selected
          ? 'border-primary bg-primary/[0.03] shadow-sm'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Radio circle */}
        <div className="mt-0.5 shrink-0">
          <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${
            selected ? 'border-primary' : 'border-gray-300'
          }`}>
            {selected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{title}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${badgeColors[badgeColor]}`}>
              {badgeIcon}
              {badge}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  )
}
