'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import PlanCard from '@/components/subscription/PlanCard'
import CreditLoadSection from '@/components/subscription/CreditLoadSection'
import { useSubscription } from '@/components/providers/SubscriptionProvider'
import { SUBSCRIPTION_PLANS } from '@/lib/subscription/plans'
import type { BillingCycle, PlanId } from '@/lib/subscription/types'
import { Calendar, CreditCard, Shield } from 'lucide-react'

export default function AbonelikPage() {
  const t = useTranslations('subscription')
  const {
    subscription,
    updateSubscription,
    isTrialActive: trial,
    trialDaysRemaining,
    isPaid,
  } = useSubscription()

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [adAccountCount, setAdAccountCount] = useState(2)

  // Scroll to #krediler if hash present
  useEffect(() => {
    if (window.location.hash === '#krediler') {
      setTimeout(() => {
        document.getElementById('krediler')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [])

  const handleSelectPlan = (planId: string) => {
    if (planId === 'enterprise') {
      // TODO: Contact form
      return
    }
    updateSubscription({
      planId: planId as PlanId,
      status: 'active',
      billingCycle,
      startDate: new Date().toISOString(),
      trialEndDate: null,
      currentPeriodEnd: new Date(
        Date.now() + (billingCycle === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000
      ).toISOString(),
    })
  }

  const currentPlan = SUBSCRIPTION_PLANS.find(p => p.id === subscription.planId)
  const statusLabel = trial
    ? `${t('currentPlan.trial')} (${trialDaysRemaining} ${t('currentPlan.daysLeft', { days: trialDaysRemaining }).replace(`${trialDaysRemaining} `, '')})`
    : isPaid
    ? t('currentPlan.active')
    : subscription.status

  return (
    <>
      <Topbar title={t('title')} description={t('description')} />
      <div className="flex-1 overflow-y-auto">

        {/* ── Plans Section — full width, dark background ──────────── */}
        <div className="bg-gray-900 px-8 py-10">
          <div className="mx-auto" style={{ maxWidth: '1400px' }}>
            {/* Header with toggle */}
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-white">{t('plans')}</h3>
              <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-5 py-2 text-sm font-medium rounded-md transition-colors ${
                    billingCycle === 'monthly'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t('monthly')}
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-5 py-2 text-sm font-medium rounded-md transition-colors ${
                    billingCycle === 'yearly'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t('yearly')}
                  <span className="ml-1.5 text-xs text-primary font-bold">-30%</span>
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
                  isCurrentPlan={subscription.planId === plan.id}
                  onSelect={handleSelectPlan}
                  highlighted={plan.id === 'premium'}
                  adAccountCount={adAccountCount}
                  onAccountChange={setAdAccountCount}
                />
              ))}
            </div>

            {/* Notes */}
            <div className="mt-5 space-y-1">
              <p className="text-sm text-gray-500">* {t('trialBadge')} — Premium plan için geçerlidir.</p>
              <p className="text-sm text-amber-400 font-medium">* {t('optimizationNote')}</p>
            </div>
          </div>
        </div>

        {/* ── Current Plan + Credits — side by side below ─────────── */}
        <div className="bg-gray-50 px-8 py-8">
          <div className="mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ maxWidth: '1400px' }}>

            {/* Current Plan Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-7">
              <h3 className="text-base font-bold text-gray-900 mb-6">{t('currentPlan.title')}</h3>

              <div className="space-y-0 mb-6">
                <div className="flex items-center justify-between py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2.5 text-sm text-gray-500">
                    <Shield className="w-4 h-4" />
                    <span>{t('currentPlan.plan')}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {currentPlan?.name || 'Free'}
                    {trial && (
                      <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded">
                        {t('currentPlan.trial')}
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2.5 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span>{t('currentPlan.status')}</span>
                  </div>
                  <span className={`text-sm font-medium ${trial ? 'text-amber-600' : isPaid ? 'text-primary' : 'text-gray-600'}`}>
                    {statusLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-2.5 text-sm text-gray-500">
                    <CreditCard className="w-4 h-4" />
                    <span>{t('currentPlan.billing')}</span>
                  </div>
                  <span className="text-sm text-gray-700">
                    {subscription.billingCycle === 'monthly' ? t('monthly') : t('yearly')}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="flex-1 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors text-sm"
                >
                  {t('currentPlan.upgrade')}
                </button>
                {isPaid && (
                  <button className="px-5 py-3 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
                    {t('currentPlan.cancelPlan')}
                  </button>
                )}
              </div>
            </div>

            {/* Credit Load Section */}
            <CreditLoadSection />
          </div>
        </div>
      </div>
    </>
  )
}
