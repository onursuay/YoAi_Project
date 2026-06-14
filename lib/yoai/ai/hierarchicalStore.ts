/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Hiyerarşik Geliştirme Store (Faz 3)

   account_alerts → campaign_improvements → adset_improvements →
   ad_improvements (4 tablo) CRUD + lifecycle.

   Service-role supabase client (RLS bypass). UI okuması RLS ile
   korunur; yazma yalnızca bu sunucu katmanından. Eski improvementStore
   (ai_ad_improvements) PARALEL korunur — bu dosya ona dokunmaz.
   ────────────────────────────────────────────────────────── */

import { supabase } from '@/lib/supabase/client'
import type { PerAdImprovementPayload } from './perAdAgent'

export type HierStatus =
  | 'pending' | 'approved' | 'applied' | 'rejected' | 'rejected_by_user' | 'cancelled' | 'superseded'
export type HierPublishMode = 'auto' | 'manual_publish'
export type HierAlertSeverity = 'critical' | 'high' | 'medium' | 'info'
export type HierLevel = 'campaign' | 'adset' | 'ad'

const TABLE: Record<HierLevel, string> = {
  campaign: 'campaign_improvements',
  adset: 'adset_improvements',
  ad: 'ad_improvements',
}

/* ── Row tipleri ── */
export interface AccountAlertRow {
  id: string
  user_id: string
  source_platform: 'meta' | 'google' | null
  account_id: string | null
  business_key: string | null
  alert_type: string
  severity: HierAlertSeverity
  title: string
  body: string | null
  recommended_action: string | null
  alert_payload: Record<string, unknown>
  confidence: number | null
  status: HierStatus
  model: string | null
  run_id: string | null
  decided_by: string | null
  decision_reason: string | null
  created_at: string
  updated_at: string
  decided_at: string | null
}

export interface CampaignImprovementRow {
  id: string
  user_id: string
  source_platform: 'meta' | 'google'
  campaign_id: string
  campaign_name: string | null
  source_campaign_status_snapshot: string | null
  current_objective: string | null
  type_mismatch: boolean
  reasoning: string | null
  improvement_payload: Record<string, unknown>
  confidence: number | null
  status: HierStatus
  publish_mode: HierPublishMode
  model: string | null
  run_id: string | null
  publish_audit_id: string | null
  publish_error: string | null
  publish_attempts: number
  decided_by: string | null
  decision_reason: string | null
  created_at: string
  updated_at: string
  decided_at: string | null
  applied_at: string | null
  cancelled_at: string | null
}

export interface AdsetImprovementRow {
  id: string
  user_id: string
  campaign_improvement_id: string
  source_platform: 'meta' | 'google'
  campaign_id: string | null
  adset_id: string
  adset_name: string | null
  source_adset_status_snapshot: string | null
  reasoning: string | null
  improvement_payload: Record<string, unknown>
  confidence: number | null
  status: HierStatus
  publish_mode: HierPublishMode
  model: string | null
  run_id: string | null
  publish_audit_id: string | null
  publish_error: string | null
  publish_attempts: number
  decided_by: string | null
  decision_reason: string | null
  created_at: string
  updated_at: string
  decided_at: string | null
  applied_at: string | null
  cancelled_at: string | null
}

export interface AdImprovementRow {
  id: string
  user_id: string
  adset_improvement_id: string
  source_platform: 'meta' | 'google'
  campaign_id: string | null
  adset_id: string | null
  ad_id: string
  ad_name: string | null
  source_ad_status_snapshot: string | null
  source_creative_hash: string | null
  reasoning: string | null
  improvement_payload: PerAdImprovementPayload | Record<string, unknown>
  confidence: number | null
  status: HierStatus
  publish_mode: HierPublishMode
  model: string | null
  run_id: string | null
  publish_audit_id: string | null
  publish_error: string | null
  publish_attempts: number
  decided_by: string | null
  decision_reason: string | null
  created_at: string
  updated_at: string
  decided_at: string | null
  applied_at: string | null
  cancelled_at: string | null
  /** UI: öneri sonucu ölçümü — DB kolonu DEĞİL; hierarchy GET yoai_recommendation_results'tan iliştirir. */
  outcome?: AdImprovementOutcome | null
}

