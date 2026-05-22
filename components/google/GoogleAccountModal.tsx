'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2, Loader2, ArrowUpRight } from 'lucide-react'
import type { GoogleManagerOrAccount } from '@/hooks/google/useGoogleAdsConnection'
import { useRegisteredAccounts } from '@/hooks/useRegisteredAccounts'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'

interface GoogleAccountModalProps {
  isOpen: boolean
  onClose: () => void
  managers: GoogleManagerOrAccount[]
  managersLoading: boolean
  children: GoogleManagerOrAccount[]
  childrenLoading: boolean
  accountStep: 'managers' | 'children'
  selectingKey: string | null
  accountsError: string | null
  onManagerOrAccountClick: (item: GoogleManagerOrAccount) => void
  onChildClick: (child: GoogleManagerOrAccount) => void
  backToManagers: () => void
  /** Çoklu hesap (Madde 2): child loginCustomerId çözümü için aktif yönetici */
  selectedManagerId?: string | null
  /** Aktif (seçili) Google customer id — kayıtlı listede vurgulama için */
  activeCustomerId?: string | null
}

export default function GoogleAccountModal({
  isOpen,
  onClose,
  managers,
  managersLoading,
  children: childAccounts,
  childrenLoading,
  accountStep,
  selectingKey,
  accountsError,
  onManagerOrAccountClick,
  onChildClick,
  backToManagers,
  selectedManagerId,
  activeCustomerId,
}: GoogleAccountModalProps) {
  const tEnt = useTranslations('dashboard.entegrasyon.google')
  const tAcc = useTranslations('dashboard.meta.accounts')
  const reg = useRegisteredAccounts()

  const [busyId, setBusyId] = useState<string | null>(null)
  const [showLimitModal, setShowLimitModal] = useState(false)

  if (!isOpen) return null

  const multi = reg.enabled
  const googleRegistered = reg.accounts.filter(a => a.platform === 'google')
  const atLimit = multi && reg.limit !== null && reg.remaining !== null && reg.remaining <= 0
  const usedLabel = reg.limit === null
    ? tAcc('accountsUsedUnlimited', { count: reg.count })
    : tAcc('accountsUsed', { count: reg.count, limit: reg.limit })
  const busy = !!selectingKey || !!busyId

  // Kayıtlı bir Google hesabına geç — mevcut select-account endpoint'i + reload (Meta ile aynı desen)
  const switchToRegistered = async (acc: typeof googleRegistered[number]) => {
    setBusyId(acc.account_id)
    try {
      await fetch('/api/integrations/google-ads/select-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          loginCustomerId: acc.login_customer_id || acc.account_id,
          customerId: acc.account_id,
          customerName: acc.account_name || acc.account_id,
        }),
      })
      window.location.reload()
    } catch {
      setBusyId(null)
    }
  }

  // Browse listesinden seçim: yöneticiyse derinleş; hesapsa önce kaydet (limit) sonra seç
  const handleBrowsePick = async (item: GoogleManagerOrAccount, isChild: boolean) => {
    if (!multi) {
      isChild ? onChildClick(item) : onManagerOrAccountClick(item)
      return
    }
    if (!isChild && item.isManager) {
      onManagerOrAccountClick(item) // yöneticiye derinleş — kayıt yok
      return
    }
    const loginCustomerId = isChild ? (selectedManagerId ?? item.customerId) : item.customerId
    setBusyId(item.customerId)
    const res = await reg.addAccount({
      platform: 'google',
      account_id: item.customerId,
      account_name: item.name,
      login_customer_id: loginCustomerId,
    })
    setBusyId(null)
    if (!res.ok && res.error === 'limit_reached') {
      setShowLimitModal(true)
      return
    }
    isChild ? onChildClick(item) : onManagerOrAccountClick(item) // kaydedildi → seç (mevcut akış)
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !busy && onClose()}>
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">{tEnt('selectAccountTitle')}</h3>
              {multi && (
                <span className="text-xs font-semibold bg-primary/5 text-primary px-2 py-0.5 rounded-full ring-1 ring-primary/15">
                  {usedLabel}
                </span>
              )}
            </div>
            <button type="button" onClick={() => !busy && onClose()} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg" disabled={busy}>
              <span className="sr-only">Close</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-4 overflow-y-auto flex-1">
            {/* Kayıtlı Google hesapları (çoklu hesap) */}
            {multi && googleRegistered.length > 0 && accountStep === 'managers' && (
              <div className="mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">{tAcc('registered')}</p>
                <ul className="space-y-2">
                  {googleRegistered.map((acc) => {
                    const active = activeCustomerId === acc.account_id
                    return (
                      <li key={acc.account_id} className={`flex items-center justify-between p-3 border rounded-lg ${active ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                        <button type="button" onClick={() => !active && switchToRegistered(acc)} disabled={active || busy} className="min-w-0 text-left flex-1">
                          <p className="font-medium text-gray-900 truncate">{acc.account_name || acc.account_id}</p>
                          <p className="text-caption text-gray-500 font-mono">ID: {acc.account_id}</p>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          {active && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                          {busyId === acc.account_id && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                          {!active && busyId !== acc.account_id && (
                            <button type="button" onClick={() => reg.removeAccount('google', acc.account_id)} title="Çıkar" className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {accountStep === 'children' && (
              <button type="button" onClick={backToManagers} className="mb-3 text-sm text-primary hover:underline flex items-center gap-1">
                ← {tEnt('selectAccountTitle')}
              </button>
            )}
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              {multi
                ? (accountStep === 'managers' ? tAcc('addAccount') : tEnt('selectChildAccountTitle'))
                : (accountStep === 'managers' ? tEnt('selectAccountTitle') : tEnt('selectChildAccountTitle'))}
            </h4>
            {(accountStep === 'managers' ? managersLoading : childrenLoading) && (
              <p className="text-gray-600 text-center py-4">{tEnt('selecting')}</p>
            )}
            {accountsError && (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-6 py-6 text-center">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <circle cx="32" cy="32" r="30" fill="#FEE2E2" stroke="#FECACA" strokeWidth="2"/>
                  <circle cx="32" cy="32" r="22" fill="#FCA5A5" opacity="0.3"/>
                  <rect x="29.5" y="18" width="5" height="19" rx="2.5" fill="#DC2626"/>
                  <circle cx="32" cy="43" r="3" fill="#DC2626"/>
                </svg>
                <span className="text-sm font-medium text-red-700 leading-relaxed">{accountsError}</span>
              </div>
            )}
            {accountStep === 'managers' && !managersLoading && managers.length > 0 && (
              <ul className="space-y-2">
                {managers.map((m) => (
                  <li key={m.customerId} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <span className="font-medium text-gray-900">
                      {m.name} (ID: {m.customerId}){' '}
                      <span className={`inline-flex items-center px-2 py-0.5 text-caption font-medium rounded ${m.isManager ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-700'}`}>
                        {m.isManager ? tEnt('managerBadge') : tEnt('accountBadge')}
                      </span>
                    </span>
                    <button type="button" onClick={() => handleBrowsePick(m, false)} disabled={busy} className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                      {busyId === m.customerId || selectingKey === `account:${m.customerId}` || selectingKey === `manager:${m.customerId}` ? tEnt('selecting') : tEnt('selectLabel')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {accountStep === 'managers' && !managersLoading && !accountsError && managers.length === 0 && (
              <p className="text-gray-600 text-sm">{tEnt('noAccounts')}</p>
            )}
            {accountStep === 'children' && !childrenLoading && childAccounts.length > 0 && (
              <ul className="space-y-2">
                {childAccounts.map((c) => (
                  <li key={c.customerId} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <span className="font-medium text-gray-900">{c.name} (ID: {c.customerId})</span>
                    <button type="button" onClick={() => handleBrowsePick(c, true)} disabled={busy} className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                      {busyId === c.customerId || selectingKey === `account:${c.customerId}` ? tEnt('selecting') : tEnt('selectLabel')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {accountStep === 'children' && !childrenLoading && !accountsError && childAccounts.length === 0 && (
              <p className="text-gray-600 text-sm">{tEnt('noChildren')}</p>
            )}

            {/* Limit dolu uyarısı (browse alanında) */}
            {multi && atLimit && accountStep === 'managers' && (
              <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 p-3">
                <p className="text-sm font-medium text-gray-800">{tAcc('limitReachedTitle')} ({usedLabel})</p>
                <p className="text-xs text-gray-500 mt-0.5">{tAcc('upgradeForMore')}</p>
                <button type="button" onClick={() => setShowLimitModal(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  {tAcc('viewPlans')} <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showLimitModal && (
        <AccessRequiredModal
          type="subscription"
          featureKey="ad_account_slot"
          dismissible
          onClose={() => setShowLimitModal(false)}
          reason="multi_account_limit_google"
        />
      )}
    </>
  )
}
