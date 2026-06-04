'use client'

import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'
import { useSubscription } from '@/components/providers/SubscriptionProvider'
import EmailDashboard from '@/components/email/EmailDashboard'

export default function EmailMarketingPage() {
  const t = useTranslations('email')
  const { hasSubscription, isOwner, loading } = useSubscription()

  const showGate = !loading && !hasSubscription && !isOwner

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={t('title')} description={t('description')} />
        <div className="flex-1 overflow-y-auto">
          {!showGate && <EmailDashboard />}
        </div>
      </div>

      {showGate && (
        <AccessRequiredModal
          type="subscription"
          featureKey="email_marketing"
          reason="email_marketing_subscription_required"
        />
      )}
    </>
  )
}
