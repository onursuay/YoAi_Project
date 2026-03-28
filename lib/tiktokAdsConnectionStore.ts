/**
 * Single-module persistence for TikTok Ads OAuth connections.
 * All DB access for access token and metadata is isolated here.
 *
 * Security: Never expose access_token to client or logs.
 */

import { supabase } from '@/lib/supabase/client'
import { LOG_EVENTS } from '@/lib/tiktok-ads/constants'

/** Mask token for any log output. Never log full token. */
export function maskToken(token: string | null): string {
  if (!token || token.length < 8) return '[redacted]'
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

export type TikTokConnectionStatus = 'active' | 'revoked' | 'error' | 'expired'

export interface TikTokConnectionRow {
  id: string
  user_id: string
  provider: string
  access_token: string | null
  access_expires_at: string | null
  advertiser_id: string | null
  advertiser_name: string | null
  token_scope: string | null
  status: TikTokConnectionStatus
  created_at: string
  updated_at: string
}

export interface TikTokConnectionContext {
  accessToken: string
  advertiserId: string
  advertiserName?: string
}

/**
 * Get active connection for user. Returns null if none or revoked/expired.
 */
export async function getConnection(userId: string): Promise<TikTokConnectionContext | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('tiktok_ads_connections')
    .select('access_token, access_expires_at, advertiser_id, advertiser_name')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    console.error(LOG_EVENTS.DB_LOOKUP_MISS, { userId: userId.slice(0, 8) + '…', reason: 'db_error', message: error.message })
    return null
  }

  const row = data as { access_token: string | null; access_expires_at: string | null; advertiser_id: string | null; advertiser_name: string | null } | null
  if (!row?.access_token) {
    console.log(LOG_EVENTS.DB_LOOKUP_MISS, { userId: userId.slice(0, 8) + '…', reason: 'no_token' })
    return null
  }

  // Check token expiry
  if (row.access_expires_at) {
    const expiresAt = new Date(row.access_expires_at).getTime()
    if (Date.now() > expiresAt) {
      console.log(LOG_EVENTS.DB_LOOKUP_MISS, { userId: userId.slice(0, 8) + '…', reason: 'token_expired' })
      return null
    }
  }

  console.log(LOG_EVENTS.DB_LOOKUP_OK, { userId: userId.slice(0, 8) + '…' })

  return {
    accessToken: row.access_token,
    advertiserId: row.advertiser_id || '',
    advertiserName: row.advertiser_name || undefined,
  }
}

export interface UpsertConnectionInput {
  accessToken?: string
  expiresAt?: number // timestamp ms
  advertiserId?: string
  advertiserName?: string
  tokenScope?: string
  status?: TikTokConnectionStatus
}

/**
 * Upsert connection for user. Idempotent.
 */
export async function upsertConnection(userId: string, input: UpsertConnectionInput): Promise<boolean> {
  if (!supabase) {
    console.log('TIKTOK_ADS_DB_UPSERT_FAIL supabase client null')
    return false
  }

  const { data: existing } = await supabase
    .from('tiktok_ads_connections')
    .select('id, access_token, advertiser_id')
    .eq('user_id', userId)
    .maybeSingle()

  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    user_id: userId,
    provider: 'tiktok_ads',
    updated_at: now,
  }

  if (input.status !== undefined) payload.status = input.status
  else if (input.accessToken !== undefined && input.accessToken !== '') {
    payload.status = 'active'
  }
  if (input.tokenScope !== undefined) payload.token_scope = input.tokenScope

  if (input.accessToken !== undefined && input.accessToken !== '') {
    payload.access_token = input.accessToken
  } else if (existing) {
    payload.access_token = (existing as { access_token?: string }).access_token
  }

  if (input.expiresAt !== undefined) {
    payload.access_expires_at = new Date(input.expiresAt).toISOString()
  }

  if (input.advertiserId !== undefined && input.advertiserId !== '') {
    payload.advertiser_id = input.advertiserId
  } else if (existing) {
    payload.advertiser_id = (existing as { advertiser_id?: string }).advertiser_id
  }

  if (input.advertiserName !== undefined) {
    payload.advertiser_name = input.advertiserName
  }

  if (existing) {
    const { error } = await supabase
      .from('tiktok_ads_connections')
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
  if (!payload.access_token) {
    console.warn(LOG_EVENTS.DB_LOOKUP_MISS, { userId: userId.slice(0, 8) + '…', reason: 'insert_no_token' })
    return false
  }

  const { error } = await supabase.from('tiktok_ads_connections').insert(payload)
  if (error) {
    console.error(LOG_EVENTS.DB_LOOKUP_MISS, { userId: userId.slice(0, 8) + '…', reason: 'insert_failed', message: error.message })
    return false
  }
  console.log(LOG_EVENTS.DB_UPSERT_OK, { userId: userId.slice(0, 8) + '…', op: 'insert' })
  return true
}

/**
 * Update selected advertiser for user.
 */
export async function updateSelectedAdvertiser(userId: string, advertiserId: string, advertiserName?: string): Promise<boolean> {
  if (!supabase) return false
  const payload: Record<string, unknown> = {
    advertiser_id: advertiserId,
    updated_at: new Date().toISOString(),
  }
  if (advertiserName !== undefined) payload.advertiser_name = advertiserName

  const { error } = await supabase
    .from('tiktok_ads_connections')
    .update(payload)
    .eq('user_id', userId)
  return !error
}

/**
 * Check raw connection status.
 */
export async function getConnectionStatus(userId: string): Promise<{
  exists: boolean
  hasToken: boolean
  advertiserId: string | null
  advertiserName: string | null
}> {
  if (!supabase) return { exists: false, hasToken: false, advertiserId: null, advertiserName: null }
  const { data, error } = await supabase
    .from('tiktok_ads_connections')
    .select('status, access_token, advertiser_id, advertiser_name')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return { exists: false, hasToken: false, advertiserId: null, advertiserName: null }
  return {
    exists: true,
    hasToken: data.status === 'active' && !!data.access_token,
    advertiserId: data.advertiser_id || null,
    advertiserName: data.advertiser_name || null,
  }
}

/**
 * Revoke connection (mark status=revoked, clear token).
 */
export async function revokeConnection(userId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('tiktok_ads_connections')
    .update({
      status: 'revoked',
      access_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  if (!error) {
    console.log(LOG_EVENTS.DISCONNECT_OK, { userId: userId.slice(0, 8) + '…' })
  }
}
