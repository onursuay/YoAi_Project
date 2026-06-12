'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown, Plus, Trash2, Loader2, ArrowUpRight } from 'lucide-react'
import type { RegisteredAccount, AddAccountInput, AddAccountResult } from '@/hooks/useRegisteredAccounts'
import { clearYoAlgoritmaClientCache } from '@/lib/yoai/clientCache'

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
  onDisconnect: () => void
  addAccount: (input: AddAccountInput) => Promise<AddAccountResult>
  removeAccount: (platform: 'meta' | 'google', accountId: string) => Promise<boolean>
  onLimitReached: () => void
  isAppReview: boolean
}

/**
 * Birleşik Reklam Hesabı switcher (Madde 2 — Faz 3) — Meta + Google.
 * Tüm kayıtlı hesapları tek dropdown'da listeler. Bir hesabı seçince o platformun
 * aktif hesabı olur ve BAĞLAM-DUYARLI yönlendirir:
 *   - Çok-platformlu modül (/optimizasyon, /hedef-kitle): aynı sayfa + ?platform=X
 *     (o platformun sekmesi açılır, modülden çıkmaz)
 *   - /yoai: reload (birleşik analiz)
 *   - Sadece-Meta modül (/strateji, /meta-ads): Meta → reload; Google → /google-ads
 */