/** Applied karta iliştirilen outcome özeti (öğrenen beyin ölçümü). */
export interface AdImprovementOutcome {
  outcome: 'pending' | 'improved' | 'no_change' | 'declined' | 'insufficient_data'
  summary: string | null
  status: string
  delta: Record<string, number | null | undefined> | null
}

/* ── Insert input tipleri ── */
export interface InsertAccountAlertInput {
  user_id: string
  source_platform?: 'meta' | 'google' | null
  account_id?: string | null
  business_key?: string | null
  alert_type: string
  severity: HierAlertSeverity
  title: string
  body?: string | null
  recommended_action?: string | null
  alert_payload?: Record<string, unknown>
  confidence?: number | null
  model?: string | null
  run_id?: string | null
}

export interface InsertCampaignImprovementInput {
  user_id: string
  source_platform: 'meta' | 'google'
  campaign_id: string
  campaign_name?: string | null
  source_campaign_status_snapshot?: string | null
  current_objective?: string | null
  type_mismatch?: boolean
  reasoning?: string | null
  improvement_payload: Record<string, unknown>
  confidence?: number | null
  publish_mode?: HierPublishMode
  model?: string | null
  run_id?: string | null
}

export interface InsertAdsetImprovementInput {
  user_id: string
  campaign_improvement_id: string
  source_platform: 'meta' | 'google'
  campaign_id?: string | null
  adset_id: string
  adset_name?: string | null
  source_adset_status_snapshot?: string | null
  reasoning?: string | null
  improvement_payload: Record<string, unknown>
  confidence?: number | null
  publish_mode?: HierPublishMode
  model?: string | null
  run_id?: string | null
}

export interface InsertAdImprovementInput {
  user_id: string
  adset_improvement_id: string
  source_platform: 'meta' | 'google'
  campaign_id?: string | null
  adset_id?: string | null
  ad_id: string
  ad_name?: string | null
  source_ad_status_snapshot?: string | null
  source_creative_hash?: string | null
  reasoning?: string | null
  improvement_payload: PerAdImprovementPayload | Record<string, unknown>
  confidence?: number | null
  publish_mode: HierPublishMode
  model?: string | null
  run_id?: string | null
}

/* ── account_alerts ── */

/**
 * Rescan öncesi: kullanıcının açık (pending) hesap uyarılarını superseded yap.
 * accountId verilirse YALNIZ o hesabın uyarıları (çoklu işletme — Faz 1):
 * Antso taraması Belgemod'un pending uyarılarını silmesin. accountId yoksa
 * (legacy/flag kapalı) kullanıcının tüm pending uyarıları (mevcut davranış).
 */
