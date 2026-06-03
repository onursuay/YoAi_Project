import 'server-only'
import { supabase } from '@/lib/supabase/client'
import { encryptSecret, decryptSecret, maskSecret } from './crypto'
import type { SiteCredentials, SitePlatform } from './connectors/types'
import { runSiteBriefPipeline } from '@/lib/seo/siteBriefPipeline'

/**
 * site_connections tablosu için tek noktadan erişim katmanı.
 *
 * - Gizli alanlar (wpAppPassword, accessToken, apiSecret, webhookSecret)
 *   tek JSON'a serialize edilip AES-256-GCM ile şifrelenip credentials_enc
 *   kolonunda saklanır.
 * - Client'a ASLA çözülmüş gizli bilgi dönmez (maskeli gösterim).
 * - getConnectionWithCredentials yalnız server-içi yayın akışında kullanılır.
 *
 * Güvenlik: credential hiçbir log'a yazılmaz.
 */

/* ── Tipler ──────────────────────────────────────────────────── */

export type SiteConnectionStatus = 'active' | 'error' | 'revoked'

interface SecretBag {
  wpUsername?: string
  wpAppPassword?: string
  accessToken?: string
  apiKey?: string
  apiSecret?: string
  webhookSecret?: string
}

export interface SiteConnectionRow {
  id: string
  user_id: string
  platform: SitePlatform
  label: string | null
  base_url: string
  credentials_enc: string | null
  shop_blog_id: string | null
  webhook_url: string | null
  is_default: boolean
  status: SiteConnectionStatus
  last_error: string | null
  last_checked_at: string | null
  created_at: string
  updated_at: string
}

/** Client'a dönen güvenli (maskeli) görünüm. */
export interface MaskedSiteConnection {
  id: string
  platform: SitePlatform
  label: string | null
  baseUrl: string
  shopBlogId: string | null
  webhookUrl: string | null
  isDefault: boolean
  status: SiteConnectionStatus
  lastError: string | null
  lastCheckedAt: string | null
  // güvenli özet
  username: string | null         // WP kullanıcı adı (gizli değil)
  secretMask: string              // "••••1234"
  createdAt: string
}

export interface UpsertSiteConnectionInput {
  id?: string
  platform: SitePlatform
  label?: string | null
  baseUrl: string
  shopBlogId?: string | null
  webhookUrl?: string | null
  isDefault?: boolean
  secrets: SecretBag              // düz; şifrelenecek
}

/* ── Yardımcılar ─────────────────────────────────────────────── */

function shortUser(userId: string): string {
  return userId.slice(0, 8) + '…'
}

function cleanBase(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function decodeSecrets(enc: string | null): SecretBag {
  if (!enc) return {}
  try {
    return JSON.parse(decryptSecret(enc)) as SecretBag
  } catch {
    return {}
  }
}

/** En anlamlı gizli alanın maskesini üret (UI için). */
function summaryMask(secrets: SecretBag): string {
  const candidate =
    secrets.wpAppPassword || secrets.accessToken || secrets.apiSecret || secrets.webhookSecret
  return candidate ? maskSecret(candidate) : ''
}

function toMasked(row: SiteConnectionRow): MaskedSiteConnection {
  const secrets = decodeSecrets(row.credentials_enc)
  return {
    id: row.id,
    platform: row.platform,
    label: row.label,
    baseUrl: row.base_url,
    shopBlogId: row.shop_blog_id,
    webhookUrl: row.webhook_url,
    isDefault: row.is_default,
    status: row.status,
    lastError: row.last_error,
    lastCheckedAt: row.last_checked_at,
    username: secrets.wpUsername ?? null,
    secretMask: summaryMask(secrets),
    createdAt: row.created_at,
  }
}

/** DB satırı → connector'a verilecek ÇÖZÜLMÜŞ SiteCredentials. */
function toCredentials(row: SiteConnectionRow): SiteCredentials {
  const secrets = decodeSecrets(row.credentials_enc)
  return {
    baseUrl: row.base_url,
    wpUsername: secrets.wpUsername,
    wpAppPassword: secrets.wpAppPassword,
    accessToken: secrets.accessToken,
    apiKey: secrets.apiKey,
    apiSecret: secrets.apiSecret,
    shopBlogId: row.shop_blog_id ?? undefined,
    webhookUrl: row.webhook_url ?? undefined,
    webhookSecret: secrets.webhookSecret,
  }
}

/* ── Okuma ───────────────────────────────────────────────────── */

export async function listConnections(userId: string): Promise<MaskedSiteConnection[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('site_connections')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[SiteConnectionStore] LIST_FAIL', { user: shortUser(userId), message: error.message })
    return []
  }
  return (data as SiteConnectionRow[]).map(toMasked)
}

async function getRow(id: string, userId: string): Promise<SiteConnectionRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('site_connections')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as SiteConnectionRow
}

export async function getConnection(id: string, userId: string): Promise<MaskedSiteConnection | null> {
  const row = await getRow(id, userId)
  return row ? toMasked(row) : null
}

