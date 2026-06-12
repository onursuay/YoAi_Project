import 'server-only'
import { supabase } from '@/lib/supabase/client'
import { encrypt, decrypt } from './crypto'
import { SETUP_STEPS } from './constants'
import type { MarketingSetupRow, StepStatus } from './types'

const TABLE = 'marketing_setups'

function row(data: Record<string, unknown> | null): MarketingSetupRow | null {
  if (!data) return null
  return data as unknown as MarketingSetupRow
}

export async function getSetup(userId: string): Promise<MarketingSetupRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      'id, user_id, site_url, site_scan_result, selected_events, gtm_container_id, gtm_public_id, gtm_workspace_id, gtm_snippet_head, gtm_snippet_body, ga4_property_id, ga4_measurement_id, ga4_data_stream_id, meta_pixel_id, meta_ad_account_id, google_ads_customer_id, search_console_property, google_token_scopes, status, created_at, updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return row(data)
}

export async function getOrCreateSetup(userId: string, siteUrl: string): Promise<MarketingSetupRow | null> {
  if (!supabase) return null
  const existing = await getSetup(userId)
  if (existing) {
    if (siteUrl && existing.site_url !== siteUrl) {
      return updateSetup(userId, { site_url: siteUrl })
    }
    return existing
  }
  const now = new Date().toISOString()
  const { error } = await supabase
    .from(TABLE)
    .insert({ user_id: userId, site_url: siteUrl, status: 'pending', created_at: now, updated_at: now })
  if (error) {
    console.error('MARKETING_SETUP_INSERT_FAIL', error.message)
    return null
  }
  return getSetup(userId)
}

/** Partial update by user_id. Pass only DB column names. Returns the fresh row. */
export async function updateSetup(
  userId: string,
  patch: Record<string, unknown>,
): Promise<MarketingSetupRow | null> {
  if (!supabase) return null
  const { error } = await supabase
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (error) {
    console.error('MARKETING_SETUP_UPDATE_FAIL', error.message)
    return null
  }
  return getSetup(userId)
}

// ─── Setup Google consent token (encrypted refresh token) ────────────────────
export async function saveGoogleSetupToken(
  userId: string,
  refreshToken: string,
  scopes: string,
): Promise<boolean> {
  if (!supabase) return false
  // ENCRYPTION_KEY yoksa/kısaysa token'ı düz metin (plaintext) KAYDETME — false
  // dön ki callback kullanıcıya açıkça 'error' göstersin. Önceki sessiz
  // plaintext fallback prod'da token'ı açıkta bırakan bir güvenlik açığıydı.
  const enc = encrypt(refreshToken)
  if (!enc) {
    console.error(
      'MARKETING_SETUP_TOKEN_SAVE_FAIL',
      'ENCRYPTION_KEY missing or shorter than 32 chars — refusing to store the refresh token in plaintext',
    )
    return false
  }
  await getOrCreateSetup(userId, '')
  const { error } = await supabase
    .from(TABLE)
    .update({ google_token_enc: enc, google_token_scopes: scopes, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (error) {
    console.error('MARKETING_SETUP_TOKEN_SAVE_FAIL', error.message)
    return false
  }
  return true
}

export async function getGoogleSetupToken(userId: string): Promise<{ refreshToken: string; scopes: string[] } | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('google_token_enc, google_token_scopes')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.google_token_enc) return null
  const enc = data.google_token_enc as string
  const refreshToken = enc.includes(':') ? decrypt(enc) ?? enc : enc
  return {
    refreshToken,
    scopes: (data.google_token_scopes as string | null)?.split(/\s+/).filter(Boolean) ?? [],
  }
}

// ─── Step logging (setup_steps) ──────────────────────────────────────────────
export async function logStep(
  setupId: string,
  stepName: string,
  status: StepStatus,
  result?: Record<string, unknown> | null,
  errorMessage?: string | null,
): Promise<void> {
  if (!supabase) return
  const now = new Date().toISOString()
  const { data: existing } = await supabase
    .from('setup_steps')
    .select('id')
    .eq('setup_id', setupId)
    .eq('step_name', stepName)
    .maybeSingle()
  const payload: Record<string, unknown> = {
    setup_id: setupId,
    step_name: stepName,
    status,
    result: result ?? null,
    error_message: errorMessage ?? null,
    updated_at: now,
  }
  if (existing) {
    await supabase.from('setup_steps').update(payload).eq('id', (existing as { id: string }).id)
  } else {
    await supabase.from('setup_steps').insert({ ...payload, created_at: now })
  }

  // Üst kaydın genel durumunu türet — insert'te 'pending' kalıp hiç
  // güncellenmiyordu. Tüm adımlar terminal ise done/error, değilse running.
  try {
    const steps = await getSteps(setupId)
    const byName = new Map(steps.map((s) => [s.step_name, s.status]))
    const allTerminal = SETUP_STEPS.every((name) => {
      const st = byName.get(name)
      return st === 'done' || st === 'error' || st === 'skipped'
    })
    const overall = allTerminal
      ? SETUP_STEPS.some((name) => byName.get(name) === 'error')
        ? 'error'
        : 'done'
      : 'running'
    await supabase.from(TABLE).update({ status: overall, updated_at: now }).eq('id', setupId)
  } catch {
    // Genel durum güncellemesi adım kaydını asla engellemesin.
  }
}

export async function getSteps(setupId: string): Promise<
  Array<{ step_name: string; status: StepStatus; result: Record<string, unknown> | null; error_message: string | null }>
> {
  if (!supabase) return []
  const { data } = await supabase
    .from('setup_steps')
    .select('step_name, status, result, error_message')
    .eq('setup_id', setupId)
  return (data as never) ?? []
}

export async function logCapiEvent(
  setupId: string | null,
  eventName: string,
  eventId: string,
  matchQualityScore?: number | null,
): Promise<void> {
  if (!supabase) return
  await supabase.from('capi_events').insert({
    setup_id: setupId,
    event_name: eventName,
    event_id: eventId,
    match_quality_score: matchQualityScore ?? null,
  })
}
