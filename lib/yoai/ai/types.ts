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
  payload?: AdSpecPayload | Record<string, unknown>
}

/* ──────────────────────────────────────────────────────────
   A5 — Tam Ad Spec (ai_suggestions.payload JSONB şeması)

   Migration yok: spec mevcut payload kolonuna yazılır. Şema oturunca
   (1-2 ay) en çok kullanılan alanlar tipli kolonlara terfi edilebilir.
   kind ile "optimizasyon önerisi" vs "sıfırdan ad spec önerisi" ayrılır.
   ────────────────────────────────────────────────────────── */

export type AdSpecKind = 'optimization' | 'new_ad_proposal'

export interface AdSpecCurrentMetric {
  name: string
  value: number
  benchmark?: number
}

export interface AdSpecAction {
  type: string
  target_id: string
  current_metric?: AdSpecCurrentMetric
}

export interface AdSpecBudget {
  daily?: number
  lifetime?: number
  currency: string
}

export interface AdSpecDemographics {
  age_min: number
  age_max: number
  genders: Array<'male' | 'female' | 'all'>
}

export interface AdSpecTargeting {
  locations: string[]
  /** Meta'da zorunlu. Google Arama Ağı anahtar kelimeyle hedeflendiği için opsiyonel. */
  demographics?: AdSpecDemographics
  placements: string[]
  interests?: string[]
  /** Google Arama Ağı (RSA) için anahtar kelime hedefleme. */
  keywords?: string[]
}

export interface AdSpecAssetRequirements {
  format: 'image' | 'video' | 'carousel' | 'collection'
  dimensions?: string
  duration_seconds?: number
  notes?: string
}

export interface AdSpecCreative {
  brief: string
  headlines: string[]
  descriptions: string[]
  primary_text?: string
  /** Meta/PMax/Display/Video görsel-video reklamlarında zorunlu. Metin tabanlı RSA'da yok. */
  asset_requirements?: AdSpecAssetRequirements
}

export interface AdSpec {
  platform: 'meta' | 'google'
  campaign_type: string
  conversion_goal: string
  cta: string
  budget: AdSpecBudget
  targeting: AdSpecTargeting
  creative: AdSpecCreative
  compliance_notes: string[]
}

export interface AdSpecPayload {
  kind: AdSpecKind
  action?: AdSpecAction
  ad_spec?: AdSpec | null
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
