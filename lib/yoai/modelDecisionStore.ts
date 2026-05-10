/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Model Decision Store (Faz 4)

   yoai_model_decisions tablosuna audit kayıtları yazar.
   Tablo yoksa console.warn [MODEL_DECISION_STORE][TABLE_MISSING]
   basar; sistem kırılmaz.

   Secret / raw token yok; output_json sanitize edilir.
   ────────────────────────────────────────────────────────── */

import { supabase } from '@/lib/supabase/client'
import type { RoleDecisionOutput, MultiAiDecisionDeskResult } from './multiAiTypes'
import { hashObject } from './aiProviders/providerGuards'

const TABLE = 'yoai_model_decisions'
const TAG = '[MODEL_DECISION_STORE]'

/* ── DB row tipi ── */

interface ModelDecisionRow {
  user_id: string
  proposal_id: string | null
  source_campaign_id: string | null
  platform: string | null
  campaign_type: string | null
  synthesis_hash: string
  role: string
  provider: string
  model: string | null
  input_hash: string
  output_json: Record<string, unknown>
  raw_excerpt: string | null
  confidence: number
  risk_level: string | null
  publish_ready: boolean
  requires_human_review: boolean
  cost_estimate: Record<string, unknown>
  token_usage: Record<string, unknown>
  latency_ms: number | null
  status: string
  error_message: string | null
}

/* ── Sanitize helper: token/key içeren field'ları temizler ── */

function sanitizeDecisionOutput(
  output: Record<string, unknown>,
): Record<string, unknown> {
  const banned = new Set([
    'api_key',
    'apikey',
    'authorization',
    'bearer',
    'token',
    'secret',
    'password',
    'credential',
  ])
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(output)) {
    if (banned.has(k.toLowerCase())) continue
    clean[k] = v
  }
  return clean
}

/* ── Role output → DB row ── */

function roleOutputToRow(params: {
  userId: string
  decisionResult: MultiAiDecisionDeskResult
  roleOutput: RoleDecisionOutput
}): ModelDecisionRow {
  const { userId, decisionResult, roleOutput } = params
  return {
    user_id: userId,
    proposal_id: null,
    source_campaign_id: decisionResult.campaignId,
    platform: decisionResult.platform,
    campaign_type: decisionResult.campaignType,
    synthesis_hash: decisionResult.synthesisHash,
    role: roleOutput.role,
    provider: roleOutput.provider,
    model: roleOutput.model,
    input_hash: hashObject({
      campaignId: decisionResult.campaignId,
      role: roleOutput.role,
    }),
    output_json: sanitizeDecisionOutput(roleOutput.outputJson),
    raw_excerpt: roleOutput.recommendations.slice(0, 3).join(' | ').slice(0, 500) || null,
    confidence: Math.round(roleOutput.confidence),
    risk_level: roleOutput.riskLevel,
    publish_ready: roleOutput.publishReady,
    requires_human_review: roleOutput.requiresHumanReview,
    cost_estimate: {},
    token_usage: roleOutput.tokenUsage as Record<string, unknown>,
    latency_ms: roleOutput.latencyMs,
    status: roleOutput.status,
    error_message: roleOutput.errorMessage ?? null,
  }
}

/* ── Exports ── */

export async function recordModelDecision(
  userId: string,
  decisionResult: MultiAiDecisionDeskResult,
  roleOutput: RoleDecisionOutput,
): Promise<void> {
  if (!supabase) return
  const row = roleOutputToRow({ userId, decisionResult, roleOutput })
  const { error } = await supabase.from(TABLE).insert(row)
  if (error) {
    if (error.code === '42P01') {
      console.warn(`${TAG}[TABLE_MISSING] ${TABLE} not found. Run migration.`)
    } else {
      console.warn(`${TAG}[INSERT_ERROR]`, error.message)
    }
  }
}

export async function recordModelDecisionBatch(
  userId: string,
  decisionResult: MultiAiDecisionDeskResult,
  roleOutputs: RoleDecisionOutput[],
): Promise<void> {
  if (!supabase) return
  if (roleOutputs.length === 0) return

  const rows = roleOutputs.map((ro) =>
    roleOutputToRow({ userId, decisionResult, roleOutput: ro }),
  )

  const { error } = await supabase.from(TABLE).insert(rows)
  if (error) {
    if (error.code === '42P01') {
      console.warn(`${TAG}[TABLE_MISSING] ${TABLE} not found. Run migration.`)
    } else {
      console.warn(`${TAG}[BATCH_INSERT_ERROR]`, error.message)
    }
  }
}

export async function listModelDecisions(
  userId: string,
  filters?: {
    sourceCampaignId?: string
    role?: string
    provider?: string
    limit?: number
  },
): Promise<Record<string, unknown>[]> {
  if (!supabase) return []
  try {
    let query = supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(filters?.limit ?? 50)

    if (filters?.sourceCampaignId) {
      query = query.eq('source_campaign_id', filters.sourceCampaignId)
    }
    if (filters?.role) {
      query = query.eq('role', filters.role)
    }
    if (filters?.provider) {
      query = query.eq('provider', filters.provider)
    }

    const { data, error } = await query
    if (error) {
      if (error.code === '42P01') {
        console.warn(`${TAG}[TABLE_MISSING] ${TABLE} not found.`)
      } else {
        console.warn(`${TAG}[LIST_ERROR]`, error.message)
      }
      return []
    }
    return (data || []) as Record<string, unknown>[]
  } catch (e) {
    console.warn(`${TAG}[LIST_EXCEPTION]`, e instanceof Error ? e.message : String(e))
    return []
  }
}

export async function getLatestDecisionDeskResult(
  userId: string,
  sourceCampaignId: string,
): Promise<Record<string, unknown>[]> {
  return listModelDecisions(userId, {
    sourceCampaignId,
    limit: 10,
  })
}
