'use client'

import { useState, useEffect } from 'react'
import type { WizardState } from './types'
import TabDetails from './TabDetails'
import TabAudience from './TabAudience'
import TabBudget from './TabBudget'
import { getLocaleFromCookie, getWizardTranslations } from '@/lib/i18n/wizardTranslations'
import type { MetaCapabilities } from '@/lib/meta/capabilityRules'

interface DiscoveryPatch {
  requiredFieldsAdded: string[]
  invalidCombination?: boolean
  notes?: string
}

interface StepAdSetProps {
  state: WizardState['adset']
  campaignObjective: string
  budgetOptimization?: 'campaign' | 'adset'
  onChange: (updates: Partial<WizardState['adset']>) => void
  errors?: Record<string, string>
  pages?: { id: string; name: string }[]
  instagramAccounts?: { id: string; username: string }[]
  pagesLoading?: boolean
  pagesInitialLoadDone?: boolean
  pagesError?: string | null
  instagramLoading?: boolean
  discoveryPatch?: DiscoveryPatch | null
  capabilities?: MetaCapabilities | null
  accountInventoryLeadForms?: Record<string, { form_id: string; name: string; status: string }[]>
  /** Real inventory with page-scoped WhatsApp data */
  accountInventory?: {
    whatsapp_phone_numbers?: { phoneNumberId: string; displayPhone?: string; verifiedName?: string; wabaId?: string; sourceLayer?: string }[]
    page_whatsapp_number?: string | null
    page_whatsapp_number_source?: string
    page_has_whatsapp?: boolean
  } | null
  accountInventoryPageId?: string | null
  accountInventoryStatus?: 'idle' | 'loading' | 'loaded' | 'error'
}

export default function StepAdSet({
  state,
  campaignObjective,
  budgetOptimization = 'adset',
  onChange,
  errors = {},
  pages = [],
  instagramAccounts = [],
  pagesLoading = false,
  pagesInitialLoadDone = false,
  pagesError = null,
  instagramLoading = false,
  discoveryPatch,
  capabilities,
  accountInventoryLeadForms,
  accountInventory = null,
  accountInventoryPageId = null,
  accountInventoryStatus = 'idle',
}: StepAdSetProps) {
  const t = getWizardTranslations(getLocaleFromCookie())
  const [activeTab, setActiveTab] = useState('details')

  const TABS = [
    { id: 'details', label: t.tabDetails },
    { id: 'audience', label: t.tabAudience },
    { id: 'budget', label: t.tabBudget },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold text-gray-900 tracking-tight">{t.adSetTitle}</h3>
        <div className="mt-1 h-0.5 w-10 rounded-full bg-primary/60" />
      </div>

      <div className="flex gap-1 p-1 bg-gray-100/80 rounded-xl border border-gray-200/60 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-white text-primary shadow-[0_1px_4px_rgba(0,0,0,0.10)] border border-gray-200/80'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {activeTab === 'details' && (
            <TabDetails
            state={state}
            campaignObjective={campaignObjective}
            onChange={onChange}
            errors={errors}
            pages={pages}
            instagramAccounts={instagramAccounts}
            pagesLoading={pagesLoading}
            pagesInitialLoadDone={pagesInitialLoadDone}
            pagesError={pagesError}
            instagramLoading={instagramLoading}
            capabilities={capabilities}
            accountInventoryLeadForms={accountInventoryLeadForms}
            accountInventory={accountInventory}
            accountInventoryPageId={accountInventoryPageId}
            accountInventoryStatus={accountInventoryStatus}
          />
        )}
        {activeTab === 'audience' && (
          <TabAudience state={state} onChange={onChange} />
        )}
        {activeTab === 'budget' && (
          <TabBudget
            state={state}
            campaignObjective={campaignObjective}
            onChange={onChange}
            errors={errors}
            hideBudgetFields={budgetOptimization === 'campaign'}
          />
        )}
      </div>
    </div>
  )
}
