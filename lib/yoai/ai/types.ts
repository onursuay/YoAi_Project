/* ──────────────────────────────────────────────────────────
   YoAlgoritma AI Engine — Output Types (Faz 2)
   Claude single-pass çağrısının döndüreceği final JSON.
   ────────────────────────────────────────────────────────── */

import type { DeepCampaignInsight } from '@/lib/yoai/analysisTypes'

export type AiPlatform = 'Meta' | 'Google'

/** Hesap başına AI engine context — kampanya snapshot + sektör. */
export interface AiScanContext {
  platform: AiPlatform
  accountId: string
  campaigns: DeepCampaignInsight[]
  industry?: string
}
export type AiSeverity = 'critical' | 'high' | 'medium'
export type AiPriority = 'high' | 'medium' | 'low'
export type AiTargetType = 'account' | 'campaign' | 'adset' | 'ad' | 'ad_group'

export interface AiAlert {
  severity: AiSeverity
  title: string
  reason: string
  suggested_action?: string
  confidence: number  // 0-100; model'in kendi belirsizlik tahmini
  target_entity_type?: AiTargetType
  target_entity_id?: string
  target_entity_name?: string
  evidence?: Record<string, unknown>
}

export interface AiOpportunity {
  category: string  // 'audience_expansion' | 'creative_refresh' | 'budget_reallocation' | ...
  title: string
  expected_impact?: string
  action?: string
  confidence: number
  target_entity_type?: AiTargetType
  target_entity_id?: string
  target_entity_name?: string
  evidence?: Record<string, unknown>
}

export interface AiRecommendedAction {
  priority: AiPriority
  action_type: string  // 'pause_campaign' | 'increase_budget' | 'refresh_creative' | ...
  title: string
  reasoning: string  // AI GEREKÇESİ — dolu gelmek ZORUNDA
  expected_impact?: string
  confidence: number
  target_entity_type: AiTargetType
  target_entity_id: string
  target_entity_name?: string
  payload?: Record<string, unknown>
}

export interface AiEngineOutput {
  critical_alerts: AiAlert[]
  opportunities: AiOpportunity[]
  recommended_actions: AiRecommendedAction[]
  summary?: string  // opsiyonel kısa hesap özeti
}

export interface AiEngineRunMeta {
  model: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_creation_tokens: number
  tool_calls_count: number
  iterations: number
  duration_ms: number
  trace: AiEngineTraceEntry[]
}

export interface AiEngineTraceEntry {
  iteration: number
  type: 'tool_use' | 'text' | 'thinking' | 'final_json' | 'error'
  tool_name?: string
  tool_input_keys?: string[]
  tool_error?: boolean
  preview?: string  // ilk ~200 char text/thinking
}

export interface AiEngineResult {
  output: AiEngineOutput
  meta: AiEngineRunMeta
}
