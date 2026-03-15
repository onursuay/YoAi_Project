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
    whatsapp_phone_numbers?: { phoneNumberId: string; displayPhone?: string; verifiedName?: string; wabaId?: string }[]
    page_whatsapp_number?: string | null
    page_whatsapp_number_source?: string
  } | null
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
}: StepAdSetProps) {
  const t = getWizardTranslations(getLocaleFromCookie())
  const [activeTab, setActiveTab] = useState('details')

  const TABS = [
    { id: 'details', label: t.tabDetails },
    { id: 'audience', label: t.tabAudience },
    { id: 'budget', label: t.tabBudget },
  ]

  return (
    <div className="space-y-4">
      <div className="light-sweep-wrapper rounded-md w-fit">
        <h3 className="text-lg font-semibold text-gray-900">{t.adSetTitle}</h3>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-primary/10 text-primary/90 border border-b-0 border-gray-200 -mb-px'
                : 'text-gray-600 hover:text-gray-900'
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
