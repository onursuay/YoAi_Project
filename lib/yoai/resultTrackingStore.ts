/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Result Tracking Store (Faz 7)

   Öneri sonuçlarını before/after snapshot olarak kaydeder.
   Delta hesaplama ve deterministic outcome özeti üretir.

   Tablo yoksa: structured log + null/[] döner; flow kırmaz.
   LLM çağrısı yapılmaz; sahte veri üretilmez.
   ────────────────────────────────────────────────────────── */

import { supabase } from '@/lib/supabase/client'

const RESULTS_TABLE = 'yoai_recommendation_results'

/* ── Types ── */

export type RecommendationResultOutcome =
  | 'pending'
  | 'improved'
  | 'no_change'
  | 'declined'
  | 'insufficient_data'

export type RecommendationResultStatus =
  | 'before_recorded'
  | 'applied'
  | 'after_recorded'
  | 'skipped'

export type RecommendationType = 'optimization' | 'new_campaign' | 'creative_refresh'

export interface MetricSnapshot {
  ctr?: number | null
  cpc?: number | null
  spend?: number | null
  impressions?: number | null
  clicks?: number | null
  conversions?: number | null
  roas?: number | null
  reach?: number | null
  frequency?: number | null
  [key: string]: number | null | undefined
}

export interface MetricDelta {
  ctr_delta?: number | null
  cpc_delta?: number | null
  spend_delta?: number | null
  impressions_delta?: number | null
  clicks_delta?: number | null
  conversions_delta?: number | null
  roas_delta?: number | null
  [key: string]: number | null | undefined
}

