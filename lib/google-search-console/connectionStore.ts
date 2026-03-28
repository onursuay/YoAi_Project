/**
 * Persistence for Google Search Console OAuth connections.
 * Mirrors googleAdsConnectionStore.ts pattern.
 */

import { supabase } from '@/lib/supabase/client'

export type GSCConnectionStatus = 'active' | 'revoked' | 'error'

export interface GSCConnectionContext {
  refreshToken: string
  siteUrl: string | null
  siteName: string | null
}

export async function getGSCConnection(userId: string): Promise<GSCConnectionContext | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('google_search_console_connections')
    .select('refresh_token, selected_site_url, selected_site_name')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data?.refresh_token) return null
  return {
    refreshToken: data.refresh_token,
    siteUrl: data.selected_site_url,
    siteName: data.selected_site_name,
  }
}

export async function getGSCConnectionStatus(userId: string): Promise<{
  connected: boolean
  siteUrl: string | null
  siteName: string | null
  lastSyncAt: string | null
  error: string | null
}> {
  if (!supabase) return { connected: false, siteUrl: null, siteName: null, lastSyncAt: null, error: null }
  const { data, error } = await supabase
    .from('google_search_console_connections')
    .select('status, refresh_token, selected_site_url, selected_site_name, last_sync_at, last_error')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return { connected: false, siteUrl: null, siteName: null, lastSyncAt: null, error: null }
  return {
    connected: data.status === 'active' && !!data.refresh_token,
    siteUrl: data.selected_site_url,
    siteName: data.selected_site_name,
    lastSyncAt: data.last_sync_at,
    error: data.last_error,
  }
}

export interface UpsertGSCConnectionInput {
  refreshToken?: string
  tokenScope?: string
  connectedEmail?: string
  selectedSiteUrl?: string
  selectedSiteName?: string
  status?: GSCConnectionStatus
  lastSyncAt?: string
  lastError?: string | null
}

export async function upsertGSCConnection(userId: string, input: UpsertGSCConnectionInput): Promise<boolean> {
  if (!supabase) return false

  const { data: existing } = await supabase
    .from('google_search_console_connections')
    .select('id, refresh_token')
    .eq('user_id', userId)
    .maybeSingle()

  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    user_id: userId,
    provider: 'google_search_console',
    updated_at: now,
  }

  if (input.status !== undefined) payload.status = input.status
  else if (input.refreshToken) payload.status = 'active'

  if (input.refreshToken) payload.refresh_token = input.refreshToken
  else if (existing) payload.refresh_token = (existing as { refresh_token?: string }).refresh_token

  if (input.tokenScope !== undefined) payload.token_scope = input.tokenScope
  if (input.connectedEmail !== undefined) payload.connected_email = input.connectedEmail
  if (input.selectedSiteUrl !== undefined) payload.selected_site_url = input.selectedSiteUrl
  if (input.selectedSiteName !== undefined) payload.selected_site_name = input.selectedSiteName
  if (input.lastSyncAt !== undefined) payload.last_sync_at = input.lastSyncAt
  if (input.lastError !== undefined) payload.last_error = input.lastError

  if (existing) {
    const { error } = await supabase
      .from('google_search_console_connections')
      .update(payload)
      .eq('user_id', userId)
    if (error) {
      console.error('GSC_DB_UPDATE_FAIL', error.message)
      return false
    }
    return true
  }

  payload.created_at = now
  if (!payload.refresh_token) return false

  const { error } = await supabase.from('google_search_console_connections').insert(payload)
  if (error) {
    console.error('GSC_DB_INSERT_FAIL', error.message)
    return false
  }
  return true
}

export async function revokeGSCConnection(userId: string): Promise<void> {
  if (!supabase) return
  await supabase
    .from('google_search_console_connections')
    .update({ status: 'revoked', refresh_token: null, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
}