export async function supersedePendingAccountAlerts(userId: string, accountId?: string | null): Promise<void> {
  if (!supabase) return
  let q = supabase
    .from('account_alerts')
    .update({ status: 'superseded', decided_by: 'system', decided_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'pending')
  if (accountId) q = q.eq('account_id', accountId)
  const { error } = await q
  if (error) console.error('[HierStore] supersede account_alerts error:', error)
}

export async function insertAccountAlert(input: InsertAccountAlertInput): Promise<{ ok: boolean }> {
  if (!supabase) return { ok: false }
  // Idempotency (account_alerts tek dedup'suz seviyeydi; Inngest retries:2 → duplike pending
  // uyarı → şişen "Kritik Uyarılar" sayacı). Tablo'da UNIQUE yok → insert öncesi dedup:
  // aynı (user_id, source_platform, alert_type, account_id) pending kaydı varsa atla.
  try {
    let dq = supabase.from('account_alerts').select('id')
      .eq('user_id', input.user_id).eq('status', 'pending').eq('alert_type', input.alert_type).limit(1)
    dq = input.source_platform ? dq.eq('source_platform', input.source_platform) : dq.is('source_platform', null)
    dq = input.account_id ? dq.eq('account_id', input.account_id) : dq.is('account_id', null)
    const { data: existing } = await dq.maybeSingle()
    if (existing) return { ok: true } // zaten açık aynı uyarı var → duplike yazma
  } catch { /* dedup sorgusu başarısızsa insert'e devam (en kötü ihtimalle eski davranış) */ }
  // Çoklu işletme kolonları (account_id/business_key) ayrı migration'la geldi
  // (20260524000000). omddq'da uygulanmadıysa insert "column does not exist" ile
  // patlardı → uyarı SESSİZCE kaybolurdu. Guard: kolon hatasında bu iki alan
  // olmadan tekrar dene → uyarı yine de kaydedilir (scope'suz, degrade ama görünür).
  const base = {
    user_id: input.user_id,
    source_platform: input.source_platform ?? null,
    alert_type: input.alert_type,
    severity: input.severity,
    title: input.title,
    body: input.body ?? null,
    recommended_action: input.recommended_action ?? null,
    alert_payload: input.alert_payload ?? {},
    confidence: input.confidence ?? null,
    status: 'pending' as const,
    model: input.model ?? null,
    run_id: input.run_id ?? null,
  }
  const { error } = await supabase.from('account_alerts').insert({
    ...base,
    account_id: input.account_id ?? null,
    business_key: input.business_key ?? null,
  })
  if (!error) return { ok: true }

  const missingCol = error.code === '42703' || /column .* does not exist/i.test(error.message ?? '')
  if (missingCol) {
    console.warn('[HierStore] account_alerts.account_id/business_key kolonu yok — migration 20260524000000 omddq\'da uygulanmamış; uyarı scope\'suz kaydediliyor.')
    const { error: retryErr } = await supabase.from('account_alerts').insert(base)
    if (!retryErr) return { ok: true }
    console.error('[HierStore] insert account_alert retry error:', retryErr)
    return { ok: false }
  }
  console.error('[HierStore] insert account_alert error:', error)
  return { ok: false }
}

export async function listAccountAlertsForUser(
  userId: string,
  statuses: HierStatus[] = ['pending'],
): Promise<AccountAlertRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('account_alerts')
    .select('*')
    .eq('user_id', userId)
    .in('status', statuses)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[HierStore] list account_alerts error:', error)
    return []
  }
  return (data ?? []) as AccountAlertRow[]
}

/* ── campaign_improvements ── */

/**
 * Pending kart ekler ve id döner (ad set kartları için parent).
 * Açık kart zaten varsa (unique ihlali) mevcut açık kartın id'sini döner.
 */
export async function insertCampaignImprovement(input: InsertCampaignImprovementInput): Promise<{ id: string | null }> {
  if (!supabase) return { id: null }
  const { data, error } = await supabase.from('campaign_improvements').insert({
    user_id: input.user_id,
    source_platform: input.source_platform,
    campaign_id: input.campaign_id,
    campaign_name: input.campaign_name ?? null,
    source_campaign_status_snapshot: input.source_campaign_status_snapshot ?? null,
    current_objective: input.current_objective ?? null,
    type_mismatch: input.type_mismatch ?? false,
    reasoning: input.reasoning ?? null,
    improvement_payload: input.improvement_payload,
    confidence: input.confidence ?? null,
    status: 'pending',
    publish_mode: input.publish_mode ?? 'manual_publish',
    model: input.model ?? null,
    run_id: input.run_id ?? null,
  }).select('id').maybeSingle()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      // Açık kart zaten var → mevcut id'yi getir
      const { data: existing } = await supabase
        .from('campaign_improvements')
        .select('id')
        .eq('user_id', input.user_id)
        .eq('source_platform', input.source_platform)
        .eq('campaign_id', input.campaign_id)
        .in('status', ['pending', 'approved'])
        .maybeSingle()
      return { id: (existing as { id?: string } | null)?.id ?? null }
    }
    console.error('[HierStore] insert campaign_improvement error:', error)
    return { id: null }
  }
  return { id: (data as { id?: string } | null)?.id ?? null }
}

export async function listRecentCampaignImprovements(userId: string, limit = 300, statuses?: HierStatus[]): Promise<CampaignImprovementRow[]> {
  if (!supabase) return []
  // R9: statuses verilince yalnız o statüler (terminal superseded/cancelled hariç) — limit
  // penceresi terminal gürültüyle dolup eski pending/decided kartları kaçırmasın (uzun-ömürlü hesap).
  let q = supabase
    .from('campaign_improvements')
    .select('*')
    .eq('user_id', userId)
  if (statuses && statuses.length) q = q.in('status', statuses)
  const { data, error } = await q
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[HierStore] listRecent campaign_improvements error:', error)
    return []
  }
  return (data ?? []) as CampaignImprovementRow[]
}

