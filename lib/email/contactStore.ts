import 'server-only'
import { supabase } from '@/lib/supabase/client'

/**
 * email_contacts erişim katmanı — birleşik kişi havuzu (CRM/CSV/Sheets/manual).
 * UNIQUE(user_id,email) tekilleştirir; service-role.
 */

export interface EmailContactRow {
  id: string
  user_id: string
  email: string
  full_name: string | null
  phone: string | null
  source: string
  crm_lead_id: string | null
  opt_out: boolean
  created_at: string
}

export interface ContactInput {
  email: string
  fullName?: string | null
  phone?: string | null
  source?: string
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const normEmail = (e: string) => e.trim().toLowerCase()
const validEmail = (e: string) => EMAIL_RE.test(e)

export async function listContacts(
  userId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ contacts: EmailContactRow[]; total: number }> {
  if (!supabase) return { contacts: [], total: 0 }
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)
  const offset = Math.max(opts.offset ?? 0, 0)
  const { data, error, count } = await supabase
    .from('email_contacts')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) {
    console.error('[EmailContacts] LIST_FAIL', error.message)
    return { contacts: [], total: 0 }
  }
  return { contacts: (data ?? []) as EmailContactRow[], total: count ?? 0 }
}

export async function countContacts(userId: string): Promise<{ total: number; optedOut: number }> {
  if (!supabase) return { total: 0, optedOut: 0 }
  const { count } = await supabase
    .from('email_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  const { count: oo } = await supabase
    .from('email_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('opt_out', true)
  return { total: count ?? 0, optedOut: oo ?? 0 }
}

/** Toplu ekleme — geçersiz/yinelenen atlanır, mevcut e-posta ezilmez (idempotent). */
export async function upsertContacts(
  userId: string,
  rows: ContactInput[],
  defaultSource = 'manual',
): Promise<{ inserted: number; skipped: number }> {
  if (!supabase || !rows.length) return { inserted: 0, skipped: rows.length }
  const seen = new Set<string>()
  const payload: Record<string, unknown>[] = []
  for (const r of rows) {
    const email = normEmail(r.email || '')
    if (!validEmail(email) || seen.has(email)) continue
    seen.add(email)
    payload.push({
      user_id: userId,
      email,
      full_name: r.fullName?.trim() || null,
      phone: r.phone?.trim() || null,
      source: r.source ?? defaultSource,
    })
  }
  if (!payload.length) return { inserted: 0, skipped: rows.length }

  let inserted = 0
  for (let i = 0; i < payload.length; i += 500) {
    const batch = payload.slice(i, i + 500)
    const { data, error } = await supabase
      .from('email_contacts')
      .upsert(batch, { onConflict: 'user_id,email', ignoreDuplicates: true })
      .select('id')
    if (error) console.error('[EmailContacts] UPSERT_FAIL', error.message)
    else inserted += data?.length ?? 0
  }
  return { inserted, skipped: payload.length - inserted }
}

/** CRM lead'lerinden (e-postası olan, opt-out olmayan) kişi havuzuna aktar. */
export async function importFromCrm(userId: string): Promise<{ inserted: number; skipped: number }> {
  if (!supabase) return { inserted: 0, skipped: 0 }
  const { data, error } = await supabase
    .from('crm_leads')
    .select('email, full_name, phone, email_opt_out')
    .eq('user_id', userId)
    .not('email', 'is', null)
  if (error) {
    console.error('[EmailContacts] CRM_IMPORT_FAIL', error.message)
    return { inserted: 0, skipped: 0 }
  }
  const rows: ContactInput[] = (data ?? [])
    .filter((l: { email: string | null; email_opt_out?: boolean }) => l.email && !l.email_opt_out)
    .map((l: { email: string; full_name: string | null; phone: string | null }) => ({
      email: l.email,
      fullName: l.full_name,
      phone: l.phone,
      source: 'crm',
    }))
  return upsertContacts(userId, rows, 'crm')
}

export async function deleteContact(id: string, userId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('email_contacts').delete().eq('id', id).eq('user_id', userId)
  return !error
}
