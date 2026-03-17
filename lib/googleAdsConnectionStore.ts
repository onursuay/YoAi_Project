/**
 * Single-module persistence for Google Ads OAuth connections.
 * All DB access for refresh token and metadata is isolated here.
 *
 * Security: Never expose refresh_token to client or logs.
 * TODO: Add at-rest encryption in upsertConnection/getConnection - use GOOGLE_ADS_TOKEN_SECRET
 * with AES-256-GCM (see lib/meta/crypto.ts pattern). Until then tokens stored plain.
 */

import { supabase } from '@/lib/supabase/client'
import { LOG_EVENTS } from '@/lib/google-ads/constants'

/** Mask token for any log output. Never log full token. */
export function maskToken(token: string | null): string {
  if (!token || token.length < 8) return '[redacted]'
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

export type ConnectionStatus = 'active' | 'revoked' | 'error'

export interface GoogleAdsConnectionRow {
  id: string
  user_id: string
  provider: string
  google_ads_refresh_token: string | null
  google_ads_customer_id: string | null
  google_ads_login_customer_id: string | null
  token_scope: string | null
  connected_email: string | null
  status: ConnectionStatus
  created_at: string
  updated_at: string
  last_connected_at: string | null
}

export interface GoogleAdsConnectionContext {
  refreshToken: string
  customerId: string
  loginCustomerId: string
}

/**
 * Get active connection for user. Returns null if none or revoked.
 */
export async function getConnection(userId: string): Promise<GoogleAdsConnectionContext | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('google_ads_connections')
    .select('google_ads_refresh_token, google_ads_customer_id, google_ads_login_customer_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    console.error(LOG_EVENTS.DB_LOOKUP_MISS, { userId: userId.slice(0, 8) + '…', reason: 'db_error', message: error.message })
    return null
  }

  const row = data as { google_ads_refresh_token: string | null; google_ads_customer_id: string | null; google_ads_login_customer_id: string | null } | null
  if (!row?.google_ads_refresh_token) {
    console.log(LOG_EVENTS.DB_LOOKUP_MISS, { userId: userId.slice(0, 8) + '…', reason: 'no_token_or_account' })
    return null
  }

  console.log(LOG_EVENTS.DB_LOOKUP_OK, { userId: userId.slice(0, 8) + '…' })

  const customerId = row.google_ads_customer_id?.replace(/-/g, '').trim()
  if (!customerId) return null

  const loginCustomerId = (row.google_ads_login_customer_id || customerId).replace(/-/g, '')

  return {
    refreshToken: row.google_ads_refresh_token,
    customerId,
    loginCustomerId,
  }
}

export interface UpsertConnectionInput {
  refreshToken?: string
  customerId?: string
  loginCustomerId?: string
  tokenScope?: string
  connectedEmail?: string
  status?: ConnectionStatus
}

/**
 * Upsert connection for user. Idempotent. Does not wipe token if refresh_token
 * is absent (preserves existing token on partial updates).
 */
export async function upsertConnection(userId: string, input: UpsertConnectionInput): Promise<boolean> {
  if (!supabase) {
    console.log('GOOGLE_ADS_DB_UPSERT_FAIL supabase client null (missing SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY)')
    return false
  }

  const { data: existing } = await supabase
    .from('google_ads_connections')
    .select('id, google_ads_refresh_token, google_ads_customer_id, google_ads_login_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    user_id: userId,
    provider: 'google_ads',
    updated_at: now,
    last_connected_at: now,
  }

  if (input.status !== undefined) payload.status = input.status
  else if (input.refreshToken !== undefined && input.refreshToken !== '') {
    payload.status = 'active'
  }
  if (input.tokenScope !== undefined) payload.token_scope = input.tokenScope
  if (input.connectedEmail !== undefined) payload.connected_email = input.connectedEmail

  if (input.refreshToken !== undefined && input.refreshToken !== '') {
    payload.google_ads_refresh_token = input.refreshToken
  } else if (existing) {
    payload.google_ads_refresh_token = (existing as { google_ads_refresh_token?: string }).google_ads_refresh_token
  }

  if (input.customerId !== undefined && input.customerId !== '') {
    payload.google_ads_customer_id = input.customerId.replace(/-/g, '')
  } else if (existing) {
    payload.google_ads_customer_id = (existing as { google_ads_customer_id?: string }).google_ads_customer_id
  }

  if (input.loginCustomerId !== undefined && input.loginCustomerId !== '') {
    payload.google_ads_login_customer_id = input.loginCustomerId.replace(/-/g, '')
  } else if (existing) {
    const prev = (existing as { google_ads_login_customer_id?: string; google_ads_customer_id?: string })
    payload.google_ads_login_customer_id = prev.google_ads_login_customer_id ?? prev.google_ads_customer_id
  }

  if (existing) {
    const { error } = await supabase
      .from('google_ads_connections')
      .update(payload)
      .eq('user_id', userId)
    if (error) {
      console.error(LOG_EVENTS.DB_LOOKUP_MISS, { userId: userId.slice(0, 8) + '…', reason: 'upsert_update_failed', message: error.message })
      return false
    }
    console.log(LOG_EVENTS.DB_UPSERT_OK, { userId: userId.slice(0, 8) + '…', op: 'update' })
    return true
  }

  payload.created_at = now
  if (!payload.google_ads_refresh_token) {
    console.warn(LOG_EVENTS.DB_LOOKUP_MISS, { userId: userId.slice(0, 8) + '…', reason: 'insert_no_token' })
    return false
  }

  const { error } = await supabase.from('google_ads_connections').insert(payload)
  if (error) {
    console.error(LOG_EVENTS.DB_LOOKUP_MISS, { userId: userId.slice(0, 8) + '…', reason: 'insert_failed', message: error.message })
    return false
  }
  console.log(LOG_EVENTS.DB_UPSERT_OK, { userId: userId.slice(0, 8) + '…', op: 'insert' })
  return true
}

/**
 * Revoke connection (mark status=revoked, clear token).
 */
export async function revokeConnection(userId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('google_ads_connections')
    .update({
      status: 'revoked',
      google_ads_refresh_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  if (!error) {
    console.log(LOG_EVENTS.DISCONNECT_OK, { userId: userId.slice(0, 8) + '…' })
  }
}

/**
 * Get first active connection (for admin/cron when no session).
 */
export async function getFirstActiveConnection(): Promise<GoogleAdsConnectionContext | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('google_ads_connections')
    .select('google_ads_refresh_token, google_ads_customer_id, google_ads_login_customer_id')
    .eq('status', 'active')
    .not('google_ads_refresh_token', 'is', null)
    .not('google_ads_customer_id', 'is', null)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.log(LOG_EVENTS.DB_LOOKUP_MISS, { source: 'first_active', reason: 'db_error', message: error.message })
    return null
  }

  const row = data as { google_ads_refresh_token: string; google_ads_customer_id: string; google_ads_login_customer_id: string | null } | null
  if (!row?.google_ads_refresh_token || !row.google_ads_customer_id) return null

  console.log(LOG_EVENTS.ADMIN_CONTEXT_DB, { source: 'first_active' })
  return {
    refreshToken: row.google_ads_refresh_token,
    customerId: row.google_ads_customer_id.replace(/-/g, ''),
    loginCustomerId: (row.google_ads_login_customer_id || row.google_ads_customer_id).replace(/-/g, ''),
  }
}