/* ── adset_improvements ── */
export async function insertAdsetImprovement(input: InsertAdsetImprovementInput): Promise<{ id: string | null }> {
  if (!supabase) return { id: null }
  const { data, error } = await supabase.from('adset_improvements').insert({
    user_id: input.user_id,
    campaign_improvement_id: input.campaign_improvement_id,
    source_platform: input.source_platform,
    campaign_id: input.campaign_id ?? null,
    adset_id: input.adset_id,
    adset_name: input.adset_name ?? null,
    source_adset_status_snapshot: input.source_adset_status_snapshot ?? null,
    reasoning: input.reasoning ?? null,
    improvement_payload: input.improvement_payload,
    confidence: input.confidence ?? null,
    status: 'pending',
    publish_mode: input.publish_mode ?? 'manual_publish',
    model: input.model ?? null,
    run_id: input.run_id ?? null,
  }).select('id').maybeSingle()
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      const { data: existing } = await supabase
        .from('adset_improvements')
        .select('id')
        .eq('user_id', input.user_id)
        .eq('source_platform', input.source_platform)
        .eq('adset_id', input.adset_id)
        .in('status', ['pending', 'approved'])
        .maybeSingle()
      return { id: (existing as { id?: string } | null)?.id ?? null }
    }
    console.error('[HierStore] insert adset_improvement error:', error)
    return { id: null }
  }
  return { id: (data as { id?: string } | null)?.id ?? null }
}

/* ── ad_improvements ── */
export async function insertAdImprovement(input: InsertAdImprovementInput): Promise<{ ok: boolean }> {
  if (!supabase) return { ok: false }
  const { error } = await supabase.from('ad_improvements').insert({
    user_id: input.user_id,
    adset_improvement_id: input.adset_improvement_id,
    source_platform: input.source_platform,
    campaign_id: input.campaign_id ?? null,
    adset_id: input.adset_id ?? null,
    ad_id: input.ad_id,
    ad_name: input.ad_name ?? null,
    source_ad_status_snapshot: input.source_ad_status_snapshot ?? null,
    source_creative_hash: input.source_creative_hash ?? null,
    reasoning: input.reasoning ?? null,
    improvement_payload: input.improvement_payload,
    confidence: input.confidence ?? null,
    status: 'pending',
    publish_mode: input.publish_mode,
    model: input.model ?? null,
    run_id: input.run_id ?? null,
  })
  if (error) {
    if ((error as { code?: string }).code === '23505') return { ok: true } // açık kart zaten var
    console.error('[HierStore] insert ad_improvement error:', error)
    return { ok: false }
  }
  return { ok: true }
}

export async function listRecentAdImprovements(userId: string, limit = 500, statuses?: HierStatus[]): Promise<AdImprovementRow[]> {
  if (!supabase) return []
  let q = supabase.from('ad_improvements').select('*').eq('user_id', userId)
  if (statuses && statuses.length) q = q.in('status', statuses)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) {
    console.error('[HierStore] listRecent ad_improvements error:', error)
    return []
  }
  return (data ?? []) as AdImprovementRow[]
}

export async function listRecentAdsetImprovements(userId: string, limit = 1000, statuses?: HierStatus[]): Promise<AdsetImprovementRow[]> {
  if (!supabase) return []
  let q = supabase.from('adset_improvements').select('*').eq('user_id', userId)
  if (statuses && statuses.length) q = q.in('status', statuses)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) { console.error('[HierStore] listRecent adset_improvements error:', error); return [] }
  return (data ?? []) as AdsetImprovementRow[]
}

/* ── Lifecycle: subtree (kampanya bazında, weekly refresh) ── */

/** Bir kampanyanın TÜM pending kartlarını (3 seviye) superseded yapar — haftalık tazeleme. */
export async function supersedePendingCampaignSubtree(userId: string, platform: 'meta' | 'google', campaignId: string): Promise<void> {
  if (!supabase) return
  const patch = { status: 'superseded', decided_by: 'system', decided_at: new Date().toISOString() }
  for (const t of ['campaign_improvements', 'adset_improvements', 'ad_improvements']) {
    const { error } = await supabase.from(t).update(patch)
      .eq('user_id', userId).eq('source_platform', platform).eq('campaign_id', campaignId).eq('status', 'pending')
    if (error) console.error(`[HierStore] supersede subtree ${t} error:`, error)
  }
}