/** Server-içi yayın akışı için ÇÖZÜLMÜŞ kimlik bilgileri + platform. */
export async function getConnectionWithCredentials(
  id: string,
  userId: string
): Promise<{ platform: SitePlatform; credentials: SiteCredentials } | null> {
  const row = await getRow(id, userId)
  if (!row) return null
  return { platform: row.platform, credentials: toCredentials(row) }
}

/** Varsayılan bağlantı (yoksa en son eklenen aktif). */
export async function getDefaultConnection(
  userId: string
): Promise<{ id: string; platform: SitePlatform; credentials: SiteCredentials } | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('site_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  const row = data as SiteConnectionRow
  return { id: row.id, platform: row.platform, credentials: toCredentials(row) }
}

/* ── Yazma ───────────────────────────────────────────────────── */

/** Gizli alanları mevcutla birleştirip şifreler. Boş gelen secret eskiyi korur. */
function mergeAndEncrypt(incoming: SecretBag, existingEnc: string | null): string {
  const existing = decodeSecrets(existingEnc)
  const merged: SecretBag = { ...existing }
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== '') {
      ;(merged as Record<string, string>)[k] = v
    }
  }
  return encryptSecret(JSON.stringify(merged))
}

export async function upsertConnection(
  userId: string,
  input: UpsertSiteConnectionInput
): Promise<MaskedSiteConnection | null> {
  if (!supabase) return null

  const now = new Date().toISOString()
  const existing = input.id ? await getRow(input.id, userId) : null
  const credentials_enc = mergeAndEncrypt(input.secrets, existing?.credentials_enc ?? null)

  // Tek default kuralı: bu bağlantı default işaretlendiyse diğerlerini sıfırla.
  if (input.isDefault) {
    await supabase
      .from('site_connections')
      .update({ is_default: false, updated_at: now })
      .eq('user_id', userId)
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    platform: input.platform,
    label: input.label ?? null,
    base_url: cleanBase(input.baseUrl),
    credentials_enc,
    shop_blog_id: input.shopBlogId ?? null,
    webhook_url: input.webhookUrl ? cleanBase(input.webhookUrl) : null,
    is_default: input.isDefault ?? existing?.is_default ?? false,
    status: 'active',
    updated_at: now,
  }

  if (existing) {
    const { data, error } = await supabase
      .from('site_connections')
      .update(payload)
      .eq('id', existing.id)
      .eq('user_id', userId)
      .select()
      .single()
    if (error || !data) {
      console.error('[SiteConnectionStore] UPDATE_FAIL', { user: shortUser(userId), message: error?.message })
      return null
    }
    return toMasked(data as SiteConnectionRow)
  }

  payload.created_at = now
  const { data, error } = await supabase
    .from('site_connections')
    .insert(payload)
    .select()
    .single()
  if (error || !data) {
    console.error('[SiteConnectionStore] INSERT_FAIL', { user: shortUser(userId), message: error?.message })
    return null
  }
  // Yeni site bağlandı → içerik brief'ini arka planda üret (fire-and-forget).
  const inserted = data as SiteConnectionRow
  void runSiteBriefPipeline(inserted.id, userId).catch((e) =>
    console.error('[SiteConnectionStore] BRIEF_TRIGGER_FAIL', (e as Error).message)
  )
  return toMasked(inserted)
}

/** Yalnız metadata günceller (label, isDefault) — gizli bilgiye dokunmaz. */
export async function updateConnectionMeta(
  id: string,
  userId: string,
  patch: { label?: string | null; isDefault?: boolean; shopBlogId?: string | null }
): Promise<MaskedSiteConnection | null> {
  if (!supabase) return null
  const existing = await getRow(id, userId)
  if (!existing) return null

  const now = new Date().toISOString()

  if (patch.isDefault === true) {
    await supabase
      .from('site_connections')
      .update({ is_default: false, updated_at: now })
      .eq('user_id', userId)
  }

  const updates: Record<string, unknown> = { updated_at: now }
  if (patch.label !== undefined) updates.label = patch.label
  if (patch.isDefault !== undefined) updates.is_default = patch.isDefault
  if (patch.shopBlogId !== undefined) updates.shop_blog_id = patch.shopBlogId

  const { data, error } = await supabase
    .from('site_connections')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error || !data) {
    console.error('[SiteConnectionStore] META_UPDATE_FAIL', { user: shortUser(userId), message: error?.message })
    return null
  }
  return toMasked(data as SiteConnectionRow)
}

export async function deleteConnection(id: string, userId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('site_connections')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) {
    console.error('[SiteConnectionStore] DELETE_FAIL', { user: shortUser(userId), message: error.message })
    return false
  }
  return true
}

export async function setConnectionStatus(
  id: string,
  userId: string,
  status: SiteConnectionStatus,
  lastError?: string | null
): Promise<void> {
  if (!supabase) return
  const now = new Date().toISOString()
  await supabase
    .from('site_connections')
    .update({ status, last_error: lastError ?? null, last_checked_at: now, updated_at: now })
    .eq('id', id)
    .eq('user_id', userId)
}
