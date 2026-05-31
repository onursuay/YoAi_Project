import 'server-only'
import { Resend } from 'resend'
import { supabase } from '@/lib/supabase/client'
import { listAccounts, type SendingAccountRow } from './sendingAccountStore'

/**
 * Kendi domaini doğrulama — Resend domains API. Domain oluşturulur, kullanıcıya
 * eklenecek DNS kayıtları (SPF/DKIM) döner; "Doğrula" ile durum kontrol edilir.
 */
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export interface DnsRecord {
  record?: string
  name?: string
  type?: string
  value?: string
  priority?: number
  ttl?: string
  status?: string
}

export async function createDomainAccount(
  userId: string,
  domain: string,
  fromEmail: string,
  fromName: string | null,
): Promise<{ ok: boolean; account?: SendingAccountRow; records?: DnsRecord[]; error?: string }> {
  if (!resend) return { ok: false, error: 'resend_not_configured' }
  if (!supabase) return { ok: false, error: 'no_db' }

  const res = await resend.domains.create({ name: domain.trim().toLowerCase() })
  const d = res.data as { id?: string; status?: string; records?: DnsRecord[] } | null
  if (!d?.id) return { ok: false, error: res.error?.message || 'create_failed' }

  const records = (d.records ?? []) as DnsRecord[]
  const existing = await listAccounts(userId)
  const { data, error } = await supabase.from('email_sending_accounts')
    .insert({
      user_id: userId, type: 'domain', label: domain.trim().toLowerCase(),
      from_name: fromName ?? null, from_email: fromEmail.trim().toLowerCase(),
      config: { resendDomainId: d.id, domain: domain.trim().toLowerCase(), records },
      status: d.status === 'verified' ? 'active' : 'pending',
      is_default: existing.length === 0 && d.status === 'verified',
    })
    .select().single()
  if (error || !data) { console.error('[Domain] PERSIST_FAIL', error?.message); return { ok: false, error: 'persist_failed' } }
  return { ok: true, account: data as SendingAccountRow, records }
}

export async function verifyDomainAccount(account: SendingAccountRow): Promise<{ ok: boolean; status: 'active' | 'pending' | 'failed'; records?: DnsRecord[] }> {
  if (!resend) return { ok: false, status: 'failed' }
  const id = (account.config as { resendDomainId?: string }).resendDomainId
  if (!id) return { ok: false, status: 'failed' }

  await resend.domains.verify(id).catch(() => {})
  const g = await resend.domains.get(id)
  const gd = g.data as { status?: string; records?: DnsRecord[] } | null
  const verified = gd?.status === 'verified'
  const records = (gd?.records ?? []) as DnsRecord[]

  if (supabase) {
    await supabase.from('email_sending_accounts').update({
      status: verified ? 'active' : 'pending',
      config: { ...(account.config as Record<string, unknown>), resendDomainId: id, records },
      updated_at: new Date().toISOString(),
    }).eq('id', account.id)
  }
  return { ok: true, status: verified ? 'active' : 'pending', records }
}
