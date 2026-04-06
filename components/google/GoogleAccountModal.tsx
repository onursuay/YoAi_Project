'use client'

import { useTranslations } from 'next-intl'
import type { GoogleManagerOrAccount } from '@/hooks/google/useGoogleAdsConnection'

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
}: GoogleAccountModalProps) {
  const tEnt = useTranslations('dashboard.entegrasyon.google')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !selectingKey && onClose()}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{tEnt('selectAccountTitle')}</h3>
          <button type="button" onClick={() => !selectingKey && onClose()} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg" disabled={!!selectingKey}>
            <span className="sr-only">Close</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {accountStep === 'children' && (
            <button type="button" onClick={backToManagers} className="mb-3 text-sm text-primary hover:underline flex items-center gap-1">
              ← {tEnt('selectAccountTitle')}
            </button>
          )}
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            {accountStep === 'managers' ? tEnt('selectAccountTitle') : tEnt('selectChildAccountTitle')}
          </h4>
          {(accountStep === 'managers' ? managersLoading : childrenLoading) && (
            <p className="text-gray-600 text-center py-4">{tEnt('selecting')}</p>
          )}
          {accountsError && (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-6 py-6 text-center">
              {/* Vektörel uyarı ikonu */}
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                {/* Dış daire - soluk */}
                <circle cx="32" cy="32" r="30" fill="#FEE2E2" stroke="#FECACA" strokeWidth="2"/>
                {/* İç daire */}
                <circle cx="32" cy="32" r="22" fill="#FCA5A5" opacity="0.3"/>
                {/* Ünlem gövdesi */}
                <rect x="29.5" y="18" width="5" height="19" rx="2.5" fill="#DC2626"/>
                {/* Ünlem noktası */}
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
                    <span className={`inline-flex items-center px-2 py-0.5 text-caption font-medium rounded ${m.isManager ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
                      {m.isManager ? tEnt('managerBadge') : tEnt('accountBadge')}
                    </span>
                  </span>
                  <button type="button" onClick={() => onManagerOrAccountClick(m)} disabled={selectingKey === `account:${m.customerId}` || selectingKey === `manager:${m.customerId}`} className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                    {selectingKey === `account:${m.customerId}` || selectingKey === `manager:${m.customerId}` ? tEnt('selecting') : tEnt('selectLabel')}
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
                  <button type="button" onClick={() => onChildClick(c)} disabled={selectingKey === `account:${c.customerId}`} className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                    {selectingKey === `account:${c.customerId}` ? tEnt('selecting') : tEnt('selectLabel')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {accountStep === 'children' && !childrenLoading && !accountsError && childAccounts.length === 0 && (
            <p className="text-gray-600 text-sm">{tEnt('noChildren')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
