/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Per-Campaign Hierarchical Agent (Faz 3)

   Tek kampanya (+ tüm ad set'leri + reklamları) için Batch API request
   params üretir ve batch sonucunu hiyerarşik PerCampaignResult'a
   normalize eder. Hesap-geneli agent.ts + per-ad agent'a dokunmaz.

   Çıktı 4 seviyeli: account_alerts / campaign_improvement /
   adset_improvements[] / ad_improvements[].
   ────────────────────────────────────────────────────────── */

import { getAiEngineModel } from '@/lib/anthropic/client'
import { validateAdSpecPayload } from './adSpecPayload'
import { buildPerCampaignSystemBlocks, buildPerCampaignUserBrief, type PerCampaignContext } from './perCampaignPrompt'
import type { AdSpec } from './types'

// Tüm reklamları + ad set'leri tek istekte → hesap-geneli (24K/8K) ile
// per-ad (12K/4K) arası. Çok reklamlı kampanyalarda yeterli çıktı alanı.
const PER_CAMPAIGN_MAX_TOKENS = 24000
const PER_CAMPAIGN_THINKING_BUDGET = 6000

/* ── Sonuç tipleri (hiyerarşik) ── */
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'info'

export interface AccountAlertItem {
  alert_type: string
  severity: AlertSeverity
  title: string
  body: string | null
  recommended_action: string | null
  confidence: number
}

export interface CampaignTypeMismatchAlert {
  reason: string
  recommended_type: string | null
  recommended_action: string
}

export interface ImprovementSuggestion {
  title: string
  detail: string
}

export interface CampaignImprovementResult {
  campaign_id: string
  type_mismatch: boolean
  current_objective_label: string | null
  recommended_objective_label: string | null
  type_mismatch_alert: CampaignTypeMismatchAlert | null
  reasoning: string
  suggestions: ImprovementSuggestion[]
  confidence: number
}

export interface AdsetImprovementResult {
  adset_id: string
  reasoning: string
  suggestions: ImprovementSuggestion[]
  confidence: number
}

export interface AdImprovementResult {
  ad_id: string
  keep_or_improve: 'improve' | 'already_strong'
  reasoning: string
  competitor_comparison: string | null
  compliance_notes: string[]
  confidence: number
  ad_spec: AdSpec | null
}

export interface PerCampaignResult {
  account_alerts: AccountAlertItem[]
  campaign_improvement: CampaignImprovementResult | null
  adset_improvements: AdsetImprovementResult[]
  ad_improvements: AdImprovementResult[]
}

export interface PerCampaignRunMeta {
  model: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_creation_tokens: number
  duration_ms: number
}

/** Tek kampanyayı Batch API request'ine dönüştürür (Inngest `requests` array'i için). */
export function buildPerCampaignBatchRequestParams(args: {
  ctx: PerCampaignContext
  businessContext?: string
  competitorContext?: string | null
}): {
  model: string
  max_tokens: number
  thinking: { type: 'enabled'; budget_tokens: number }
  system: Array<{ type: 'text'; text: string; cache_control: { type: 'ephemeral' } }>
  messages: Array<{ role: 'user'; content: string }>
} {
  return {
    model: getAiEngineModel(),
    max_tokens: PER_CAMPAIGN_MAX_TOKENS,
    thinking: { type: 'enabled', budget_tokens: PER_CAMPAIGN_THINKING_BUDGET },
    system: buildPerCampaignSystemBlocks(args.ctx.platform, args.businessContext, args.competitorContext),
    messages: [{ role: 'user', content: buildPerCampaignUserBrief(args.ctx) }],
  }
}

/* ── Toleranslı JSON yardımcıları (agent.ts/perAdAgent.ts ile aynı stil) ── */
function asStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}
function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean)
}
function normConfidence(v: unknown): number {
  let n = typeof v === 'number' && Number.isFinite(v) ? v : 0
  if (n > 0 && n <= 1) n = n * 100
  return Math.max(0, Math.min(100, Math.round(n)))
}
function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}
function normSeverity(v: unknown): AlertSeverity {
  return v === 'critical' || v === 'high' || v === 'medium' || v === 'info' ? v : 'medium'
}
function suggestions(v: unknown): ImprovementSuggestion[] {
  if (!Array.isArray(v)) return []
  const out: ImprovementSuggestion[] = []
  for (const item of v) {
    const o = obj(item)
    if (!o) {
      // Düz string öneri de kabul et
      const s = asStr(item)
      if (s) out.push({ title: s, detail: '' })
      continue
    }
    const title = asStr(o.title) ?? asStr(o.detail) ?? ''
    const detail = asStr(o.detail) ?? ''
    if (title || detail) out.push({ title: title || detail, detail: title ? detail : '' })
  }
  return out
}

/* ── Validators ── */
function validateAccountAlert(raw: unknown): AccountAlertItem | null {
  const o = obj(raw)
  if (!o) return null
  const title = asStr(o.title)
  if (!title) return null
  return {
    alert_type: asStr(o.alert_type) ?? 'other',
    severity: normSeverity(o.severity),
    title,
    body: asStr(o.body),
    recommended_action: asStr(o.recommended_action),
    confidence: normConfidence(o.confidence),
  }
}

