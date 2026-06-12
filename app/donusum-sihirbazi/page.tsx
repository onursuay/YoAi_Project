'use client'

import { Suspense, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import { useSubscription } from '@/components/providers/SubscriptionProvider'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'
import MarketingSetupWizard from '@/components/marketing-setup/MarketingSetupWizard'

export default function MarketingSetupPage() {
  const t = useTranslations('marketingSetup')
  const { hasSubscription, isOwner, loading: subLoading } = useSubscription()

  // Feature-flag / owner visibility gate (server decides).
  const [visible, setVisible] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/marketing-setup/visibility', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { visible: false }))
      .then((d) => {
        if (!cancelled) setVisible(Boolean(d?.visible))
      })
      .catch(() => {
        if (!cancelled) setVisible(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Owner bypasses the subscription barrier; otherwise an active plan is required.
  const subscriptionGated = !isOwner && !hasSubscription
  const resolving = visible === null || subLoading

  return (
    <>
      <Topbar title={t('title')} description={t('subtitle')} />

      <div className="flex-1 overflow-y-auto app-content-surface p-6">
        <div className="max-w-7xl mx-auto">
          {resolving ? (
            <div className="flex items-center justify-center py-24 text-sm text-gray-500">
              {t('common.loading')}
            </div>
          ) : !visible ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-16 text-center text-sm text-gray-700">
              {t('errors.notAvailable')}
            </div>
          ) : subscriptionGated ? (
            // Abonelik bariyeri aktif: wizard'ı hiç mount etme (aksi halde yetkisiz
            // connections/setup fetch'leri tetiklenirdi). Üstte AccessRequiredModal çıkar.
            <div className="py-24" aria-hidden />
          ) : (
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-24 text-sm text-gray-500">
                  {t('common.loading')}
                </div>
              }
            >
              <MarketingSetupWizard />
            </Suspense>
          )}
        </div>
      </div>

      {/* Subscription barrier — owner is bypassed. Only shown when the feature
          is visible (flag/owner) but the user lacks an active plan. */}
      {!resolving && visible && subscriptionGated && (
        <AccessRequiredModal
          type="subscription"
          featureKey="marketing_setup"
          reason="marketing_setup_gate_subscription"
        />
      )}
    </>
  )
}