/** Bir kampanyanın TÜM pending kartlarını (3 seviye) cancelled yapar — kampanya pasif. */
export async function cancelPendingCampaignSubtree(userId: string, platform: 'meta' | 'google', campaignId: string, reason: string): Promise<void> {
  if (!supabase) return
  const now = new Date().toISOString()
  for (const t of ['campaign_improvements', 'adset_improvements', 'ad_improvements']) {
    const { error } = await supabase.from(t)
      .update({ status: 'cancelled', decided_by: 'system', decision_reason: reason, decided_at: now, cancelled_at: now })
      .eq('user_id', userId).eq('source_platform', platform).eq('campaign_id', campaignId).eq('status', 'pending')
    if (error) console.error(`[HierStore] cancel subtree ${t} error:`, error)
  }
}

/* ── Lifecycle: supersede / cancel (her seviye) ── */
export async function supersedeImprovement(level: HierLevel, id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from(TABLE[level])
    .update({ status: 'superseded', decided_by: 'system', decided_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['pending', 'approved'])
  if (error) console.error(`[HierStore] supersede ${level} error:`, error)
}

export async function cancelImprovement(level: HierLevel, id: string, reason: string): Promise<void> {
  if (!supabase) return
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { status: 'cancelled', decided_by: 'system', decision_reason: reason, decided_at: now, cancelled_at: now }
  const { error } = await supabase
    .from(TABLE[level])
    .update(patch)
    .eq('id', id)
    .in('status', ['pending', 'approved'])
  if (error) console.error(`[HierStore] cancel ${level} error:`, error)
}

/* ── Kullanıcı kararları (her seviye) ── */
export async function approveImprovement(level: HierLevel, userId: string, id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from(TABLE[level])
    .update({ status: 'approved', decided_by: userId, decided_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .eq('status', 'pending')
  if (error) { console.error(`[HierStore] approve ${level} error:`, error); return false }
  return true
}

/** Reddet → rejected_by_user (soft-delete). pending/approved/applied'dan reddedilebilir. */
export async function rejectImprovement(level: HierLevel, userId: string, id: string, reason?: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from(TABLE[level])
    .update({ status: 'rejected_by_user', decided_by: userId, decision_reason: reason ?? null, decided_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .in('status', ['pending', 'approved', 'applied'])
  if (error) { console.error(`[HierStore] reject ${level} error:`, error); return false }
  return true
}

/** "Geri Al" → reddedilen kartı tekrar pending yap. */
export async function unrejectImprovement(level: HierLevel, userId: string, id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from(TABLE[level])
    .update({ status: 'pending', decided_by: null, decision_reason: null, decided_at: null })
    .eq('user_id', userId)
    .eq('id', id)
    .eq('status', 'rejected_by_user')
  if (error) { console.error(`[HierStore] unreject ${level} error:`, error); return false }
  return true
}

export async function getImprovementRow(level: HierLevel, userId: string, id: string): Promise<Record<string, unknown> | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(TABLE[level]).select('*').eq('user_id', userId).eq('id', id).maybeSingle()
  if (error) { console.error(`[HierStore] get ${level} error:`, error); return null }
  return (data as Record<string, unknown>) ?? null
}

export async function markImprovementApplied(level: HierLevel, userId: string, id: string, publishAuditId?: string | null): Promise<void> {
  if (!supabase) return
  // IDOR koruması: yalnız kaydın sahibi güncelleyebilir (.eq user_id).
  const { error } = await supabase
    .from(TABLE[level])
    .update({ status: 'applied', applied_at: new Date().toISOString(), publish_audit_id: publishAuditId ?? null, publish_error: null })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) console.error(`[HierStore] markApplied ${level} error:`, error)
}

export async function markImprovementPublishError(level: HierLevel, userId: string, id: string, errorMsg: string): Promise<void> {
  if (!supabase) return
  // IDOR koruması: yalnız sahibinin kaydı (.eq user_id hem select hem update'te).
  const { data } = await supabase.from(TABLE[level]).select('publish_attempts').eq('id', id).eq('user_id', userId).maybeSingle()
  const attempts = ((data as { publish_attempts?: number } | null)?.publish_attempts ?? 0) + 1
  const { error } = await supabase
    .from(TABLE[level])
    .update({ publish_error: errorMsg.slice(0, 2000), publish_attempts: attempts })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) console.error(`[HierStore] markPublishError ${level} error:`, error)
}

/** Reklam ad_spec'ini yayından ÖNCE düzenle (yalnız pending/approved). Kullanıcı düzenlemesi. */
export async function updateAdImprovementSpec(
  userId: string,
  id: string,
  edit: { headlines?: string[]; descriptions?: string[]; primary_text?: string; cta?: string; daily_budget?: number | null },
): Promise<boolean> {
  if (!supabase) return false
  const { data, error: selErr } = await supabase
    .from('ad_improvements').select('improvement_payload,status').eq('user_id', userId).eq('id', id).maybeSingle()
  if (selErr || !data) { if (selErr) console.error('[HierStore] edit select error:', selErr); return false }
  const row = data as { improvement_payload: Record<string, unknown> | null; status: string }
  if (row.status !== 'pending' && row.status !== 'approved') return false
  const payload = { ...((row.improvement_payload ?? {}) as Record<string, unknown>) }
  const spec = { ...((payload.ad_spec ?? {}) as Record<string, unknown>) }
  const creative = { ...((spec.creative ?? {}) as Record<string, unknown>) }
  const budget = { ...((spec.budget ?? {}) as Record<string, unknown>) }
  if (Array.isArray(edit.headlines)) creative.headlines = edit.headlines.filter((h) => h && h.trim()).map((h) => h.trim())
  if (Array.isArray(edit.descriptions)) creative.descriptions = edit.descriptions.filter((d) => d && d.trim()).map((d) => d.trim())
  if (typeof edit.primary_text === 'string') creative.primary_text = edit.primary_text.trim()
  if (typeof edit.cta === 'string' && edit.cta.trim()) spec.cta = edit.cta.trim()
  if (edit.daily_budget != null && Number.isFinite(edit.daily_budget)) budget.daily = edit.daily_budget
  spec.creative = creative
  spec.budget = budget
  payload.ad_spec = spec
  const { error } = await supabase
    .from('ad_improvements').update({ improvement_payload: payload })
    .eq('user_id', userId).eq('id', id).in('status', ['pending', 'approved'])
  if (error) { console.error('[HierStore] edit update error:', error); return false }
  return true
}

/* ── Komuta merkezi sayaçları (gerçek hiyerarşik veri) ── */
export interface HierarchyCounts {
  criticalAlerts: number  // pending account_alerts, severity critical|high
  pendingAlerts: number   // tüm pending account_alerts
  pendingCampaigns: number
  pendingAdsets: number
  pendingAds: number      // yayın onayı bekleyen reklam kartları
  pendingTotal: number    // campaign+adset+ad pending toplamı
}

const ZERO_COUNTS: HierarchyCounts = {
  criticalAlerts: 0, pendingAlerts: 0, pendingCampaigns: 0, pendingAdsets: 0, pendingAds: 0, pendingTotal: 0,
}

/** getHierarchyCounts scope filtresi — per-account scope açıkken seçili işletmeye sınırlar.
 *  campaignIds: seçili işletmenin scope'lu analizindeki kampanya ID'leri (kart sayımı bunlara sınırlanır).
 *  accountIds: account_alerts'i bu hesap(lar)a sınırlamak için (Meta act_/Google customer). */
export interface HierarchyCountScope {
  campaignIds: string[]
  accountIds: (string | null)[]
}

/** Komuta merkezi sayaçlarını gerçek hiyerarşik tablolardan üretir (eski deepAnalysis dalı değil).
 *  scope verilirse (per-account scope açık) sayımlar seçili işletmeyle sınırlanır → kart listesiyle tutarlı. */
export async function getHierarchyCounts(userId: string, scope?: HierarchyCountScope): Promise<HierarchyCounts> {
  if (!supabase) return ZERO_COUNTS
  try {
    const scoped = !!scope
    // Scope açık ama bu işletmenin hiç kampanyası yoksa kart sayıları 0 (boş IN sorgusu yapma).
    const ids = scope?.campaignIds ?? []
    const acctIds = (scope?.accountIds ?? []).filter((a): a is string => a != null)

    const pendingCount = (table: string) => {
      let q = supabase!.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'pending')
      if (scoped) q = q.in('campaign_id', ids.length ? ids : ['__none__'])
      return q
    }
    const alertBase = () => {
      let q = supabase!.from('account_alerts').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'pending')
      // Scope açıkken yalnız bu işletmenin hesabına ait (account_id) uyarılar; account_id NULL legacy hariç.
      if (scoped) q = acctIds.length ? q.in('account_id', acctIds) : q.eq('account_id', '__none__')
      return q
    }
    const [alertsAll, alertsCrit, camp, adset, ad] = await Promise.all([
      alertBase(),
      alertBase().in('severity', ['critical', 'high']),
      pendingCount('campaign_improvements'),
      pendingCount('adset_improvements'),
      pendingCount('ad_improvements'),
    ])
    const pendingCampaigns = camp.count ?? 0
    const pendingAdsets = adset.count ?? 0
    const pendingAds = ad.count ?? 0
    return {
      criticalAlerts: alertsCrit.count ?? 0,
      pendingAlerts: alertsAll.count ?? 0,
      pendingCampaigns,
      pendingAdsets,
      pendingAds,
      pendingTotal: pendingCampaigns + pendingAdsets + pendingAds,
    }
  } catch (e) {
    console.warn('[HierStore] getHierarchyCounts error:', e instanceof Error ? e.message : e)
    return ZERO_COUNTS
  }
}