export default function MultiAccountDropdown({
  adAccounts,
  selectedAccount,
  registered,
  count,
  limit,
  remaining,
  onDisconnect,
  addAccount,
  removeAccount,
  onLimitReached,
  isAppReview,
}: Props) {
  const t = useTranslations('dashboard.meta.accounts')
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [activeGoogle, setActiveGoogle] = useState<{ customerId: string; customerName?: string } | null>(null)

  useEffect(() => {
    fetch('/api/integrations/google-ads/selected', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.selected?.customerId) setActiveGoogle({ customerId: d.selected.customerId, customerName: d.selected.customerName })
      })
      .catch(() => {})
  }, [])

  const matches = (name: string, id: string) =>
    name.toLowerCase().includes(search.toLowerCase()) || (id ?? '').toString().includes(search)

  const registeredMetaIds = new Set(registered.filter(r => r.platform === 'meta').map(r => r.account_id))
  const metaSwitchable = adAccounts.filter(a => registeredMetaIds.has(a.id) && matches(a.name, a.account_id))
  const metaAddable = adAccounts.filter(a => !registeredMetaIds.has(a.id) && matches(a.name, a.account_id))

  const googleRegistered = registered.filter(r => r.platform === 'google')
  const googleName = (acc: RegisteredAccount) =>
    (activeGoogle?.customerId === acc.account_id && activeGoogle?.customerName) ? activeGoogle.customerName
      : (acc.account_name && acc.account_name !== acc.account_id ? acc.account_name : acc.account_id)
  const googleVisible = googleRegistered.filter(a => matches(googleName(a), a.account_id))

  const atLimit = limit !== null && remaining !== null && remaining <= 0
  // Strateji ve Meta sayfası yalnız Meta hesabı kullanır → orada Google gizlenir.
  // Çok-platformlu modüller (Optimizasyon/Hedef Kitle/YoAlgoritma) ikisini de gösterir.
  const showGoogle = !['/strateji', '/meta-ads'].some(p => pathname?.startsWith(p))
  const shownCount = showGoogle ? count : registered.filter(r => r.platform === 'meta').length
  const usedLabel = t('accountsUsedUnlimited', { count: shownCount })

  // Hesap seçilince nereye gidilecek (bağlam-duyarlı). Çok-platformlu modülde
  // modülden çıkmadan ilgili sekme açılır; sadece-Meta modülde Google → Google sayfası.
  const navigateAfterSwitch = (platform: 'meta' | 'google') => {
    // Path tabanlı çok-platformlu modüller: platform/kaynak segmentini değiştir
    if (pathname?.startsWith('/hedef-kitle')) {
      window.location.href = `/hedef-kitle/${platform}`
      return
    }
    if (pathname?.startsWith('/optimizasyon')) {
      window.location.href = `/optimizasyon/${platform}`
      return
    }
    if (pathname?.startsWith('/yoalgoritma')) {
      window.location.reload()
    } else if (platform === 'google') {
      window.location.href = '/google-ads'
    } else {
      window.location.reload()
    }
  }

  // Meta geçiş: select-adaccount + active-account + cache temizliği + bağlam-duyarlı yönlendirme
  const switchMeta = async (a: AdAccount) => {
    if (selectedAccount === a.id) return
    setBusyId(a.id)
    try {
      const res = await fetch('/api/meta/select-adaccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ adAccountId: a.id }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        if (res.status === 400 && d?.message) alert(d.message)
        setBusyId(null)
        return
      }
      await fetch('/api/active-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ platform: 'meta', account_id: a.id, account_name: a.name }),
      }).catch(() => {})
      clearYoAlgoritmaClientCache()
      navigateAfterSwitch('meta')
    } catch {
      setBusyId(null)
    }
  }

  // Google geçiş: select-account + cache temizliği + bağlam-duyarlı yönlendirme
  const switchGoogle = async (acc: RegisteredAccount) => {
    if (activeGoogle?.customerId === acc.account_id) return
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
      clearYoAlgoritmaClientCache()
      navigateAfterSwitch('google')
    } catch {
      setBusyId(null)
    }
  }

  const handleAddMeta = async (a: AdAccount) => {
    if (atLimit) { onLimitReached(); return }
    setBusyId(a.id)
    const res = await addAccount({ platform: 'meta', account_id: a.id, account_name: a.name })
    setBusyId(null)
    if (!res.ok && res.error === 'limit_reached') onLimitReached()
  }

  const handleRemoveMeta = async (e: React.MouseEvent, a: AdAccount) => {
    e.stopPropagation()
    if (selectedAccount === a.id) return
    setBusyId(a.id)
    await removeAccount('meta', a.id)
    setBusyId(null)
  }

  const handleRemoveGoogle = async (e: React.MouseEvent, acc: RegisteredAccount) => {
    e.stopPropagation()
    if (activeGoogle?.customerId === acc.account_id) return
    setBusyId(acc.account_id)
    await removeAccount('google', acc.account_id)
    setBusyId(null)
  }

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
      {/* Header — başlık + toplam limit göstergesi */}
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

      <div className="max-h-64 overflow-y-auto">
        {/* Meta hesapları */}
        <div className="px-3 pt-2 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('metaAccounts')}</p>
        </div>
        {metaSwitchable.map(a => {
          const active = selectedAccount === a.id
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => switchMeta(a)}
              disabled={busyId === a.id}
              className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between ${active ? 'bg-green-50' : ''}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                <p className="text-caption text-gray-500 font-mono">ID: {a.account_id}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {active && <div className="w-2 h-2 bg-green-500 rounded-full" />}
                {busyId === a.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                {!active && busyId !== a.id && (
                  <span onClick={e => handleRemoveMeta(e, a)} title={t('remove')} className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </button>
          )
        })}
        {metaSwitchable.length === 0 && <p className="px-4 py-2 text-sm text-gray-400">—</p>}

        {/* Google hesapları (yalnız Google kullanan modüllerde) */}
        {showGoogle && googleVisible.length > 0 && (
          <>
            <div className="px-3 pt-3 pb-1 border-t border-gray-100">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('googleAccounts')}</p>
            </div>
            {googleVisible.map(acc => {
              const active = activeGoogle?.customerId === acc.account_id
              return (
                <button
                  key={acc.account_id}
                  type="button"
                  onClick={() => switchGoogle(acc)}
                  disabled={busyId === acc.account_id}
                  className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between ${active ? 'bg-green-50' : ''}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{googleName(acc)}</p>
                    <p className="text-caption text-gray-500 font-mono">ID: {acc.account_id}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {active && <div className="w-2 h-2 bg-green-500 rounded-full" />}
                    {busyId === acc.account_id && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                    {!active && busyId !== acc.account_id && (
                      <span onClick={e => handleRemoveGoogle(e, acc)} title={t('remove')} className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </>
        )}
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
            <button type="button" onClick={onLimitReached} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              {t('viewPlans')} <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {!atLimit && showAdd && (
          <div className="max-h-40 overflow-y-auto pb-1">
            {metaAddable.map(a => (
              <button key={a.id} type="button" onClick={() => handleAddMeta(a)} disabled={busyId === a.id} className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 truncate">{a.name}</p>
                  <p className="text-caption text-gray-400 font-mono">Meta · ID: {a.account_id}</p>
                </div>
                {busyId === a.id ? <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" /> : <Plus className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
            {metaAddable.length === 0 && <p className="px-4 py-2 text-sm text-gray-400">{t('noMoreToAdd')}</p>}
            {showGoogle && (
              <button type="button" onClick={() => router.push('/google-ads')} className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between border-t border-gray-100 mt-1 pt-2">
                <span className="text-sm text-gray-700">{t('addGoogleAccount')}</span>
                <ArrowUpRight className="w-4 h-4 text-primary shrink-0" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bağlantıyı kes (Meta) */}
      <div className="p-3 border-t border-gray-200">
        <button onClick={onDisconnect} className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">
          {isAppReview ? 'Disconnect' : t('disconnect')}
        </button>
      </div>
    </div>
  )
}
