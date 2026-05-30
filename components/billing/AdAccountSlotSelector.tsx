'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Lock, X, Loader2, CheckCircle2 } from 'lucide-react'
import WizardSelect from '@/components/meta/wizard/WizardSelect'

interface Account {
  id: string
  name: string
}

interface ServerSlot {
  platform: 'meta' | 'google_ads'
  account_id: string
  account_name: string | null
  slot_index: number
}

interface Props {
  platform: 'meta' | 'google_ads'
  /** Hesap değişimi sonrası parent'ı haberdar et (örn. kampanyaları yenile). */
  onActiveAccountChanged?: () => void
}

const TEASER_LOCKED_SLOT = 1 // tier limitini aşan EK bir slot daha göster (kilitli)

/**
 * 2-slot (tier'a göre N-slot) hesap seçici. /meta-ads ve /google-ads sayfalarının
 * tepesine konur. Mevcut /api/meta/select-adaccount + /api/integrations/google-ads/
 * select-account akışlarını DOKUNMADAN kullanır; ek olarak user_selected_ad_accounts
 * tablosuna paralel kaydeder. Slot 1 = aktif hesap (mirror edilir).
 *
 * Tier limitini aşan slot'lar görünür ama kilitli (uyarı yok, donuk).
 */
export default function AdAccountSlotSelector({ platform, onActiveAccountChanged }: Props) {
  const t = useTranslations('marketingSetup.connect')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [slots, setSlots] = useState<ServerSlot[]>([])
  const [maxSlots, setMaxSlots] = useState(2)
  const [loading, setLoading] = useState(true)
  const [savingSlot, setSavingSlot] = useState<number | null>(null)

  const accountsUrl =
    platform === 'meta' ? '/api/meta/adaccounts' : '/api/integrations/google-ads/accounts'

  const refetchAll = useCallback(async () => {
    const [accRes, slotRes] = await Promise.all([
      fetch(accountsUrl, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/billing/ad-account-slots', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
    if (accRes) {
      if (platform === 'meta') {
        const list = (accRes.accounts ?? []) as { id: string; name?: string }[]
        setAccounts(list.map((a) => ({ id: a.id, name: a.name || a.id })))
      } else {
        const list = (accRes.customers ?? []) as { customerId: string; name?: string }[]
        setAccounts(
          list.map((c) => ({
            id: c.customerId,
            name: c.name || `Account ${c.customerId}`,
          })),
        )
      }
    }
    if (slotRes) {
      const ss = (slotRes.slots ?? []) as ServerSlot[]
      setSlots(ss.filter((s) => s.platform === platform))
      setMaxSlots(slotRes.maxSlots ?? 2)
    }
  }, [accountsUrl, platform])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    refetchAll().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [refetchAll])

  // Slot dolulukları
  const slotByIndex = new Map<number, ServerSlot>()
  for (const s of slots) slotByIndex.set(s.slot_index, s)
  const usedAccountIds = new Set(slots.map((s) => s.account_id))

  // Görünür slot sayısı = maxSlots + 1 ek kilitli (enterprise'da kilitli slot yok)
  const visibleSlotCount =
    maxSlots >= 20 ? maxSlots : maxSlots + TEASER_LOCKED_SLOT

  async function changeSlot(slotIndex: number, accountId: string) {
    if (slotIndex > maxSlots) return // kilitli slot — uyarı yok
    if (!accountId) return
    setSavingSlot(slotIndex)
    try {
      const acc = accounts.find((a) => a.id === accountId)
      // 1) Yeni slot tablosuna kaydet
      await fetch('/api/billing/ad-account-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          slotIndex,
          accountId,
          accountName: acc?.name ?? null,
        }),
      })
      // 2) Slot 1 değiştiyse mevcut select-account endpoint'lerini de çağır
      //    (aktif hesap mirror'ı — mevcut Meta/Google kodu bunu okur).
      if (slotIndex === 1) {
        if (platform === 'meta') {
          await fetch('/api/meta/select-adaccount', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adAccountId: accountId }),
          })
        } else {
          await fetch('/api/integrations/google-ads/select-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId: accountId, loginCustomerId: accountId }),
          })
        }
      }
      await refetchAll()
      if (slotIndex === 1) onActiveAccountChanged?.()
    } finally {
      setSavingSlot(null)
    }
  }

  async function removeSlot(slotIndex: number) {
    if (slotIndex === 1) return // slot 1 (aktif) doğrudan kaldırılmaz — disconnect ayrı akış
    setSavingSlot(slotIndex)
    try {
      await fetch('/api/billing/ad-account-slots', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, slotIndex }),
      })
      await refetchAll()
    } finally {
      setSavingSlot(null)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
        <div className="inline-flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('slotsLoading')}
        </div>
      </div>
    )
  }

  // Hiç hesap yoksa (bağlanmamış) bu komponent görünmez kalır
  if (accounts.length === 0) return null

  const usedCount = slots.length

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">{t('slotsTitle')}</h3>
          <p className="mt-1 text-xs text-gray-500">{t('slotsSubtitle')}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          {t('slotsCount', { used: usedCount, max: maxSlots })}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: visibleSlotCount }, (_, i) => {
          const slotIndex = i + 1
          const slot = slotByIndex.get(slotIndex)
          const isActive = slotIndex === 1
          const isLocked = slotIndex > maxSlots
          const isSaving = savingSlot === slotIndex
          // Bu dropdown için seçilebilir hesaplar: tüm hesaplar - diğer slot'larda olanlar
          // (kendi slot'undaki hesap dropdown'da görünür ki kullanıcı görebilsin)
          const availableForThisSlot = accounts.filter(
            (a) => !usedAccountIds.has(a.id) || a.id === slot?.account_id,
          )
          return (
            <div
              key={slotIndex}
              className={`flex flex-col rounded-xl border p-4 transition-all ${
                isLocked
                  ? 'border-gray-200 bg-gray-50/60 opacity-60'
                  : slot
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-dashed border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  {isLocked && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                  {!isLocked && slot && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>
                    {t('slotLabel', { n: slotIndex })}
                    {isActive && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        {t('slotActive')}
                      </span>
                    )}
                  </span>
                </div>
                {!isLocked && !isActive && slot && (
                  <button
                    type="button"
                    onClick={() => void removeSlot(slotIndex)}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    title={t('slotRemove')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {isLocked ? (
                <div className="flex items-center justify-between text-xs text-gray-400 py-2 px-1">
                  <span>{t('slotTierLocked')}</span>
                </div>
              ) : (
                <WizardSelect
                  value={slot?.account_id ?? ''}
                  onChange={(v) => void changeSlot(slotIndex, v)}
                  placeholder={t('slotPickAccount')}
                  disabled={isSaving}
                  options={availableForThisSlot.map((a) => ({
                    value: a.id,
                    label: a.name === a.id ? a.id : `${a.name} (${a.id})`,
                  }))}
                />
              )}

              {isSaving && (
                <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-gray-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t('switchingAccount')}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