/* ── UI: hiyerarşik okuma ── */
export interface AdsetWithAds extends AdsetImprovementRow {
  ads: AdImprovementRow[]
}
export interface CampaignWithChildren extends CampaignImprovementRow {
  adsets: AdsetWithAds[]
}
export interface ImprovementHierarchy {
  accountAlerts: AccountAlertRow[]
  campaigns: CampaignWithChildren[]
}

/**
 * UI için tam hiyerarşi (varsayılan: kullanıcıya görünür statüler).
 * superseded/cancelled gizli. rejected_by_user "Geri Al" için dahil edilir.
 */
export async function getImprovementHierarchy(
  userId: string,
  statuses: HierStatus[] = ['pending', 'approved', 'applied', 'rejected_by_user'],
): Promise<ImprovementHierarchy> {
  if (!supabase) return { accountAlerts: [], campaigns: [] }

  const [alertsRes, campRes, adsetRes, adRes] = await Promise.all([
    supabase.from('account_alerts').select('*').eq('user_id', userId).in('status', statuses).order('created_at', { ascending: false }),
    supabase.from('campaign_improvements').select('*').eq('user_id', userId).in('status', statuses).order('created_at', { ascending: false }),
    supabase.from('adset_improvements').select('*').eq('user_id', userId).in('status', statuses),
    supabase.from('ad_improvements').select('*').eq('user_id', userId).in('status', statuses),
  ])

  const accountAlerts = (alertsRes.data ?? []) as AccountAlertRow[]
  const campRows = (campRes.data ?? []) as CampaignImprovementRow[]
  const adsetRows = (adsetRes.data ?? []) as AdsetImprovementRow[]
  const adRows = (adRes.data ?? []) as AdImprovementRow[]

  const adsByAdset = new Map<string, AdImprovementRow[]>()
  for (const ad of adRows) {
    const arr = adsByAdset.get(ad.adset_improvement_id) ?? []
    arr.push(ad)
    adsByAdset.set(ad.adset_improvement_id, arr)
  }
  const adsetsByCampaign = new Map<string, AdsetWithAds[]>()
  for (const as of adsetRows) {
    const withAds: AdsetWithAds = { ...as, ads: adsByAdset.get(as.id) ?? [] }
    const arr = adsetsByCampaign.get(as.campaign_improvement_id) ?? []
    arr.push(withAds)
    adsetsByCampaign.set(as.campaign_improvement_id, arr)
  }
  const campaigns: CampaignWithChildren[] = campRows.map((c) => ({
    ...c,
    adsets: adsetsByCampaign.get(c.id) ?? [],
  }))

  return { accountAlerts, campaigns }
}
