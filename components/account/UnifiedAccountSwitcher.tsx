'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import { useRegisteredAccounts } from '@/hooks/useRegisteredAccounts'
import MultiAccountDropdown from '@/components/account/MultiAccountDropdown'
import BusinessSwitcherDropdown from '@/components/account/BusinessSwitcherDropdown'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'
import { groupIntoBusinesses, type BusinessGroup } from '@/lib/account/businessGroups'
import { clearYoAlgoritmaClientCache } from '@/lib/yoai/clientCache'

interface AdAccount {
  id: string
  name: string
  account_id: string
  currency?: string
}

const stripAct = (v: string) => v.replace(/^act_/, '')
const stripDash = (v: string) => v.replace(/-/g, '')

/**
 * Kendi kendine yeten birleşik hesap seçici (Madde 2 — Faz 3.3 / 3.4).
 * Topbar kullanmayan sayfalar (YoAlgoritma özel header) için.
 *
 * İki mod:
 *  - perAccountScope KAPALI → mevcut Meta+Google hesap dropdown'ı (MultiAccountDropdown).
 *  - perAccountScope AÇIK   → İŞLETME seçici: kayıtlı hesapları isim eşleştirmesiyle
 *    işletmelere gruplar; seçilince YoAlgoritma yalnız o işletmenin Meta+Google'ını gösterir.
 * Flag kapalıyken (reg.enabled=false) hiçbir şey render etmez.
 */
export default function UnifiedAccountSwitcher() {
  const router = useRouter()
  const t = useTranslations('account.businessSwitcher')
  const reg = useRegisteredAccounts()
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [activeMeta, setActiveMeta] = useState<{ id: string; name: string } | null>(null)
  const [activeGoogle, setActiveGoogle] = useState<{ customerId: string; customerName?: string } | null>(null)
  const [scopeBusinessId, setScopeBusinessId] = useState<string | null>(null)
  const [scopeMeta, setScopeMeta] = useState<string | null>(null)
  const [scopeGoogle, setScopeGoogle] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetch('/api/meta/adaccounts').then(r => (r.ok ? r.json() : null)).then(d => { if (d?.accounts) setAdAccounts(d.accounts) }).catch(() => {})
    fetch('/api/meta/status', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => {
      if (d?.connected && d?.adAccountId) setActiveMeta({ id: d.adAccountId, name: d.adAccountName || '' })
    }).catch(() => {})
    fetch('/api/integrations/google-ads/selected', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => {
      if (d?.selected?.customerId) setActiveGoogle({ customerId: d.selected.customerId, customerName: d.selected.customerName })
    }).catch(() => {})
  }, [])

  // İşletme modunda mevcut scope'u çek (vurgu için)
  useEffect(() => {
    if (!reg.perAccountScope) return
    fetch('/api/yoai/business-scope', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => {
      if (d?.scope) {
        setScopeBusinessId(d.scope.businessId ?? null)
        setScopeMeta(d.scope.metaAccountId ?? null)
        setScopeGoogle(d.scope.googleCustomerId ?? null)
      }
    }).catch(() => {})
  }, [reg.perAccountScope])

  // Kayıtlı hesapları işletmelere grupla (isim eşleştirme)
  const businesses = useMemo<BusinessGroup[]>(() => {
    if (!reg.perAccountScope) return []
    const metaAccts = reg.accounts.filter(a => a.platform === 'meta').map(r => {
      const found = adAccounts.find(a => stripAct(a.id) === stripAct(r.account_id))
      return { accountId: r.account_id, accountName: found?.name || r.account_name || null }
    })
    const googleAccts = reg.accounts.filter(a => a.platform === 'google').map(r => ({
      customerId: r.account_id,
      loginCustomerId: r.login_customer_id,
      accountName: (activeGoogle?.customerId === r.account_id && activeGoogle?.customerName)
        ? activeGoogle.customerName
        : r.account_name,
    }))
    return groupIntoBusinesses(metaAccts, googleAccts)
  }, [reg.perAccountScope, reg.accounts, adAccounts, activeGoogle])

  // Seçili işletme: scope'tan (businessId → meta/google eşleşmesi → aktif seçim) çöz
  const selectedBusiness = useMemo<BusinessGroup | null>(() => {
    if (businesses.length === 0) return null
    const byId = scopeBusinessId && businesses.find(b => b.id === scopeBusinessId)
    if (byId) return byId
    const byScope = (scopeMeta || scopeGoogle) && businesses.find(b =>
      (scopeMeta && b.meta && stripAct(b.meta.accountId) === stripAct(scopeMeta)) ||
      (scopeGoogle && b.google && stripDash(b.google.customerId) === stripDash(scopeGoogle)),
    )
    if (byScope) return byScope
    // Scope yoksa: aktif Meta/Google seçimine uyan işletme
    const byActive = businesses.find(b =>
      (activeMeta && b.meta && stripAct(b.meta.accountId) === stripAct(activeMeta.id)) ||
      (activeGoogle && b.google && stripDash(b.google.customerId) === stripDash(activeGoogle.customerId)),
    )
    return byActive || null
  }, [businesses, scopeBusinessId, scopeMeta, scopeGoogle, activeMeta, activeGoogle])

  const selectBusiness = async (b: BusinessGroup) => {
    if (selectedBusiness?.id === b.id) { setOpen(false); return }
    setBusyId(b.id)
    try {
      const res = await fetch('/api/yoai/business-scope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          businessId: b.id,
          metaAccountId: b.meta?.accountId ?? null,
          googleCustomerId: b.google?.customerId ?? null,
          googleLoginCustomerId: b.google?.loginCustomerId ?? null,
        }),
      })
      if (!res.ok) { setBusyId(null); return }
      clearYoAlgoritmaClientCache()
      window.location.reload()
    } catch {
      setBusyId(null)
    }
  }

  if (!reg.enabled) return null

  const businessMode = reg.perAccountScope
  const label = businessMode
    ? (selectedBusiness?.name || t('selectBusiness'))
    : (activeMeta?.name || activeGoogle?.customerName || t('adAccountsFallback'))

  const handleMouseEnter = () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    setOpen(true)
  }
  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150)
  }

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        type="button"
        className="flex items-center gap-2 px-4 py-2 bg-white border border-green-400 rounded-lg hover:bg-green-50 transition-all shadow-[0_0_8px_rgba(34,197,94,0.3)] hover:shadow-[0_0_12px_rgba(34,197,94,0.5)]"
      >
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-sm font-medium text-gray-700 max-w-[180px] truncate">{label}</span>
        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && businessMode && (
        <BusinessSwitcherDropdown
          businesses={businesses}
          selectedId={selectedBusiness?.id ?? null}
          busyId={busyId}
          onSelect={selectBusiness}
          onManage={() => router.push('/entegrasyon')}
        />
      )}

      {open && !businessMode && (
        <MultiAccountDropdown
          adAccounts={adAccounts}
          selectedAccount={activeMeta?.id ?? null}
          registered={reg.accounts}
          count={reg.count}
          limit={reg.limit}
          remaining={reg.remaining}
          onDisconnect={() => router.push('/entegrasyon')}
          addAccount={reg.addAccount}
          removeAccount={reg.removeAccount}
          onLimitReached={() => setShowLimitModal(true)}
          isAppReview={false}
        />
      )}

      {showLimitModal && (
        <AccessRequiredModal
          type="subscription"
          featureKey="ad_account_slot"
          dismissible
          onClose={() => setShowLimitModal(false)}
          reason="multi_account_limit"
        />
      )}
    </div>
  )
}
