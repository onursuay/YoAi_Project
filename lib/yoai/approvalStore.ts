/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Approval Store (Faz 0C)

   AI Reklam Önerileri için approval lifecycle persistence.
   Proposal üretildiğinde upsertPendingApprovalFromProposal()
   ile pending kayıt oluşur; kullanıcı reddet/beklet/düzenle
   aksiyonları DB'ye yansır; publish başarılı olunca published
   olarak işaretlenir.

   Persistence: Supabase tablosu `yoai_pending_approvals`.
   Migration:   supabase/migrations/20260510003000_create_yoai_pending_approvals.sql

   Tablo yoksa: structured error log + null/false/[] döner;
   çağıran flow'u kırmaz.
   ────────────────────────────────────────────────────────── */

import { supabase } from '@/lib/supabase/client'
import { sanitizeResponseExcerpt } from '@/lib/yoai/publishAuditStore'
import type { FullAdProposal } from '@/lib/yoai/adCreator'

const TABLE_MIGRATION_HINT =
  'supabase/migrations/20260510003000_create_yoai_pending_approvals.sql'

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'hold'
  | 'editing'
  | 'published'
  | 'failed'
  | 'expired'

export interface PendingApprovalRecord {
  id: string
  user_id: string
  proposal_id: string
  source_run_id: string | null
  platform: string
  source_campaign_id: string | null
  campaign_type: string | null
  proposal_snapshot: unknown
  status: ApprovalStatus
  status_reason: string | null
  rejection_reason: string | null
  hold_reason: string | null
  edited_payload: unknown
  approved_at: string | null
  rejected_at: string | null
  held_at: string | null
  published_at: string | null
  failed_at: string | null
  publish_audit_id: string | null
  created_at: string
  updated_at: string
  metadata: Record<string, unknown>
}

export interface ApprovalListFilters {
  status?: ApprovalStatus | ApprovalStatus[]
  platform?: string
  limit?: number
}

export interface ApprovalUpdateFields {
  status_reason?: string | null
  rejection_reason?: string | null
  hold_reason?: string | null
  edited_payload?: unknown
  metadata?: Record<string, unknown>
}

/**
 * "İmmutable" olarak kabul edilen statüler — yeni proposal üretiminde
 * (upsert) override edilmez. Kullanıcı zaten karar vermiş.
 */
const PROTECTED_STATUSES: ReadonlySet<ApprovalStatus> = new Set([
  'approved',
  'rejected',
  'hold',
  'editing',
  'published',
  'failed',
  'expired',
])

/** PATCH endpoint'inden izin verilen geçişler (publish-bağlı geçişler hariç). */
export const ALLOWED_USER_TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  pending: ['rejected', 'hold', 'editing'],
  hold: ['rejected', 'pending', 'editing'],
  editing: ['rejected', 'hold', 'pending'],
  rejected: ['pending'], // re-open için
  failed: ['pending'], // retry
  approved: [], // approved → publish flow
  published: [], // terminal
  expired: ['pending'], // re-open
}

function isTableMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42P01' || /relation .* does not exist/i.test(error.message || '')
}

function logTableMissing(operation: string): void {
  console.error(
    `[ApprovalStore][AUDIT_LOSS] yoai_pending_approvals tablosu yok — ${operation} BAŞARISIZ. ` +
      `Migration uygulayın: ${TABLE_MIGRATION_HINT}`,
  )
}

/**
 * AI proposal üretildiğinde kayıt oluştur veya güncelle.
 * - Yeni ise: pending olarak insert.
 * - Mevcut ve status='pending' ise: snapshot/metadata'yı güncelle (içerik tazele).
 * - Mevcut ve status protected ise (approved/rejected/hold/...): NO-OP, mevcut kararı koru.
 */