export interface RecommendationResultRow {
  id: string
  user_id: string
  proposal_id: string
  approval_id: string | null
  source_campaign_id: string | null
  platform: string
  recommendation_type: RecommendationType
  campaign_type: string | null
  proposal_snapshot: Record<string, unknown> | null
  before_snapshot: MetricSnapshot | null
  before_recorded_at: string | null
  after_snapshot: MetricSnapshot | null
  after_recorded_at: string | null
  after_window_days: number
  metric_delta: MetricDelta | null
  outcome: RecommendationResultOutcome
  outcome_summary: string | null
  status: RecommendationResultStatus
  applied_at: string | null
  skipped_reason: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateResultPayload {
  proposalId: string
  approvalId?: string | null
  sourceCampaignId?: string | null
  platform?: string
  recommendationType?: RecommendationType
  campaignType?: string | null
  proposalSnapshot?: Record<string, unknown> | null
  beforeSnapshot: MetricSnapshot
  afterWindowDays?: number
}

export interface RecordAfterSnapshotPayload {
  afterSnapshot: MetricSnapshot
}

/* ── Delta & outcome ── */

/**
 * Before/after snapshot'larından metrik deltalarını hesaplar.
 * Sadece her iki snapshot'ta da olan sayısal alanları hesaplar.
 */
export function computeMetricDelta(
  before: MetricSnapshot,
  after: MetricSnapshot,
): MetricDelta {
  const delta: MetricDelta = {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const key of keys) {
    const b = before[key]
    const a = after[key]
    if (typeof b === 'number' && typeof a === 'number') {
      const deltaKey = `${key}_delta`
      delta[deltaKey] = parseFloat((a - b).toFixed(6))
    }
  }

  return delta
}

/**
 * Delta'dan deterministic outcome üretir.
 * Threshold: CTR ±%15, CPC ±%15, ROAS ±%10 — aksi halde no_change.
 * İki metrik yoksa insufficient_data.
 */
export function summarizeOutcomeDeterministic(delta: MetricDelta): {
  outcome: RecommendationResultOutcome
  summary: string
} {
  const ctrDelta = delta.ctr_delta
  const cpcDelta = delta.cpc_delta
  const roasDelta = delta.roas_delta

  const hasMetrics =
    ctrDelta != null || cpcDelta != null || roasDelta != null

  if (!hasMetrics) {
    return {
      outcome: 'insufficient_data',
      summary: 'Karşılaştırmak için yeterli metrik yok.',
    }
  }

  let improvedCount = 0
  let declinedCount = 0

  if (typeof ctrDelta === 'number') {
    if (ctrDelta > 0.15) improvedCount++
    else if (ctrDelta < -0.15) declinedCount++
  }

  if (typeof cpcDelta === 'number') {
    // CPC için düşüş iyileşmedir
    if (cpcDelta < -0.15) improvedCount++
    else if (cpcDelta > 0.15) declinedCount++
  }

  if (typeof roasDelta === 'number') {
    if (roasDelta > 0.1) improvedCount++
    else if (roasDelta < -0.1) declinedCount++
  }

  if (improvedCount > declinedCount) {
    return {
      outcome: 'improved',
      summary: `Metrikler iyileşti (${improvedCount} gösterge pozitif).`,
    }
  }
  if (declinedCount > improvedCount) {
    return {
      outcome: 'declined',
      summary: `Metrikler kötüleşti (${declinedCount} gösterge negatif).`,
    }
  }
  return {
    outcome: 'no_change',
    summary: 'Öneri öncesi ve sonrası metrikler benzer seyretti.',
  }
}

/* ── Store functions ── */

/**
 * Before snapshot kaydeder — yeni result row oluşturur.
 */
export async function recordBeforeSnapshot(
  userId: string,
  payload: CreateResultPayload,
): Promise<RecommendationResultRow | null> {
  if (!supabase) {
    console.warn('[ResultTrackingStore] Supabase client yok — AUDIT_LOSS.')
    return null
  }
  try {
    const row = {
      user_id: userId,
      proposal_id: payload.proposalId,
      approval_id: payload.approvalId ?? null,
      source_campaign_id: payload.sourceCampaignId ?? null,
      platform: payload.platform ?? 'meta',
      recommendation_type: payload.recommendationType ?? 'optimization',
      campaign_type: payload.campaignType ?? null,
      proposal_snapshot: payload.proposalSnapshot ?? null,
      before_snapshot: payload.beforeSnapshot,
      before_recorded_at: new Date().toISOString(),
      after_window_days: payload.afterWindowDays ?? 14,
      outcome: 'pending' as const,
      status: 'before_recorded' as const,
    }

    const { data, error } = await supabase
      .from(RESULTS_TABLE)
      .insert(row)
      .select()
      .single()

    if (error) {
      if (error.code === '42P01') {
        console.warn('[ResultTrackingStore] yoai_recommendation_results tablosu yok — AUDIT_LOSS.')
        return null
      }
      console.warn('[ResultTrackingStore] recordBeforeSnapshot error:', error.message)
      return null
    }

    return data as RecommendationResultRow
  } catch (e) {
    console.warn('[ResultTrackingStore] recordBeforeSnapshot exception:', e)
    return null
  }
}

/**
 * After snapshot kaydeder, delta hesaplar, outcome belirler.
 */
export async function recordAfterSnapshot(
  userId: string,
  resultId: string,
  payload: RecordAfterSnapshotPayload,
): Promise<RecommendationResultRow | null> {
  if (!supabase) return null
  try {
    // Mevcut kaydı oku
    const { data: existing, error: fetchErr } = await supabase
      .from(RESULTS_TABLE)
      .select('*')
      .eq('id', resultId)
      .eq('user_id', userId)
      .single()

    if (fetchErr || !existing) {
      console.warn('[ResultTrackingStore] recordAfterSnapshot — kayıt bulunamadı:', resultId)
      return null
    }

    const beforeSnap = (existing.before_snapshot as MetricSnapshot) || {}
    const delta = computeMetricDelta(beforeSnap, payload.afterSnapshot)
    const { outcome, summary } = summarizeOutcomeDeterministic(delta)

    const { data, error } = await supabase
      .from(RESULTS_TABLE)
      .update({
        after_snapshot: payload.afterSnapshot,
        after_recorded_at: new Date().toISOString(),
        metric_delta: delta,
        outcome,
        outcome_summary: summary,
        status: 'after_recorded',
      })
      .eq('id', resultId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.warn('[ResultTrackingStore] recordAfterSnapshot update error:', error.message)
      return null
    }

    return data as RecommendationResultRow
  } catch (e) {
    console.warn('[ResultTrackingStore] recordAfterSnapshot exception:', e)
    return null
  }
}

/**
 * Kullanıcının sonuç kayıtlarını listeler — en yeni önce.
 */
export async function listRecommendationResults(
  userId: string,
  filters?: {
    outcome?: RecommendationResultOutcome
    status?: RecommendationResultStatus
    sourceCampaignId?: string
    limit?: number
  },
): Promise<RecommendationResultRow[]> {
  if (!supabase) return []
  try {
    let query = supabase
      .from(RESULTS_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(filters?.limit ?? 50)

    if (filters?.outcome) {
      query = query.eq('outcome', filters.outcome)
    }
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.sourceCampaignId) {
      query = query.eq('source_campaign_id', filters.sourceCampaignId)
    }

    const { data, error } = await query

    if (error) {
      if (error.code === '42P01') {
        return []
      }
      console.warn('[ResultTrackingStore] listRecommendationResults error:', error.message)
      return []
    }

    return (data as RecommendationResultRow[]) || []
  } catch (e) {
    console.warn('[ResultTrackingStore] listRecommendationResults exception:', e)
    return []
  }
}
