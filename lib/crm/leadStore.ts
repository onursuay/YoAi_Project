import 'server-only'
import { supabase } from '@/lib/supabase/client'

/**
 * crm_leads erişim katmanı.
 *
 * Meta Lead Ads formlarından düşen lead'ler. `UNIQUE(user_id, meta_leadgen_id)`
 * webhook tekrarlarına karşı idempotency sağlar (upsert onConflict). Ham
 * field_data DB'de saklanır (CRM detayında lazım); UI'a maskelenmiş gider.
 */

export type CrmLeadStatus = 'new' | 'positive' | 'negative'

export interface CrmLeadFieldEntry {
  name?: string
  values?: string[]
}

export interface CrmLeadRow {
  id: string
  user_id: string
  source: string
  meta_leadgen_id: string
  meta_form_id: string | null
  meta_page_id: string | null
  form_name: string | null
  ad_id: string | null
  campaign_name: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  raw_field_data: CrmLeadFieldEntry[]
  status: CrmLeadStatus
  note: string | null
  lead_created_time: string | null
  created_at: string
  updated_at: string
}

export interface UpsertLeadInput {
  userId: string
  metaLeadgenId: string
  metaFormId?: string | null
  metaPageId?: string | null
  formName?: string | null
  adId?: string | null
  campaignName?: string | null
  fullName?: string | null
  email?: string | null
  phone?: string | null
  rawFieldData?: CrmLeadFieldEntry[]
  leadCreatedTime?: string | null
}

/**
 * Idempotent upsert — aynı leadgen_id ikinci kez gelirse mevcut satır korunur
 * (kullanıcının verdiği status/note ezilmez): yalnız INSERT, çakışmada yok say.
 */
export async function upsertLead(input: UpsertLeadInput): Promise<CrmLeadRow | null> {
  if (!supabase) return null
  const payload = {
    user_id: input.userId,
    source: 'meta',
    meta_leadgen_id: input.metaLeadgenId,
    meta_form_id: input.metaFormId ?? null,
    meta_page_id: input.metaPageId ?? null,
    form_name: input.formName ?? null,
    ad_id: input.adId ?? null,
    campaign_name: input.campaignName ?? null,
    full_name: input.fullName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    raw_field_data: input.rawFieldData ?? [],
    lead_created_time: input.leadCreatedTime ?? null,
  }
  const { data, error } = await supabase
    .from('crm_leads')
    .upsert(payload, { onConflict: 'user_id,meta_leadgen_id', ignoreDuplicates: true })
    .select()
    .maybeSingle()
  if (error) {
    console.error('[CrmLeadStore] UPSERT_FAIL', error.message)
    return null
  }
  return (data as CrmLeadRow) ?? null
}

export interface ListLeadsOptions {
  status?: CrmLeadStatus | 'all'
  limit?: number
  offset?: number
}

export interface ListLeadsResult {
  leads: CrmLeadRow[]
  total: number
  counts: { all: number; new: number; positive: number; negative: number }
}

export async function listLeads(userId: string, opts: ListLeadsOptions = {}): Promise<ListLeadsResult> {
  const empty: ListLeadsResult = { leads: [], total: 0, counts: { all: 0, new: 0, positive: 0, negative: 0 } }
  if (!supabase) return empty

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)
  const offset = Math.max(opts.offset ?? 0, 0)

  let q = supabase
    .from('crm_leads')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts.status && opts.status !== 'all') q = q.eq('status', opts.status)

  const { data, error, count } = await q
  if (error) {
    console.error('[CrmLeadStore] LIST_FAIL', error.message)
    return empty
  }

  // Durum sayaçları (rozet/filtre için) — ayrı hafif sorgu.
  const counts = { all: 0, new: 0, positive: 0, negative: 0 }
  const { data: statusRows } = await supabase
    .from('crm_leads')
    .select('status')
    .eq('user_id', userId)
  for (const r of (statusRows ?? []) as Array<{ status: CrmLeadStatus }>) {
    counts.all++
    if (r.status in counts) counts[r.status]++
  }

  return { leads: (data ?? []) as CrmLeadRow[], total: count ?? 0, counts }
}

export async function getLead(id: string, userId: string): Promise<CrmLeadRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('crm_leads')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as CrmLeadRow
}

export async function updateLeadStatus(
  id: string,
  userId: string,
  status: CrmLeadStatus,
  note?: string | null,
): Promise<CrmLeadRow | null> {
  if (!supabase) return null
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (note !== undefined) updates.note = note
  const { data, error } = await supabase
    .from('crm_leads')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error || !data) {
    console.error('[CrmLeadStore] STATUS_FAIL', error?.message)
    return null
  }
  return data as CrmLeadRow
}
