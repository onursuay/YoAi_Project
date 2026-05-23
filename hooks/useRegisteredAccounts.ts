'use client'

import { useState, useEffect, useCallback } from 'react'

export type AdPlatform = 'meta' | 'google'

export interface RegisteredAccount {
  id: string
  user_id: string
  platform: AdPlatform
  account_id: string
  account_name: string | null
  login_customer_id: string | null
}

export interface AddAccountInput {
  platform: AdPlatform
  account_id: string
  account_name?: string | null
  login_customer_id?: string | null
}

export interface AddAccountResult {
  ok: boolean
  alreadyRegistered?: boolean
  /** 'limit_reached' → plan limiti doldu (UI AccessRequiredModal gösterir). */
  error?: string
  count?: number
  limit?: number
  message?: string
}

interface State {
  enabled: boolean
  /** YoAlgoritma işletme-scope modu açık mı (YOAI_PER_ACCOUNT_SCOPE). */
  perAccountScope: boolean
  accounts: RegisteredAccount[]
  count: number
  limit: number | null // null = sınırsız (owner)
  remaining: number | null
  loading: boolean
}

/**
 * Çoklu Reklam Hesabı (Madde 2) — kayıtlı set + limit istemci hook'u.
 * `/api/account/registered` ile konuşur. Flag kapalıyken `enabled:false` döner;
 * UI bu durumda mevcut tek-hesap davranışını gösterir.
 */
export function useRegisteredAccounts() {
  const [state, setState] = useState<State>({
    enabled: false,
    perAccountScope: false,
    accounts: [],
    count: 0,
    limit: 0,
    remaining: 0,
    loading: true,
  })

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/account/registered', { credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (data?.ok) {
        setState({
          enabled: !!data.enabled,
          perAccountScope: !!data.perAccountScope,
          accounts: Array.isArray(data.accounts) ? data.accounts : [],
          count: data.count ?? 0,
          limit: data.limit ?? null,
          remaining: data.remaining ?? null,
          loading: false,
        })
        return
      }
    } catch { /* sessiz — flag kapalı/oturum yok */ }
    setState(s => ({ ...s, loading: false }))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addAccount = useCallback(
    async (input: AddAccountInput): Promise<AddAccountResult> => {
      try {
        const res = await fetch('/api/account/registered', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(input),
        })
        const data = await res.json().catch(() => ({}))
        if (data?.ok) {
          await refresh()
          return { ok: true, alreadyRegistered: !!data.alreadyRegistered }
        }
        return { ok: false, error: data?.error ?? 'unknown', count: data?.count, limit: data?.limit, message: data?.message }
      } catch {
        return { ok: false, error: 'network_error' }
      }
    },
    [refresh],
  )

  const removeAccount = useCallback(
    async (platform: AdPlatform, accountId: string): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/account/registered?platform=${platform}&account_id=${encodeURIComponent(accountId)}`,
          { method: 'DELETE', credentials: 'include' },
        )
        const data = await res.json().catch(() => ({}))
        if (data?.ok) await refresh()
        return !!data?.ok
      } catch {
        return false
      }
    },
    [refresh],
  )

  return { ...state, refresh, addAccount, removeAccount }
}
