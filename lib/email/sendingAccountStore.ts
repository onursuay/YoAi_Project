import 'server-only'
import { supabase } from '@/lib/supabase/client'
import { encryptSecret, decryptSecret } from '@/lib/seo/crypto'

/**
 * email_sending_accounts — kullanıcının kendi gönderim hesabı (SMTP / domain /
 * Gmail / Outlook). SMTP şifresi config.passEnc içinde AES-256-GCM ile ŞİFRELİ.
 */

export interface SmtpConfig { host: string; port: number; secure: boolean; user: string; passEnc: string }

export interface SendingAccountRow {
  id: string
  user_id: string
  type: 'smtp' | 'domain' | 'gmail' | 'outlook'
  label: string | null
  from_name: string | null
  from_email: string
  config: Record<string, unknown>
  status: 'pending' | 'active' | 'failed'
  is_default: boolean
  created_at: string
}

export async function listAccounts(userId: string): Promise<SendingAccountRow[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('email_sending_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []) as SendingAccountRow[]
}

/** Kampanyaların kullanacağı hesap: varsayılan aktif → ilk aktif → null. */
export async function getDefaultAccount(userId: string): Promise<SendingAccountRow | null> {
  const all = await listAccounts(userId)
  const active = all.filter((a) => a.status === 'active')
  return active.find((a) => a.is_default) ?? active[0] ?? null
}

export interface CreateSmtpInput {
  host: string; port: number; secure: boolean; user: string; pass: string
  fromEmail: string; fromName?: string | null; label?: string | null
}

export async function createSmtpAccount(userId: string, input: CreateSmtpInput): Promise<SendingAccountRow | null> {
  if (!supabase) return null
  const config: SmtpConfig = {
    host: input.host.trim(), port: Number(input.port) || 587, secure: !!input.secure,
    user: input.user.trim(), passEnc: encryptSecret(input.pass),
  }
  const existing = await listAccounts(userId)
  const { data, error } = await supabase
    .from('email_sending_accounts')
    .insert({
      user_id: userId, type: 'smtp', label: input.label ?? input.host,
      from_name: input.fromName ?? null, from_email: input.fromEmail.trim().toLowerCase(),
      config, status: 'active', is_default: existing.length === 0,
    })
    .select().single()
  if (error || !data) { console.error('[SendingAccount] SMTP_CREATE_FAIL', error?.message); return null }
  return data as SendingAccountRow
}

export async function setDefaultAccount(id: string, userId: string): Promise<boolean> {
  if (!supabase) return false
  await supabase.from('email_sending_accounts').update({ is_default: false }).eq('user_id', userId)
  const { error } = await supabase.from('email_sending_accounts').update({ is_default: true }).eq('id', id).eq('user_id', userId)
  return !error
}

export async function deleteAccount(id: string, userId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('email_sending_accounts').delete().eq('id', id).eq('user_id', userId)
  return !error
}

/** SMTP şifresini çözer (yalnız gönderim anında, server-side). */
export function decryptSmtpPass(account: SendingAccountRow): string {
  const enc = (account.config as { passEnc?: string }).passEnc
  if (!enc) return ''
  try { return decryptSecret(enc) } catch { return '' }
}

export interface CreateOAuthInput {
  type: 'gmail' | 'outlook'
  fromEmail: string
  fromName?: string | null
  refreshToken: string
}

/** OAuth (Gmail/Outlook) hesabı ekler/günceller — refresh_token ŞİFRELİ. */
export async function createOAuthAccount(userId: string, input: CreateOAuthInput): Promise<SendingAccountRow | null> {
  if (!supabase) return null
  const fromEmail = input.fromEmail.trim().toLowerCase()
  const config = { refreshTokenEnc: encryptSecret(input.refreshToken) }
  const existing = await listAccounts(userId)
  // Aynı tür+adres varsa yeniden bağlanmada güncelle (duplicate engeli).
  const dup = existing.find((a) => a.type === input.type && a.from_email === fromEmail)
  if (dup) {
    const { data } = await supabase.from('email_sending_accounts')
      .update({ config, from_name: input.fromName ?? dup.from_name, status: 'active', updated_at: new Date().toISOString() })
      .eq('id', dup.id).eq('user_id', userId).select().single()
    return (data as SendingAccountRow) ?? null
  }
  const { data, error } = await supabase.from('email_sending_accounts')
    .insert({
      user_id: userId, type: input.type, label: fromEmail,
      from_name: input.fromName ?? null, from_email: fromEmail,
      config, status: 'active', is_default: existing.length === 0,
    })
    .select().single()
  if (error || !data) { console.error('[SendingAccount] OAUTH_CREATE_FAIL', error?.message); return null }
  return data as SendingAccountRow
}

/** OAuth refresh_token'ı çözer (yalnız gönderim anında). */
export function decryptRefreshToken(account: SendingAccountRow): string {
  const enc = (account.config as { refreshTokenEnc?: string }).refreshTokenEnc
  if (!enc) return ''
  try { return decryptSecret(enc) } catch { return '' }
}
