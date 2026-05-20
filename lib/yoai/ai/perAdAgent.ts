/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Per-Ad Improvement Agent (Faz 2)

   Tek reklam için Batch API request params üretir ve batch sonucunu
   PerAdImprovement'a normalize eder. Hesap-geneli agent.ts'e dokunmaz.

   Maliyet: tek reklam → daha düşük max_tokens + thinking budget
   (hesap-geneli 24K/8K yerine 12K/4K). Paylaşılan bağlam cached block'ta.
   ────────────────────────────────────────────────────────── */

import { getAiEngineModel } from '@/lib/anthropic/client'
import { validateAdSpecPayload } from './adSpecPayload'
import { buildPerAdSystemBlocks, buildPerAdUserBrief, type PerAdContext } from './perAdPrompt'
import type { AdSpec } from './types'

const PER_AD_MAX_TOKENS = 12000
const PER_AD_THINKING_BUDGET = 4000

export interface PerAdImprovementPayload {
  ad_spec: AdSpec | null
  reasoning: string
  competitor_comparison: string | null
  compliance_notes: string[]
  confidence: number // 0-100
}

export interface PerAdImprovement {
  source_ad_id: string
  source_platform: 'meta' | 'google'
  keep_or_improve: 'improve' | 'already_strong'
  improvement_payload: PerAdImprovementPayload
}

export interface PerAdRunMeta {
  model: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_creation_tokens: number
  duration_ms: number
}

/** Tek reklamı Batch API request'ine dönüştürür (Inngest function `requests` array'i için). */
export function buildPerAdBatchRequestParams(args: {
  ctx: PerAdContext
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
    max_tokens: PER_AD_MAX_TOKENS,
    thinking: { type: 'enabled', budget_tokens: PER_AD_THINKING_BUDGET },
    system: buildPerAdSystemBlocks(args.ctx.platform, args.businessContext, args.competitorContext),
    messages: [{ role: 'user', content: buildPerAdUserBrief(args.ctx) }],
  }
}

/** Batch sonuç mesajını PerAdImprovement'a çevirir. */
export function parsePerAdBatchResult(
  message: {
    content: Array<{ type: string; text?: string; thinking?: string }>
    usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
    stop_reason: string | null
  },
  model: string,
  durationMs: number,
  sourceAdId: string,
  sourcePlatform: 'meta' | 'google',
): { improvement: PerAdImprovement | null; meta: PerAdRunMeta } {
  let finalText: string | null = null
  for (const block of message.content) {
    if (block.type === 'text' && block.text) finalText = block.text
  }
  const improvement = parseAndValidate(finalText, sourceAdId, sourcePlatform)
  const meta: PerAdRunMeta = {
    model,
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
    cache_read_tokens: message.usage.cache_read_input_tokens ?? 0,
    cache_creation_tokens: message.usage.cache_creation_input_tokens ?? 0,
    duration_ms: durationMs,
  }
  return { improvement, meta }
}

/* ── JSON extraction (agent.ts ile aynı toleranslı strateji) ── */
function parseAndValidate(text: string | null, sourceAdId: string, sourcePlatform: 'meta' | 'google'): PerAdImprovement | null {
  if (!text) return null
  const candidates: string[] = [text]
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) candidates.push(fence[1])
  const fb = text.indexOf('{')
  const lb = text.lastIndexOf('}')
  if (fb >= 0 && lb > fb) candidates.push(text.slice(fb, lb + 1))
  for (const c of candidates) {
    try {
      return validatePerAdImprovement(JSON.parse(c), sourceAdId, sourcePlatform)
    } catch { /* sonraki adayı dene */ }
  }
  return null
}

function asStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}
function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean)
}
function normConfidence(v: unknown): number {
  let n = typeof v === 'number' && Number.isFinite(v) ? v : 0
  if (n > 0 && n <= 1) n = n * 100 // 0-1 float → 0-100
  return Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * Claude per-ad çıktısını PerAdImprovement'a normalize eder.
 * ad_spec, mevcut validateAdSpecPayload ile doğrulanır (yeniden kullanım).
 * Tamamen kullanılamaz çıktı (reasoning + ad_spec ikisi de yok) → null.
 */
export function validatePerAdImprovement(
  raw: unknown,
  sourceAdId: string,
  sourcePlatform: 'meta' | 'google',
): PerAdImprovement | null {
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? (raw as Record<string, unknown>) : null
  if (!o) return null

  const payload = validateAdSpecPayload({ ad_spec: o.ad_spec })
  const adSpec = payload.kind === 'new_ad_proposal' ? (payload.ad_spec ?? null) : null

  const reasoning = asStr(o.reasoning) ?? ''
  const competitor = asStr(o.competitor_comparison)
  const notes = strArr(o.compliance_notes)
  const confidence = normConfidence(o.confidence)

  const koi = o.keep_or_improve === 'already_strong' || o.keep_or_improve === 'improve'
    ? o.keep_or_improve
    : (adSpec ? 'improve' : 'already_strong')

  // Hiçbir işe yaramaz çıktı → null (kart üretilmez)
  if (!reasoning && !adSpec) return null

  return {
    source_ad_id: asStr(o.source_ad_id) ?? sourceAdId,
    source_platform: sourcePlatform,
    keep_or_improve: koi as 'improve' | 'already_strong',
    improvement_payload: {
      ad_spec: adSpec,
      reasoning,
      competitor_comparison: competitor,
      compliance_notes: notes,
      confidence,
    },
  }
}
