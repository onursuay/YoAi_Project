/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Multi-AI Decision Desk Types (Faz 4)

   Tüm rol çıktıları ve desk sonucu için tip tanımlamaları.
   Publish davranışı değişmez; shadow mode audit only.
   ────────────────────────────────────────────────────────── */

import type { CampaignSynthesisPackage } from './synthesisTypes'

/* ── Temel enum sabitleri ── */

export type MultiAiRole =
  | 'strategist'
  | 'creative'
  | 'risk_policy'
  | 'technical_validator'
  | 'judge'

export type MultiAiProvider =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'deterministic'

export type MultiAiStatus =
  | 'success'
  | 'failed'
  | 'skipped'
  | 'timeout'
  | 'disabled'
  | 'skipped_cost_guard'

export type JudgeFinalDecision =
  | 'publish_ready'
  | 'needs_edit'
  | 'reject'
  | 'hold'
  | 'needs_human_review'

/* ── Decision input ── */

export interface MultiAiDecisionInput {
  userId: string
  synthesisPackage: CampaignSynthesisPackage
  proposalId?: string | null
}

/* ── Base rol çıktısı ── */

export interface RoleDecisionOutput {
  role: MultiAiRole
  provider: MultiAiProvider
  model: string | null
  status: MultiAiStatus
  confidence: number           // 0-100
  riskLevel: string | null
  publishReady: boolean
  requiresHumanReview: boolean
  recommendations: string[]
  objections: string[]
  evidence: string[]
  outputJson: Record<string, unknown>
  latencyMs: number
  tokenUsage: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
  errorMessage?: string
}

/* ── Spesifik rol çıktıları ── */

export interface StrategistDecision extends RoleDecisionOutput {
  role: 'strategist'
  provider: 'openai'
  campaignStrategyNotes: string
  recommendedAngle: string
  biddingRecommendation: string
  targetingRecommendation: string
  campaignTypeFidelity: boolean
}

export interface CreativeDecision extends RoleDecisionOutput {
  role: 'creative'
  provider: 'gemini'
  creativeDirection: string
  headlineIdeas: string[]
  ctaIdeas: string[]
  visualAssetsNote: string
}

export interface RiskPolicyDecision extends RoleDecisionOutput {
  role: 'risk_policy'
  provider: 'anthropic'
  policyRisks: string[]
  unresolvedRisks: string[]
  humanReviewReasons: string[]
}

export interface TechnicalValidatorDecision extends RoleDecisionOutput {
  role: 'technical_validator'
  provider: 'openai' | 'deterministic'
  missingFields: string[]
  platformCompatibilityNotes: string
  budgetGuardPass: boolean
  publishReadiness: boolean
}

export interface JudgeDecision extends RoleDecisionOutput {
  role: 'judge'
  provider: 'openai'
  finalDecision: JudgeFinalDecision
  campaignTypeFidelity: boolean
  finalRecommendation: string
  finalCreativeBrief: string
  finalPayloadNotes: string
  unresolvedRisks: string[]
  requiredHumanChecks: string[]
  reason: string
}

/* ── Desk result (tüm rol çıktıları + sentez) ── */

export interface MultiAiDecisionDeskResult {
  enabled: boolean
  status: 'completed' | 'partial' | 'all_skipped' | 'disabled' | 'error'
  campaignId: string
  platform: string
  campaignType: string
  synthesisHash: string
  roles: {
    strategist: StrategistDecision | null
    creative: CreativeDecision | null
    riskPolicy: RiskPolicyDecision | null
    technicalValidator: TechnicalValidatorDecision | null
    judge: JudgeDecision | null
  }
  judgeDecision: JudgeFinalDecision | null
  overallConfidence: number
  overallRiskLevel: string
  publishReady: boolean
  requiresHumanReview: boolean
  /** adCreator prompt'una eklenecek kısa context bloğu. */
  decisionContextForPrompt: string
  costGuardTriggered: boolean
  totalLatencyMs: number
  error?: string
}

/* ── Run options ── */

export interface MultiAiRunOptions {
  /** Provider başına timeout (ms). Default: 45000 */
  timeoutMs?: number
  /** Maliyet guard limiti (USD approx). Default: disabled */
  maxCostUsd?: number
  /** Audit için proposal ID. */
  proposalId?: string | null
}

/* ── Cost guard ── */

export interface MultiAiCostGuardResult {
  allowed: boolean
  estimatedCostUsd: number
  reason?: string
}
