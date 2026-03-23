/**
 * Single-module persistence for Meta/Facebook OAuth connections.
 * Mirrors googleAdsConnectionStore.ts pattern.
 * All DB access for access token and metadata is isolated here.
 *
 * Security: Never expose access_token to client or logs.
 */

import { supabase } from '@/lib/supabase/client'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Mask token for any log output. Never log full token. */
export function maskToken(token: string | null): string {
  if (!token || token.length < 8) return '[redacted]'
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

function shortUser(userId: string): string {
  return userId.slice(0, 8) + '…'
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type MetaConnectionStatus = 'active' | 'revoked' | 'error' | 'expired'

export interface MetaConnectionRow {
  id: string
  user_id: string
  provider: string
  access_token: string | null
  access_expires_at: string | null
  token_type: string | null
  scopes: string | null
  selected_ad_account_id: string | null
  selected_business_id: string | null
  status: MetaConnectionStatus
  last_error: string | null
  last_health_check_at: string | null
  last_selected_at: string | null
  created_at: string
  updated_at: string
}

export interface MetaConnectionContext {
  accessToken: string
  expiresAt: number | null        // unix ms
  tokenType: 'long_lived' | 'short_lived' | 'unknown'
  selectedAdAccountId: string | null
  status: MetaConnectionStatus
}

/* ------------------------------------------------------------------ */
/*  Read                                                               */
/* ------------------------------------------------------------------ */

/**
 * Get active Meta connection for user. Returns null if none, revoked, or DB unavailable.
 */
export async function getMetaConnection(userId: string): Promise<MetaConnectionContext | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('meta_connections')
    .select('access_token, access_expires_at, token_type, selected_ad_account_id, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    console.error('[MetaConnectionStore] DB_LOOKUP_ERROR', { user: shortUser(userId), message: error.message })
    return null
  }

  if (!data?.access_token) {
    return null
  }

  const expiresAt = data.access_expires_at
    ? new Date(data.access_expires_at).getTime()
    : null

  // If token is expired, mark as expired and return null
  if (expiresAt && Date.now() >= expiresAt) {
    // Fire-and-forget status update
    updateMetaConnectionHealth(userId, 'expired', 'token_expired').catch(() => {})
    return null
  }

  return {
    accessToken: data.access_token,
    expiresAt,
    tokenType: (data.token_type as MetaConnectionContext['tokenType']) || 'unknown',
    selectedAdAccountId: data.selected_ad_account_id,
    status: data.status as MetaConnectionStatus,
  }
}

/* ------------------------------------------------------------------ */
/*  Write                                                              */
/* ------------------------------------------------------------------ */

export interface UpsertMetaConnectionInput {
  accessToken?: string
  expiresAt?: number       // unix ms
  tokenType?: 'long_lived' | 'short_lived' | 'unknown'
  scopes?: string
  selectedAdAccountId?: string | null
  status?: MetaConnectionStatus
}

/**
 * Upsert Meta connection for user. Idempotent.
 * Does not wipe token if accessToken is absent (preserves existing on partial updates).
 */
export async function upsertMetaConnection(userId: string, input: UpsertMetaConnectionInput): Promise<boolean> {
  if (!supabase) {
    console.log('[MetaConnectionStore] UPSERT_FAIL supabase client null')
    return false
  }

  const { data: existing } = await supabase
    .from('meta_connections')
    .select('id, access_token')
    .eq('user_id', userId)
    .maybeSingle()

  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    user_id: userId,
    provider: 'meta',
    updated_at: now,
  }

  // Status logic
  if (input.status !== undefined) {
    payload.status = input.status
  } else if (input.accessToken) {
    payload.status = 'active'
  }

  if (input.accessToken) {
    payload.access_token = input.accessToken
  } else if (existing) {
    payload.access_token = (existing as { access_token?: string }).access_token
  }

  if (input.expiresAt !== undefined) {
    payload.access_expires_at = new Date(input.expiresAt).toISOString()
  }

  if (input.tokenType !== undefined) {
    payload.token_type = input.tokenType
  }

  if (input.scopes !== undefined) {
    payload.scopes = input.scopes
  }

  if (input.selectedAdAccountId !== undefined) {
    payload.selected_ad_account_id = input.selectedAdAccountId
    payload.last_selected_at = now
  }

  if (existing) {
    const { error } = await supabase
      .from('meta_connections')
      .update(payload)
      .eq('user_id', userId)
    if (error) {
      console.error('[MetaConnectionStore] UPSERT_UPDATE_FAIL', { user: shortUser(userId), message: error.message })
      return false
    }
    console.log('[MetaConnectionStore] UPSERT_OK', { user: shortUser(userId), op: 'update' })
    return true
  }

  // Insert
  payload.created_at = now
  if (!payload.access_token) {
    console.warn('[MetaConnectionStore] INSERT_NO_TOKEN', { user: shortUser(userId) })
    return false
  }

  const { error } = await supabase.from('meta_connections').insert(payload)
  if (error) {
    console.error('[MetaConnectionStore] INSERT_FAIL', { user: shortUser(userId), message: error.message })
    return false
  }
  console.log('[MetaConnectionStore] UPSERT_OK', { user: shortUser(userId), op: 'insert' })
  return true
}

