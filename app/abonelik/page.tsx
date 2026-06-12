'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import PlanCard from '@/components/subscription/PlanCard'
import CreditLoadSection from '@/components/subscription/CreditLoadSection'
import { useSubscription } from '@/components/providers/SubscriptionProvider'
import { useCredits } from '@/components/providers/CreditProvider'
import { SUBSCRIPTION_PLANS, MIN_AD_ACCOUNTS, ENTERPRISE_MIN_AD_ACCOUNTS } from '@/lib/subscription/plans'
import type { BillingCycle } from '@/lib/subscription/types'
import { Calendar, CreditCard, Shield } from 'lucide-react'

// Sales contact for the Enterprise (contact-sales) plan — matches landing ScheduleModal
const SALES_EMAIL = 'info@yodijital.com'

export default function AbonelikPage() {
  const t = useTranslations('subscription')
  const {
    subscription,
    refresh: refreshSubscription,
    isTrialActive: trial,
    trialDaysRemaining,
    isPaid,
  } = useSubscription()
  const { refresh: refreshCredits } = useCredits()

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  // Per-plan ad-account counters — each card scales independently (no shared state).
  const [accountCounts, setAccountCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      SUBSCRIPTION_PLANS.map(p => [p.id, p.id === 'enterprise' ? ENTERPRISE_MIN_AD_ACCOUNTS : MIN_AD_ACCOUNTS]),
    ),
  )
  const [paymentBanner, setPaymentBanner] = useState<'success' | 'failed' | null>(null)
  const [starting, setStarting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  const [consentChecked, setConsentChecked] = useState(false)
  const cancelled = !!(subscription as { cancelAtPeriodEnd?: boolean })?.cancelAtPeriodEnd

  async function handleCancel() {
    if (!confirm(t('currentPlan.cancelConfirm'))) return
    setCancelling(true)
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (data?.ok) {
        await refreshSubscription()
        alert(t('currentPlan.cancelSuccess'))
      } else {
        alert(t('currentPlan.cancelError'))
      }
    } catch {
      alert(t('currentPlan.cancelError'))
    } finally {
      setCancelling(false)
    }
  }

  // Scroll to #krediler if hash present
  useEffect(() => {
    if (window.location.hash === '#krediler') {
      setTimeout(() => {
        document.getElementById('krediler')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [])

  // Purely visual: the real activation happens server-side in the callback.
  // We refetch current state and show a toast — never trust the query param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const p = params.get('payment')
    if (p === 'success' || p === 'failed') {
      setPaymentBanner(p)
      refreshSubscription()
      refreshCredits()
      const url = new URL(window.location.href)
      url.searchParams.delete('payment')
      url.searchParams.delete('reason')
      window.history.replaceState({}, '', url.toString())
      const t = setTimeout(() => setPaymentBanner(null), 6000)
      return () => clearTimeout(t)
    }
  }, [refreshSubscription, refreshCredits])

  const handleSelectPlan = async (planId: string) => {
    if (planId === 'enterprise') {
      // Contact-sales: no self-serve checkout. Open a pre-filled mail to the sales inbox.
      const count = accountCounts.enterprise ?? ENTERPRISE_MIN_AD_ACCOUNTS
      const subject = encodeURIComponent(t('enterpriseMail.subject'))
      const body = encodeURIComponent(t('enterpriseMail.body', { count }))
      window.location.href = `mailto:${SALES_EMAIL}?subject=${subject}&body=${body}`
      return
    }
    // Yasal onay kapısı: mesafeli satış + ön bilgilendirme onayı alınmadan ödeme başlatılmaz.
    setConsentChecked(false)
    setPendingPlan(planId)
  }

  const proceedCheckout = async (planId: string) => {
    if (starting) return
    setStarting(true)
    try {
      const res = await fetch('/api/billing/iyzico/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'subscription', planId, billingCycle, adAccounts: accountCounts[planId] ?? MIN_AD_ACCOUNTS }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok || !data.paymentPageUrl) {
        alert(data?.error === 'iyzico_not_configured'
          ? t('checkout.notConfigured')
          : t('checkout.startError'))
        return
      }
      window.location.href = data.paymentPageUrl
    } catch {
      alert(t('checkout.startError'))
    } finally {
      setStarting(false)
    }
  }

  const pendingPlanObj = pendingPlan ? SUBSCRIPTION_PLANS.find(p => p.id === pendingPlan) : null

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
        {paymentBanner === 'success' && (
          <div className="mx-8 mt-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            {t('paymentSuccessBanner')}
          </div>
        )}
        {paymentBanner === 'failed' && (
          <div className="mx-8 mt-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800">
            {t('paymentFailedBanner')}
          </div>
        )}

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
                  adAccountCount={accountCounts[plan.id] ?? MIN_AD_ACCOUNTS}
                  onAccountChange={(count) => setAccountCounts(prev => ({ ...prev, [plan.id]: count }))}
                />
              ))}
            </div>

            {/* Notes */}
            <div className="mt-5 space-y-1">
              <p className="text-sm text-gray-500">* {t('trialBadge')} — {t('trialPremiumNote')}</p>
              <p className="text-sm text-primary font-medium">* {t('optimizationNote')}</p>
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
                      <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary rounded">
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
                  <span className={`text-sm font-medium ${trial ? 'text-primary' : isPaid ? 'text-primary' : 'text-gray-600'}`}>
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
                {(isPaid || trial) && !cancelled && (
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="px-5 py-3 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors active:scale-[0.97] disabled:opacity-50"
                  >
                    {cancelling ? t('currentPlan.cancelling') : t('currentPlan.cancelPlan')}
                  </button>
                )}
                {cancelled && (
                  <span className="px-5 py-3 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl bg-gray-50">
                    {t('currentPlan.cancelledBadge')}
                  </span>
                )}
              </div>
              {cancelled && (
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{t('currentPlan.cancelledNote')}</p>
              )}
            </div>

            {/* Credit Load Section */}
            <CreditLoadSection />
          </div>
        </div>
      </div>

      {/* Yasal onay modalı — mesafeli satış + ön bilgilendirme onayı alınmadan ödeme başlatılmaz */}
      {pendingPlan && pendingPlanObj && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)] p-6 animate-card-enter">
            <h3 className="text-base font-semibold text-gray-900 mb-1">{t('checkout.confirmTitle')}</h3>
            <p className="text-sm leading-relaxed text-gray-600 mb-4">
              {t('checkout.confirmPlan', { plan: pendingPlanObj.name })}
            </p>
            <label className="flex items-start gap-3 cursor-pointer mb-5">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
              />
              <span className="text-sm leading-relaxed text-gray-700">
                <a href="/mesafeli-satis-sozlesmesi" target="_blank" className="text-primary font-medium hover:underline">{t('checkout.distanceSales')}</a>
                {' '}{t('checkout.and')}{' '}
                <a href="/on-bilgilendirme-formu" target="_blank" className="text-primary font-medium hover:underline">{t('checkout.preInfo')}</a>
                {' '}{t('checkout.consentSuffix')}
              </span>
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingPlan(null)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors active:scale-[0.97]"
              >
                {t('checkout.cancel')}
              </button>
              <button
                disabled={!consentChecked || starting}
                onClick={() => { const p = pendingPlan; setPendingPlan(null); if (p) proceedCheckout(p) }}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('checkout.proceed')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