function validateCampaignImprovement(raw: unknown, fallbackId: string): CampaignImprovementResult | null {
  const o = obj(raw)
  if (!o) return null
  const reasoning = asStr(o.reasoning) ?? ''
  const sugg = suggestions(o.suggestions)
  const typeMismatch = o.type_mismatch === true
  let mismatchAlert: CampaignTypeMismatchAlert | null = null
  const ma = obj(o.type_mismatch_alert)
  if (typeMismatch && ma) {
    const reason = asStr(ma.reason)
    if (reason) {
      mismatchAlert = {
        reason,
        recommended_type: asStr(ma.recommended_type),
        recommended_action: asStr(ma.recommended_action) ?? 'Yeni Kampanya Oluştur — Eskiyi Duraklat',
      }
    }
  }
  // Hiçbir işe yaramaz çıktı → null
  if (!reasoning && sugg.length === 0 && !mismatchAlert) return null
  return {
    campaign_id: asStr(o.campaign_id) ?? fallbackId,
    type_mismatch: typeMismatch,
    current_objective_label: asStr(o.current_objective_label),
    recommended_objective_label: asStr(o.recommended_objective_label),
    type_mismatch_alert: mismatchAlert,
    reasoning,
    suggestions: sugg,
    confidence: normConfidence(o.confidence),
  }
}

function validateAdsetImprovement(raw: unknown): AdsetImprovementResult | null {
  const o = obj(raw)
  if (!o) return null
  const adsetId = asStr(o.adset_id)
  if (!adsetId) return null
  const reasoning = asStr(o.reasoning) ?? ''
  const sugg = suggestions(o.suggestions)
  if (!reasoning && sugg.length === 0) return null
  return { adset_id: adsetId, reasoning, suggestions: sugg, confidence: normConfidence(o.confidence) }
}

function validateAdImprovement(raw: unknown): AdImprovementResult | null {
  const o = obj(raw)
  if (!o) return null
  const adId = asStr(o.ad_id)
  if (!adId) return null
  const payload = validateAdSpecPayload({ ad_spec: o.ad_spec })
  const adSpec = payload.kind === 'new_ad_proposal' ? (payload.ad_spec ?? null) : null
  const reasoning = asStr(o.reasoning) ?? ''
  const koi = o.keep_or_improve === 'already_strong' || o.keep_or_improve === 'improve'
    ? o.keep_or_improve
    : (adSpec ? 'improve' : 'already_strong')
  // reasoning + ad_spec ikisi de yoksa işe yaramaz
  if (!reasoning && !adSpec) return null
  return {
    ad_id: adId,
    keep_or_improve: koi as 'improve' | 'already_strong',
    reasoning,
    competitor_comparison: asStr(o.competitor_comparison),
    compliance_notes: strArr(o.compliance_notes),
    confidence: normConfidence(o.confidence),
    ad_spec: adSpec,
  }
}

function emptyResult(): PerCampaignResult {
  return { account_alerts: [], campaign_improvement: null, adset_improvements: [], ad_improvements: [] }
}

export function validatePerCampaignResult(raw: unknown, fallbackCampaignId: string): PerCampaignResult {
  const o = obj(raw)
  if (!o) return emptyResult()
  const account_alerts = Array.isArray(o.account_alerts)
    ? o.account_alerts.map(validateAccountAlert).filter((x): x is AccountAlertItem => x !== null)
    : []
  const campaign_improvement = validateCampaignImprovement(o.campaign_improvement, fallbackCampaignId)
  const adset_improvements = Array.isArray(o.adset_improvements)
    ? o.adset_improvements.map(validateAdsetImprovement).filter((x): x is AdsetImprovementResult => x !== null)
    : []
  const ad_improvements = Array.isArray(o.ad_improvements)
    ? o.ad_improvements.map(validateAdImprovement).filter((x): x is AdImprovementResult => x !== null)
    : []
  return { account_alerts, campaign_improvement, adset_improvements, ad_improvements }
}

/* ── Batch sonuç parse ── */
function extractJson(text: string | null): unknown {
  if (!text) return null
  const candidates: string[] = [text]
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) candidates.push(fence[1])
  const fb = text.indexOf('{')
  const lb = text.lastIndexOf('}')
  if (fb >= 0 && lb > fb) candidates.push(text.slice(fb, lb + 1))
  for (const c of candidates) {
    try {
      return JSON.parse(c)
    } catch { /* sonraki aday */ }
  }
  return null
}

/** Batch sonuç mesajını PerCampaignResult'a çevirir. */
export function parsePerCampaignBatchResult(
  message: {
    content: Array<{ type: string; text?: string; thinking?: string }>
    usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
    stop_reason: string | null
  },
  model: string,
  durationMs: number,
  fallbackCampaignId: string,
): { result: PerCampaignResult; meta: PerCampaignRunMeta } {
  let finalText: string | null = null
  for (const block of message.content) {
    if (block.type === 'text' && block.text) finalText = block.text
  }
  const result = validatePerCampaignResult(extractJson(finalText), fallbackCampaignId)
  const meta: PerCampaignRunMeta = {
    model,
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
    cache_read_tokens: message.usage.cache_read_input_tokens ?? 0,
    cache_creation_tokens: message.usage.cache_creation_input_tokens ?? 0,
    duration_ms: durationMs,
  }
  return { result, meta }
}