export async function upsertPendingApprovalFromProposal(
  userId: string,
  proposal: FullAdProposal,
  sourceRunId?: string | null,
): Promise<PendingApprovalRecord | null> {
  if (!supabase) return null

  const proposalId = (proposal as { id?: unknown }).id
  if (typeof proposalId !== 'string' || !proposalId) return null

  const platform = String(proposal.platform || 'unknown')
  const sourceCampaignId =
    (proposal as { sourceCampaignId?: unknown }).sourceCampaignId &&
    typeof proposal.sourceCampaignId === 'string'
      ? proposal.sourceCampaignId
      : null

  // proposalType (optimization vs new_campaign) campaign_type olarak kayıt edilir.
  const campaignType =
    (proposal as { proposalType?: unknown }).proposalType &&
    typeof (proposal as { proposalType?: unknown }).proposalType === 'string'
      ? ((proposal as { proposalType?: string }).proposalType as string)
      : null

  const snapshot = sanitizeResponseExcerpt(proposal)

  // 1) Mevcut kaydı kontrol et.
  const { data: existing, error: selErr } = await supabase
    .from('yoai_pending_approvals')
    .select('id, status, source_run_id, metadata')
    .eq('user_id', userId)
    .eq('proposal_id', proposalId)
    .maybeSingle()

  if (selErr) {
    if (isTableMissingError(selErr)) {
      logTableMissing('upsertPendingApprovalFromProposal.select')
      return null
    }
    console.error('[ApprovalStore] select error:', selErr)
    return null
  }

  // 2) Mevcut kayıt protected statüde ise NO-OP.
  if (existing && PROTECTED_STATUSES.has(existing.status as ApprovalStatus)) {
    return existing as unknown as PendingApprovalRecord
  }

  const now = new Date().toISOString()

  if (existing) {
    // 3) Pending ise snapshot'ı tazele.
    const { data: updated, error: updErr } = await supabase
      .from('yoai_pending_approvals')
      .update({
        proposal_snapshot: snapshot,
        platform,
        source_campaign_id: sourceCampaignId,
        campaign_type: campaignType,
        source_run_id: sourceRunId ?? existing.source_run_id ?? null,
        updated_at: now,
      })
      .eq('id', existing.id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (updErr) {
      console.error('[ApprovalStore] refresh-pending update error:', updErr)
      return null
    }
    return updated as PendingApprovalRecord
  }

  // 4) Yeni kayıt insert.
  const { data: inserted, error: insErr } = await supabase
    .from('yoai_pending_approvals')
    .insert({
      user_id: userId,
      proposal_id: proposalId,
      source_run_id: sourceRunId ?? null,
      platform,
      source_campaign_id: sourceCampaignId,
      campaign_type: campaignType,
      proposal_snapshot: snapshot,
      status: 'pending',
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (insErr) {
    if (isTableMissingError(insErr)) {
      logTableMissing('upsertPendingApprovalFromProposal.insert')
      return null
    }
    // Unique constraint race condition (paralel insert) — yumuşak handle.
    if (insErr.code === '23505') {
      const { data: refetched } = await supabase
        .from('yoai_pending_approvals')
        .select('*')
        .eq('user_id', userId)
        .eq('proposal_id', proposalId)
        .maybeSingle()
      if (refetched) return refetched as PendingApprovalRecord
    }
    console.error('[ApprovalStore] insert error:', insErr)
    return null
  }

  return inserted as PendingApprovalRecord
}

export async function listApprovals(
  userId: string,
  filters?: ApprovalListFilters,
): Promise<PendingApprovalRecord[]> {
  if (!supabase) return []

  let query = supabase
    .from('yoai_pending_approvals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status)
    } else {
      query = query.eq('status', filters.status)
    }
  }
  if (filters?.platform) {
    query = query.eq('platform', filters.platform)
  }
  if (filters?.limit && Number.isFinite(filters.limit) && filters.limit > 0) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query
  if (error) {
    if (isTableMissingError(error)) {
      logTableMissing('listApprovals')
      return []
    }
    console.error('[ApprovalStore] list error:', error)
    return []
  }
  return (data || []) as PendingApprovalRecord[]
}

export async function getApprovalById(
  userId: string,
  approvalId: string,
): Promise<PendingApprovalRecord | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('yoai_pending_approvals')
    .select('*')
    .eq('id', approvalId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    if (isTableMissingError(error)) {
      logTableMissing('getApprovalById')
      return null
    }
    console.error('[ApprovalStore] getById error:', error)
    return null
  }
  return (data as PendingApprovalRecord) || null
}

/**
 * Status update — geçiş guard'lı.
 * NOT: published/approved/failed bu fonksiyon üzerinden değil,
 * markApprovalPublished / markApprovalFailed ile yazılır.
 */
export async function updateApprovalStatus(
  userId: string,
  approvalId: string,
  nextStatus: ApprovalStatus,
  fields?: ApprovalUpdateFields,
): Promise<{ ok: true; record: PendingApprovalRecord } | { ok: false; code: string; message: string }> {
  if (!supabase) {
    return { ok: false, code: 'SUPABASE_UNAVAILABLE', message: 'Supabase client yok.' }
  }

  const current = await getApprovalById(userId, approvalId)
  if (!current) {
    return { ok: false, code: 'NOT_FOUND', message: 'Approval kaydı bulunamadı.' }
  }

  const allowed = ALLOWED_USER_TRANSITIONS[current.status] || []
  if (!allowed.includes(nextStatus)) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: `'${current.status}' → '${nextStatus}' geçişi bu endpoint üzerinden izin verilmiyor.`,
    }
  }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    status: nextStatus,
    updated_at: now,
  }

  if (nextStatus === 'rejected') patch.rejected_at = now
  if (nextStatus === 'hold') patch.held_at = now

  if (fields?.status_reason !== undefined) patch.status_reason = fields.status_reason
  if (fields?.rejection_reason !== undefined) patch.rejection_reason = fields.rejection_reason
  if (fields?.hold_reason !== undefined) patch.hold_reason = fields.hold_reason
  if (fields?.edited_payload !== undefined) {
    patch.edited_payload = sanitizeResponseExcerpt(fields.edited_payload)
  }
  if (fields?.metadata !== undefined) {
    patch.metadata = { ...(current.metadata || {}), ...fields.metadata }
  }

  const { data, error } = await supabase
    .from('yoai_pending_approvals')
    .update(patch)
    .eq('id', approvalId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    if (isTableMissingError(error)) {
      logTableMissing('updateApprovalStatus')
      return { ok: false, code: 'TABLE_MISSING', message: 'Approval tablosu yok.' }
    }
    console.error('[ApprovalStore] update error:', error)
    return { ok: false, code: 'UPDATE_FAILED', message: error.message }
  }
  return { ok: true, record: data as PendingApprovalRecord }
}

