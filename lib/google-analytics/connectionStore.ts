/**
 * Persistence for Google Analytics OAuth connections.
 * Mirrors googleAdsConnectionStore.ts pattern.
 */

import { supabase } from '@/lib/supabase/client'

export type GAConnectionStatus = 'active' | 'revoked' | 'error'

export interface GAConnectionRow {
  id: string
  user_id: string
  refresh_token: string | null
  selected_property_id: string | null
  selected_property_name: string | null
  account_id: string | null
  connected_email: string | null
  status: GAConnectionStatus
  last_sync_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface GAConnectionContext {
  refreshToken: string
  propertyId: string | null
  propertyName: string | null
}

export async function getGAConnection(userId: string): Promise<GAConnectionContext | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('google_analytics_connections')
    .select('refresh_token, selected_property_id, selected_property_name')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data?.refresh_token) return null
  return {
    refreshToken: data.refresh_token,
    propertyId: data.selected_property_id,
    propertyName: data.selected_property_name,
  }
}

export async function getGAConnectionStatus(userId: string): Promise<{
  connected: boolean
  propertyId: string | null
  propertyName: string | null
  lastSyncAt: string | null
  error: string | null
}> {
  if (!supabase) return { connected: false, propertyId: null, propertyName: null, lastSyncAt: null, error: null }
  const { data, error } = await supabase
    .from('google_analytics_connections')
    .select('status, refresh_token, selected_property_id, selected_property_name, last_sync_at, last_error')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return { connected: false, propertyId: null, propertyName: null, lastSyncAt: null, error: null }
  return {
    connected: data.status === 'active' && !!data.refresh_token,
    propertyId: data.selected_property_id,
    propertyName: data.selected_property_name,
    lastSyncAt: data.last_sync_at,
    error: data.last_error,
  }
}

export interface UpsertGAConnectionInput {
  refreshToken?: string
  tokenScope?: string
  connectedEmail?: string
  selectedPropertyId?: string
  selectedPropertyName?: string
  accountId?: string
  status?: GAConnectionStatus
  lastSyncAt?: string
  lastError?: string | null
}

export async function upsertGAConnection(userId: string, input: UpsertGAConnectionInput): Promise<boolean> {
  if (!supabase) return false

  const { data: existing } = await supabase
    .from('google_analytics_connections')
    .select('id, refresh_token')
    .eq('user_id', userId)
    .maybeSingle()

  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    user_id: userId,
    provider: 'google_analytics',
    updated_at: now,
  }

  if (input.status !== undefined) payload.status = input.status
  else if (input.refreshToken) payload.status = 'active'

  if (input.refreshToken) payload.refresh_token = input.refreshToken
  else if (existing) payload.refresh_token = (existing as { refresh_token?: string }).refresh_token

  if (input.tokenScope !== undefined) payload.token_scope = input.tokenScope
  if (input.connectedEmail !== undefined) payload.connected_email = input.connectedEmail
  if (input.selectedPropertyId !== undefined) payload.selected_property_id = input.selectedPropertyId
  if (input.selectedPropertyName !== undefined) payload.selected_property_name = input.selectedPropertyName
  if (input.accountId !== undefined) payload.account_id = input.accountId
  if (input.lastSyncAt !== undefined) payload.last_sync_at = input.lastSyncAt
  if (input.lastError !== undefined) payload.last_error = input.lastError

  if (existing) {
    const { error } = await supabase
      .from('google_analytics_connections')
      .update(payload)
      .eq('user_id', userId)
    if (error) {
      console.error('GA_DB_UPDATE_FAIL', error.message)
      return false
    }
    return true
  }

  payload.created_at = now
  if (!payload.refresh_token) return false

  const { error } = await supabase.from('google_analytics_connections').insert(payload)
  if (error) {
    console.error('GA_DB_INSERT_FAIL', error.message)
    return false
  }
  return true
}

export async function revokeGAConnection(userId: string): Promise<void> {
  if (!supabase) return
  await supabase
    .from('google_analytics_connections')
    .update({ status: 'revoked', refresh_token: null, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
}
