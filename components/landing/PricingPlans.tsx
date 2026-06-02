'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import PlanCard from '@/components/subscription/PlanCard'
import { SUBSCRIPTION_PLANS, MIN_AD_ACCOUNTS, ENTERPRISE_MIN_AD_ACCOUNTS } from '@/lib/subscription/plans'
import type { BillingCycle } from '@/lib/subscription/types'

// Sales contact for the Enterprise (contact-sales) plan — matches /abonelik + landing ScheduleModal
const SALES_EMAIL = 'info@yodijital.com'

/**
 * Public pricing plans block (no auth).
 * Mirrors the /abonelik plan grid using the shared PlanCard, but instead of
 * starting İyzico checkout it routes anonymous visitors to signup. The real
 * checkout still happens after auth on /abonelik — this is the marketing view.
 */
export default function PricingPlans() {
  const t = useTranslations('pricing')
  const router = useRouter()

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  // Per-plan ad-account counters — each card scales independently (same as /abonelik).
  const [accountCounts, setAccountCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      SUBSCRIPTION_PLANS.map(p => [p.id, p.id === 'enterprise' ? ENTERPRISE_MIN_AD_ACCOUNTS : MIN_AD_ACCOUNTS]),
    ),
  )

  const handleSelect = (planId: string) => {
    if (planId === 'enterprise') {
      const count = accountCounts.enterprise ?? ENTERPRISE_MIN_AD_ACCOUNTS
      const subject = encodeURIComponent('Enterprise Plan — Reklam Ajansı Talebi')
      const body = encodeURIComponent(
        `Merhaba,\n\nEnterprise plan ile ilgileniyorum. İhtiyacım olan reklam hesabı sayısı: ${count}.\n\nTeşekkürler.`,
      )
      window.location.href = `mailto:${SALES_EMAIL}?subject=${subject}&body=${body}`
      return
    }
    // Anonymous visitor → start signup. Checkout is gated behind auth on /abonelik.
    router.push('/signup')
  }

  return (
    <div className="max-w-[1240px] mx-auto">
      {/* Billing cycle toggle */}
      <div className="flex justify-center mb-10">
        <div className="inline-flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-full p-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-2 text-sm font-medium rounded-full transition-colors ${
              billingCycle === 'monthly'
                ? 'bg-emerald-400 text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t('monthly')}
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-6 py-2 text-sm font-medium rounded-full transition-colors flex items-center gap-1.5 ${
              billingCycle === 'yearly'
                ? 'bg-emerald-400 text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t('yearly')}
            <span className={`text-xs font-bold ${billingCycle === 'yearly' ? 'text-black/70' : 'text-emerald-400'}`}>
              {t('yearlyBadge')}
            </span>
          </button>
        </div>
      </div>

      {/* Plan cards — 4 equal columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {SUBSCRIPTION_PLANS.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            billingCycle={billingCycle}
            isCurrentPlan={false}
            onSelect={handleSelect}
            highlighted={plan.id === 'premium'}
            glass
            adAccountCount={accountCounts[plan.id] ?? MIN_AD_ACCOUNTS}
            onAccountChange={(count) => setAccountCounts(prev => ({ ...prev, [plan.id]: count }))}
          />
        ))}
      </div>

      {/* Notes */}
      <div className="mt-6 space-y-1 text-center">
        <p className="text-sm text-gray-500">{t('trialNote')}</p>
        <p className="text-sm text-emerald-400/80">{t('optimizationNote')}</p>
      </div>
    </div>
  )
}