export async function markApprovalPublished(
  userId: string,
  approvalId: string,
  publishAuditId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  if (!supabase) return false
  const now = new Date().toISOString()

  // Önce mevcut metadata'yı alıp birleştirmek isteyebiliriz.
  const current = await getApprovalById(userId, approvalId)
  if (!current) return false

  const mergedMetadata = metadata
    ? { ...(current.metadata || {}), ...metadata }
    : current.metadata || {}

  const { error } = await supabase
    .from('yoai_pending_approvals')
    .update({
      status: 'published',
      approved_at: current.approved_at ?? now,
      published_at: now,
      publish_audit_id: publishAuditId ?? null,
      metadata: mergedMetadata,
      updated_at: now,
    })
    .eq('id', approvalId)
    .eq('user_id', userId)

  if (error) {
    if (isTableMissingError(error)) {
      logTableMissing('markApprovalPublished')
      return false
    }
    console.error('[ApprovalStore] markPublished error:', error)
    return false
  }
  return true
}

export async function markApprovalFailed(
  userId: string,
  approvalId: string,
  reason?: string,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  if (!supabase) return false
  const now = new Date().toISOString()

  const current = await getApprovalById(userId, approvalId)
  if (!current) return false

  const mergedMetadata = metadata
    ? { ...(current.metadata || {}), ...metadata }
    : current.metadata || {}

  const { error } = await supabase
    .from('yoai_pending_approvals')
    .update({
      status: 'failed',
      failed_at: now,
      status_reason: reason ?? null,
      metadata: mergedMetadata,
      updated_at: now,
    })
    .eq('id', approvalId)
    .eq('user_id', userId)

  if (error) {
    if (isTableMissingError(error)) {
      logTableMissing('markApprovalFailed')
      return false
    }
    console.error('[ApprovalStore] markFailed error:', error)
    return false
  }
  return true
}

