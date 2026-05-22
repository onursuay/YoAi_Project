'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { useRegisteredAccounts } from '@/hooks/useRegisteredAccounts'
import MultiAccountDropdown from '@/components/account/MultiAccountDropdown'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'

interface AdAccount {
  id: string
  name: string
  account_id: string
  currency?: string
}

/**
 * Kendi kendine yeten birleşik hesap seçici (Madde 2 — Faz 3.3).
 * Topbar kullanmayan sayfalar (örn. YoAlgoritma özel header) için: tetikleyici
 * buton + birleşik dropdown + tüm veri çekimi tek bileşende. Flag kapalıyken
 * (reg.enabled=false) hiçbir şey render etmez.
 */
export default function UnifiedAccountSwitcher() {
  const router = useRouter()
  const reg = useRegisteredAccounts()
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [activeMeta, setActiveMeta] = useState<{ id: string; name: string } | null>(null)
  const [activeGoogleName, setActiveGoogleName] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetch('/api/meta/adaccounts').then(r => (r.ok ? r.json() : null)).then(d => { if (d?.accounts) setAdAccounts(d.accounts) }).catch(() => {})
    fetch('/api/meta/status', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => {
      if (d?.connected && d?.adAccountId) setActiveMeta({ id: d.adAccountId, name: d.adAccountName || '' })
    }).catch(() => {})
    fetch('/api/integrations/google-ads/selected', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => {
      if (d?.selected?.customerName) setActiveGoogleName(d.selected.customerName)
    }).catch(() => {})
  }, [])

  if (!reg.enabled) return null

  const label = activeMeta?.name || activeGoogleName || 'Reklam Hesapları'

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

      {open && (
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
