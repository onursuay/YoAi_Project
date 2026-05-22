'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Plus, Trash2, Loader2, ArrowUpRight } from 'lucide-react'
import type { RegisteredAccount, AddAccountInput, AddAccountResult } from '@/hooks/useRegisteredAccounts'

interface AdAccount {
  id: string
  name: string
  account_id: string
  currency?: string
}

interface Props {
  adAccounts: AdAccount[]
  selectedAccount: string | null
  registered: RegisteredAccount[]
  count: number
  limit: number | null
  remaining: number | null
  onSwitch: (accountId: string) => void
  onDisconnect: () => void
  addAccount: (input: AddAccountInput) => Promise<AddAccountResult>
  removeAccount: (platform: 'meta' | 'google', accountId: string) => Promise<boolean>
  onLimitReached: () => void
  isAppReview: boolean
}

/**
 * Çoklu Reklam Hesabı (Madde 2 — Faz 2.2) — Meta switcher dropdown gövdesi.
 * Kayıtlı hesaplar arasında geçiş + plan limitine kadar yeni hesap ekleme.
 * Limit dolunca onLimitReached() → Topbar AccessRequiredModal'ı açar.
 * Yalnız `MULTI_ACCOUNT_ENABLED` açıkken render edilir.
 */
export default function MultiAccountDropdown({
  adAccounts,
  selectedAccount,
  registered,
  count,
  limit,
  remaining,
  onSwitch,
  onDisconnect,
  addAccount,
  removeAccount,
  onLimitReached,
  isAppReview,
}: Props) {
  const t = useTranslations('dashboard.meta.accounts')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // DB / cookie / adaccounts hepsi `act_` formunda (select-adaccount normalize eder) → doğrudan eşleşir.
  const registeredMetaIds = new Set(registered.filter(r => r.platform === 'meta').map(r => r.account_id))
  const matches = (a: AdAccount) =>
    a.name.toLowerCase().includes(search.toLowerCase()) || (a.account_id ?? '').toString().includes(search)

  const switchable = adAccounts.filter(a => registeredMetaIds.has(a.id) && matches(a))
  const addable = adAccounts.filter(a => !registeredMetaIds.has(a.id) && matches(a))
  const atLimit = limit !== null && remaining !== null && remaining <= 0
  const usedLabel = limit === null ? t('accountsUsedUnlimited', { count }) : t('accountsUsed', { count, limit })

  const handleAdd = async (a: AdAccount) => {
    if (atLimit) { onLimitReached(); return }
    setBusyId(a.id)
    const res = await addAccount({ platform: 'meta', account_id: a.id, account_name: a.name })
    setBusyId(null)
    if (!res.ok && res.error === 'limit_reached') onLimitReached()
  }

  const handleRemove = async (e: React.MouseEvent, a: AdAccount) => {
    e.stopPropagation()
    if (selectedAccount === a.id) return // aktif hesap çıkarılamaz
    setBusyId(a.id)
    await removeAccount('meta', a.id)
    setBusyId(null)
  }

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
      {/* Header — başlık + limit göstergesi */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <p className="text-ui font-medium text-gray-500">{isAppReview ? 'Ad Accounts' : t('title')}</p>
        <span className="text-xs font-semibold bg-primary/5 text-primary px-2 py-0.5 rounded-full ring-1 ring-primary/15">
          {usedLabel}
        </span>
      </div>

      {/* Arama */}
      <div className="p-2 border-b border-gray-100">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('searchAccounts')}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          onClick={e => e.stopPropagation()}
          autoFocus
        />
      </div>

      {/* Kayıtlı hesaplar — geçiş yapılabilir */}
      <div className="px-3 pt-2 pb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('registered')}</p>
      </div>
      <div className="max-h-52 overflow-y-auto">
        {switchable.map(a => {
          const active = selectedAccount === a.id
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onSwitch(a.id)}
              className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between ${active ? 'bg-green-50' : ''}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                <p className="text-caption text-gray-500 font-mono">ID: {a.account_id}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {active && <div className="w-2 h-2 bg-green-500 rounded-full" />}
                {!active && (
                  <span
                    onClick={e => handleRemove(e, a)}
                    title="Çıkar"
                    className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 cursor-pointer"
                  >
                    {busyId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </span>
                )}
              </div>
            </button>
          )
        })}
        {switchable.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">—</p>}
      </div>

      {/* Hesap ekle */}
      <div className="border-t border-gray-100">
        <button
          type="button"
          onClick={() => (atLimit ? onLimitReached() : setShowAdd(s => !s))}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
        >
          <span className="flex items-center gap-1.5"><Plus className="w-4 h-4" />{t('addAccount')}</span>
          {!atLimit && <ChevronDown className={`w-4 h-4 transition-transform ${showAdd ? 'rotate-180' : ''}`} />}
        </button>

        {atLimit && (
          <div className="mx-3 mb-3 rounded-lg bg-primary/5 border border-primary/20 p-3">
            <p className="text-sm font-medium text-gray-800">{t('limitReachedTitle')} ({usedLabel})</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('upgradeForMore')}</p>
            <button
              type="button"
              onClick={onLimitReached}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              {t('viewPlans')} <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {!atLimit && showAdd && (
          <div className="max-h-40 overflow-y-auto pb-1">
            {addable.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleAdd(a)}
                disabled={busyId === a.id}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 truncate">{a.name}</p>
                  <p className="text-caption text-gray-400 font-mono">ID: {a.account_id}</p>
                </div>
                {busyId === a.id
                  ? <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                  : <Plus className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
            {addable.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">{t('noMoreToAdd')}</p>}
          </div>
        )}
      </div>

      {/* Bağlantıyı kes */}
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={onDisconnect}
          className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
        >
          {isAppReview ? 'Disconnect' : t('disconnect')}
        </button>
      </div>
    </div>
  )
}