/**
 * Publish flow non-terminal hata aldığında (budget/preflight/needs_input)
 * status'u DEĞİŞTİRMEZ; sadece metadata.last_publish_attempt'i günceller
 * — proposal hâlâ pending/hold/editing kalabilir, kullanıcı tekrar deneyebilir.
 */
export async function recordPublishAttemptOnApproval(
  userId: string,
  approvalId: string,
  attempt: { code: string; message?: string; auditId?: string | null },
): Promise<boolean> {
  if (!supabase) return false
  const current = await getApprovalById(userId, approvalId)
  if (!current) return false

  const mergedMetadata = {
    ...(current.metadata || {}),
    last_publish_attempt: {
      at: new Date().toISOString(),
      code: attempt.code,
      message: attempt.message ?? null,
      auditId: attempt.auditId ?? null,
    },
  }

  const { error } = await supabase
    .from('yoai_pending_approvals')
    .update({ metadata: mergedMetadata, updated_at: new Date().toISOString() })
    .eq('id', approvalId)
    .eq('user_id', userId)

  if (error) {
    if (isTableMissingError(error)) {
      logTableMissing('recordPublishAttemptOnApproval')
      return false
    }
    console.error('[ApprovalStore] recordPublishAttempt error:', error)
    return false
  }
  return true
}

/**
 * Generate-ad çıktısı gibi yığın halinde gelen proposal listesi için
 * eksik olanları (yeni proposal_id'leri) tek sorguda insert eder.
 * Mevcut kayıtlar — protected veya pending — DOKUNULMAZ.
 *
 * Performans: tek roundtrip + ON CONFLICT DO NOTHING semantiği.
 */
export async function bulkInsertPendingApprovalsIfMissing(
  userId: string,
  proposals: FullAdProposal[],
  sourceRunId?: string | null,
): Promise<{ inserted: number; skipped: number }> {
  if (!supabase || proposals.length === 0) {
    return { inserted: 0, skipped: proposals.length }
  }

  const rows = proposals
    .filter((p): p is FullAdProposal & { id: string } => {
      const pid = (p as { id?: unknown }).id
      return typeof pid === 'string' && pid.length > 0
    })
    .map((p) => {
      const proposalType = (p as { proposalType?: unknown }).proposalType
      return {
        user_id: userId,
        proposal_id: p.id,
        source_run_id: sourceRunId ?? null,
        platform: String(p.platform || 'unknown'),
        source_campaign_id:
          typeof p.sourceCampaignId === 'string' ? p.sourceCampaignId : null,
        campaign_type: typeof proposalType === 'string' ? proposalType : null,
        proposal_snapshot: sanitizeResponseExcerpt(p),
        status: 'pending' as ApprovalStatus,
      }
    })

  if (rows.length === 0) {
    return { inserted: 0, skipped: proposals.length }
  }

  // ignoreDuplicates: true → unique (user_id, proposal_id) çakışırsa satır atlanır.
  // Mevcut kayıt protected veya pending olsa bile DEĞİŞTİRİLMEZ.
  const { data, error } = await supabase
    .from('yoai_pending_approvals')
    .upsert(rows, { onConflict: 'user_id,proposal_id', ignoreDuplicates: true })
    .select('id')

  if (error) {
    if (isTableMissingError(error)) {
      logTableMissing('bulkInsertPendingApprovalsIfMissing')
      return { inserted: 0, skipped: rows.length }
    }
    console.error('[ApprovalStore] bulk insert error:', error)
    return { inserted: 0, skipped: rows.length }
  }

  const inserted = Array.isArray(data) ? data.length : 0
  return { inserted, skipped: rows.length - inserted }
}

export async function countPendingApprovals(userId: string): Promise<number> {
  if (!supabase) return 0
  const { count, error } = await supabase
    .from('yoai_pending_approvals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending')

  if (error) {
    if (isTableMissingError(error)) {
      logTableMissing('countPendingApprovals')
      return 0
    }
    console.error('[ApprovalStore] count error:', error)
    return 0
  }
  return count ?? 0
}
