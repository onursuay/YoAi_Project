'use client'

import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'
import { useSubscription } from '@/components/providers/SubscriptionProvider'
import CrmDashboard from '@/components/crm/CrmDashboard'

export default function CrmPage() {
  const t = useTranslations('crm')
  const { hasSubscription, isOwner, loading } = useSubscription()

  const showGate = !loading && !hasSubscription && !isOwner

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={t('title')} description={t('description')} />
        <div className="flex-1 overflow-y-auto">
          {!showGate && <CrmDashboard />}
        </div>
      </div>

      {showGate && (
        <AccessRequiredModal
          type="subscription"
          featureKey="crm"
          reason="crm_subscription_required"
        />
      )}
    </>
  )
}
