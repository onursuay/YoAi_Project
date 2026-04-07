'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

export default function MetaFinalizePage() {
  const router = useRouter()
  const locale = useLocale()
  const ranRef = useRef(false)

  useEffect(() => {
    // Prevent double-run in React strict mode
    if (ranRef.current) return
    ranRef.current = true

    async function finalize() {
      try {
        console.log('[FINALIZE] META_CONNECT_FINALIZE_START')

        // 1. Status check – if ad account already set, go directly
        const statusRes = await fetch('/api/meta/status', { cache: 'no-store' })
        const status = await statusRes.json()

        console.log('[FINALIZE] META_SESSION_READY:', JSON.stringify({
          connected: status.connected,
          hasAdAccount: !!status.adAccountId,
        }))

        if (status.connected && status.adAccountId) {
          console.log('[FINALIZE] DASHBOARD_LOAD: already has adAccountId=' + status.adAccountId)
          router.replace(`/${locale}/dashboard`)
          return
        }

        if (!status.connected) {
          console.error('[FINALIZE] META_SESSION_NOT_READY: connected=false — token cookie may not have propagated')
          // Wait briefly and retry — cookie propagation race condition
          await new Promise(r => setTimeout(r, 500))
          const retryRes = await fetch('/api/meta/status', { cache: 'no-store' })
          const retryStatus = await retryRes.json()
          console.log('[FINALIZE] META_SESSION_RETRY:', JSON.stringify({ connected: retryStatus.connected }))

          if (!retryStatus.connected) {
            router.replace(`/${locale}/entegrasyon?meta=error&reason=finalize_failed`)
            return
          }
          // If retry succeeded, continue with account fetch
        }

        // 2. Token exists but no ad account yet – fetch accounts
        const accountsRes = await fetch('/api/meta/adaccounts', { cache: 'no-store' })
        const accountsData = await accountsRes.json()
        const accounts: { id: string; name: string }[] = accountsData.accounts || []

        console.log('[FINALIZE] STEP3_FETCH_SUCCESS: count=' + accounts.length)

        if (accounts.length === 0) {
          // No ad accounts – send to wizard to show the empty state
          console.log('[FINALIZE] STEP3_FETCH_EMPTY: redirecting to /connect/meta')
          router.replace(`/${locale}/connect/meta`)
          return
        }

        if (accounts.length > 1) {
          // Multiple accounts – wizard handles manual selection
          console.log('[FINALIZE] MULTIPLE_ACCOUNTS: count=' + accounts.length + ' → /connect/meta')
          router.replace(`/${locale}/connect/meta`)
          return
        }

        // 3. Single account – auto-select
        const account = accounts[0]
        const selectRes = await fetch('/api/meta/select-adaccount', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adAccountId: account.id }),
        })
        const selectData = await selectRes.json()

        if (!selectRes.ok) {
          console.error('[FINALIZE] select-adaccount failed:', selectData)
          router.replace(`/${locale}/connect/meta`)
          return
        }

        console.log('[FINALIZE] AD_ACCOUNT_SELECTED (auto) id=' + selectData.account_id)

        // Also write to active-account for cross-platform consistency
        await fetch('/api/active-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: 'meta',
            account_id: selectData.account_id,
            account_name: selectData.account_name,
          }),
        }).catch(() => {})

        router.replace(`/${locale}/dashboard`)
      } catch (err) {
        console.error('[FINALIZE] Unexpected error:', err)
        router.replace(`/${locale}/connect/meta`)
      }
    }

    finalize()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4" />
        <p className="text-gray-700 font-medium">
          {locale === 'en' ? 'Completing connection...' : 'Bağlantı tamamlanıyor...'}
        </p>
      </div>
    </div>
  )
}
