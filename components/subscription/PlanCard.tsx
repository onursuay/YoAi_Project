'use client'

import { Check, Minus, Plus } from 'lucide-react'
import type { SubscriptionPlan, BillingCycle } from '@/lib/subscription/types'
import { getMonthlyPrice, getYearlyPrice, getYearlyMonthlyPrice, toChargeTRY, PLAN_SECTION_TITLES, MIN_AD_ACCOUNTS, MAX_AD_ACCOUNTS, ENTERPRISE_MIN_AD_ACCOUNTS, ENTERPRISE_MAX_AD_ACCOUNTS } from '@/lib/subscription/plans'
import { useTranslations } from 'next-intl'

interface Props {
  plan: SubscriptionPlan
  billingCycle: BillingCycle
  isCurrentPlan: boolean
  onSelect: (planId: string) => void
  highlighted?: boolean
  adAccountCount: number
  onAccountChange: (count: number) => void
  /**
   * Glass surface variant — harmonizes the card with the near-black ("#060609")
   * public pricing page (translucent white-alpha + emerald accent) instead of the
   * solid slate (`bg-gray-800`) used on the authenticated /abonelik page.
   */
  glass?: boolean
}

export default function PlanCard({ plan, billingCycle, isCurrentPlan, onSelect, highlighted, adAccountCount, onAccountChange, glass }: Props) {
  const t = useTranslations('subscription')
  const isEnterprise = plan.id === 'enterprise'

  const accounts = adAccountCount
  const monthlyPrice = getMonthlyPrice(plan.id, accounts)
  const yearlyTotal = getYearlyPrice(plan.id, accounts)
  const yearlyMonthly = getYearlyMonthlyPrice(plan.id, accounts)
  const displayPrice = billingCycle === 'monthly' ? monthlyPrice : yearlyMonthly

  // Original monthly price (for strikethrough when yearly)
  const originalMonthlyTotal = monthlyPrice * 12

  // İyzico'dan TL olarak tahsil edilecek GERÇEK tutar (USD × kur). Aylık döngüde
  // aylık tutar; yıllık döngüde tek seferlik yıllık toplam tahsil edilir.
  const chargeUsd = billingCycle === 'monthly' ? monthlyPrice : yearlyTotal
  const chargeTry = Math.round(toChargeTRY(chargeUsd)).toLocaleString('tr-TR')

  const sectionTitle = PLAN_SECTION_TITLES[plan.id] || t('features')

  // Self-serve plans scale 2→6; Enterprise (contact-sales) starts at 7 and goes up.
  const minAccounts = isEnterprise ? ENTERPRISE_MIN_AD_ACCOUNTS : MIN_AD_ACCOUNTS
  const maxAccounts = isEnterprise ? ENTERPRISE_MAX_AD_ACCOUNTS : MAX_AD_ACCOUNTS

  const handleDecrease = () => {
    if (adAccountCount > minAccounts) {
      onAccountChange(adAccountCount - 1)
    }
  }

  const handleIncrease = () => {
    if (adAccountCount < maxAccounts) {
      onAccountChange(adAccountCount + 1)
    }
  }

  // Surface tokens — `glass` (public pricing, near-black bg) vs solid (/abonelik, slate bg).
  const cardSurface = glass
    ? highlighted
      ? 'bg-emerald-500/[0.06] border-emerald-400/30 ring-1 ring-emerald-400/20 shadow-[0_8px_40px_-12px_rgba(16,185,129,0.35)]'
      : 'bg-white/[0.025] border-white/[0.07] hover:border-white/[0.14] hover:bg-white/[0.04]'
    : highlighted
      ? 'bg-gray-800 border-primary shadow-lg shadow-primary/20 ring-1 ring-primary/30'
      : 'bg-gray-800 border-gray-700 hover:border-gray-600'
  const dividerBorder = glass ? 'border-white/[0.08]' : 'border-gray-700'
  const stepperIdle = glass
    ? 'border-white/[0.12] text-gray-400 hover:text-white hover:border-white/25 cursor-pointer'
    : 'border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 cursor-pointer'
  const stepperDisabled = glass
    ? 'border-white/[0.06] text-gray-600 cursor-not-allowed'
    : 'border-gray-700 text-gray-600 cursor-not-allowed'

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all ${cardSurface}`}
    >
      {/* Popular / Trial badge */}
      {highlighted && plan.trialDays > 0 ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-[10px] font-bold rounded-full uppercase tracking-wide">
          {t('trialBadge')}
        </div>
      ) : highlighted ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-[10px] font-bold rounded-full uppercase tracking-wide">
          {t('popular') ?? 'En Popüler'}
        </div>
      ) : null}

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-white">{plan.name}</h3>
          {plan.trialDays > 0 && !highlighted && !isEnterprise && (
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-primary/20 text-primary rounded-full">
              {t('trialBadge')}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-1">
          {t(`planDescriptions.${plan.id}`)}
        </p>
      </div>

      {/* Price */}
      <div className="mb-5">
        {isEnterprise ? (
          <div className="text-lg font-bold text-white">
            {t('contactUs')}
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">${displayPrice.toFixed(2)}</span>
              <span className="text-sm text-gray-400">/ {t('perMonth')}</span>
            </div>
            {billingCycle === 'yearly' && (
              <p className="text-sm text-gray-500 mt-1">
                <span className="line-through">${originalMonthlyTotal.toFixed(2)}</span>
                {' '}${yearlyTotal.toFixed(2)}/{t('perYear')}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1.5">
              {t(billingCycle === 'monthly' ? 'chargedInTryMonthly' : 'chargedInTryYearly', { amount: chargeTry })}
            </p>
          </>
        )}
      </div>

      {/* Ad accounts */}
      <div className={`mb-5 pb-5 border-b ${dividerBorder}`}>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDecrease}
            disabled={adAccountCount <= minAccounts}
            className={`p-1 rounded border transition-colors ${
              adAccountCount <= minAccounts ? stepperDisabled : stepperIdle
            }`}
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-sm text-gray-300">
            {adAccountCount} {t('adAccounts')}
          </span>
          <button
            onClick={handleIncrease}
            disabled={adAccountCount >= maxAccounts}
            className={`p-1 rounded border transition-colors ${
              adAccountCount >= maxAccounts ? stepperDisabled : stepperIdle
            }`}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        {/* Reserved hint slot — keeps every card the same height (symmetry) */}
        <div className="min-h-[18px] mt-1.5">
          {!isEnterprise && adAccountCount >= MAX_AD_ACCOUNTS && (
            <p className="text-xs text-primary">{t('maxAccountsHint')}</p>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-400 mb-3">{sectionTitle}</p>
        <ul className="space-y-2.5">
          {plan.features.map(feature => (
            <li key={feature} className="flex items-center gap-2 text-sm text-gray-300">
              <Check className="w-4 h-4 text-primary shrink-0" />
              <span>{t(`featureLabels.${feature}`)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="mt-6">
        {isCurrentPlan ? (
          <div className="w-full py-2.5 text-center text-sm font-medium text-primary bg-primary/10 rounded-lg">
            {t('currentPlanBadge')}
          </div>
        ) : isEnterprise ? (
          <button
            onClick={() => onSelect(plan.id)}
            className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors ${
              glass
                ? 'text-gray-200 bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1]'
                : 'text-gray-300 bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {t('contactUs')}
          </button>
        ) : (
          <button
            onClick={() => onSelect(plan.id)}
            className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors ${
              highlighted
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'bg-white text-gray-900 hover:bg-gray-100'
            }`}
          >
            {t('selectPlan')}
          </button>
        )}
      </div>
    </div>
  )
}