/* ------------------------------------------------------------------ */
/*  Selected Ad Account                                                */
/* ------------------------------------------------------------------ */

/**
 * Update selected ad account in DB. Does not touch cookies.
 */
export async function updateSelectedMetaAdAccount(
  userId: string,
  adAccountId: string | null
): Promise<boolean> {
  if (!supabase) return false

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('meta_connections')
    .update({
      selected_ad_account_id: adAccountId,
      last_selected_at: now,
      updated_at: now,
    })
    .eq('user_id', userId)

  if (error) {
    console.error('[MetaConnectionStore] SELECT_ACCOUNT_FAIL', { user: shortUser(userId), message: error.message })
    return false
  }
  return true
}

/* ------------------------------------------------------------------ */
/*  Revoke / Disconnect                                                */
/* ------------------------------------------------------------------ */

/**
 * Revoke connection (mark status=revoked, clear token). Reconnect-safe.
 */
export async function revokeMetaConnection(userId: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase
    .from('meta_connections')
    .update({
      status: 'revoked',
      access_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (!error) {
    console.log('[MetaConnectionStore] REVOKE_OK', { user: shortUser(userId) })
  }
}

/* ------------------------------------------------------------------ */
/*  Health                                                             */
/* ------------------------------------------------------------------ */

/**
 * Update health status for Meta connection.
 */
export async function updateMetaConnectionHealth(
  userId: string,
  status: MetaConnectionStatus,
  lastError?: string | null
): Promise<void> {
  if (!supabase) return

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('meta_connections')
    .update({
      status,
      last_error: lastError ?? null,
      last_health_check_at: now,
      updated_at: now,
    })
    .eq('user_id', userId)

  if (error) {
    console.error('[MetaConnectionStore] HEALTH_UPDATE_FAIL', { user: shortUser(userId), message: error.message })
  }
}

/**
 * Get raw connection row for health endpoint (no token exposed).
 */
export async function getMetaConnectionForHealth(userId: string): Promise<{
  connected: boolean
  status: MetaConnectionStatus | null
  selectedAdAccountId: string | null
  tokenType: string | null
  expiresAt: number | null
  needsReconnect: boolean
  lastError: string | null
  lastHealthCheckAt: string | null
  source: 'db'
} | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('meta_connections')
    .select('status, access_expires_at, token_type, selected_ad_account_id, last_error, last_health_check_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null

  const expiresAt = data.access_expires_at
    ? new Date(data.access_expires_at).getTime()
    : null

  const isExpired = expiresAt ? Date.now() >= expiresAt : false
  const isActive = data.status === 'active' && !isExpired

  return {
    connected: isActive,
    status: data.status as MetaConnectionStatus,
    selectedAdAccountId: data.selected_ad_account_id,
    tokenType: data.token_type,
    expiresAt,
    needsReconnect: !isActive,
    lastError: data.last_error,
    lastHealthCheckAt: data.last_health_check_at,
    source: 'db',
  }
}
