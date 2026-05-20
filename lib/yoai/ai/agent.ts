/* ──────────────────────────────────────────────────────────
   YoAlgoritma AI Engine — Single-Pass Runner

   Claude Sonnet 4.6, tek mesaj çağrısı. Tüm campaign verisi
   (account overview + kampanya detayları + adset + ad + problem_tags
   + sektör benchmark'ları) prompt'a doğrudan koyulur — tool use yok.
   Bu tasarım Batch API uyumlu (her batch item bir messages.create).

   Streaming kullanılır çünkü max_tokens > ~16K iken Anthropic SDK
   "uzun istek koruması" devreye giriyor; final message stream.finalMessage()
   ile alınır.

   Çıktı shape'i (AiEngineResult) persist.ts ve scanUser.ts ile uyumlu.
   ────────────────────────────────────────────────────────── */

import { getAnthropicClient, getAiEngineModel } from '@/lib/anthropic/client'
import {
  buildSystemBlocks,
  buildUserBrief,
} from './systemPrompt'
import { BENCHMARKS, buildAccountOverview, buildCampaignsDetail } from './accountSerializer'
import type {
  AiEngineOutput,
  AiEngineResult,
  AiEngineRunMeta,
  AiEngineTraceEntry,
  AiScanContext,
} from './types'

// Thinking budget + visible output toplamı bu sınırın altında kalmalı.
// Adaptive thinking ~8K, output JSON ~10-14K. Buffer ekledik.
const MAX_TOKENS = 24000
const THINKING_BUDGET = 8000

export interface RunAiEngineArgs {
  ctx: AiScanContext
  industry?: string
  businessContext?: string
}

export async function runAiEngineForAccount(args: RunAiEngineArgs): Promise<AiEngineResult> {
  const client = getAnthropicClient()
  const model = getAiEngineModel()

  const accountSnapshot = buildAccountOverview(args.ctx.platform, args.ctx.accountId, args.ctx.campaigns, args.industry ?? args.ctx.industry)
  const campaignsDetail = buildCampaignsDetail(args.ctx.campaigns)

  const userMessage = buildUserBrief({
    platform: args.ctx.platform,
    accountId: args.ctx.accountId,
    industry: args.industry ?? args.ctx.industry,
    businessContext: args.businessContext,
    accountSnapshot,
    campaignsDetail,
    benchmarks: BENCHMARKS,
  })

  const startedAt = Date.now()
  const trace: AiEngineTraceEntry[] = []

  const stream = client.messages.stream({
    model,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'enabled', budget_tokens: THINKING_BUDGET },
    system: buildSystemBlocks(args.ctx.platform),
    messages: [{ role: 'user', content: userMessage }],
  })
  const response = await stream.finalMessage()

  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const cacheReadTokens = response.usage.cache_read_input_tokens ?? 0
  const cacheCreationTokens = response.usage.cache_creation_input_tokens ?? 0

  let finalText: string | null = null
  for (const block of response.content) {
    if (block.type === 'text') {
      finalText = block.text
      trace.push({ iteration: 1, type: 'text', preview: block.text.slice(0, 200) })
    } else if (block.type === 'thinking') {
      trace.push({ iteration: 1, type: 'thinking', preview: block.thinking?.slice(0, 200) })
    }
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('Model refused.')
  }

  const output = parseFinalOutput(finalText)
  trace.push({
    iteration: 1,
    type: 'final_json',
    preview: output ? 'parsed' : `parse_failed stop=${response.stop_reason} len=${finalText?.length ?? 0}`,
  })

  const meta: AiEngineRunMeta = {
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_tokens: cacheReadTokens,
    cache_creation_tokens: cacheCreationTokens,
    tool_calls_count: 0,
    iterations: 1,
    duration_ms: Date.now() - startedAt,
    trace,
  }

  return { output: output ?? emptyOutput(), meta }
}

/**
 * Batch API için bir hesabı tek bir request'e dönüştürür.
 * Çağıran taraf (Inngest function) bunu messageBatches.create'in
 * `requests` array'ine `{ custom_id, params }` olarak ekler.
 */
export function buildBatchRequestParams(args: RunAiEngineArgs): {
  model: string
  max_tokens: number
  thinking: { type: 'enabled'; budget_tokens: number }
  system: Array<{ type: 'text'; text: string; cache_control: { type: 'ephemeral' } }>
  messages: Array<{ role: 'user'; content: string }>
} {
  const model = getAiEngineModel()
  const accountSnapshot = buildAccountOverview(args.ctx.platform, args.ctx.accountId, args.ctx.campaigns, args.industry ?? args.ctx.industry)
  const campaignsDetail = buildCampaignsDetail(args.ctx.campaigns)
  const userMessage = buildUserBrief({
    platform: args.ctx.platform,
    accountId: args.ctx.accountId,
    industry: args.industry ?? args.ctx.industry,
    businessContext: args.businessContext,
    accountSnapshot,
    campaignsDetail,
    benchmarks: BENCHMARKS,
  })
  return {
    model,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'enabled', budget_tokens: THINKING_BUDGET },
    system: buildSystemBlocks(args.ctx.platform),
    messages: [{ role: 'user', content: userMessage }],
  }
}

/**
 * Batch sonuç mesajını parse edip AiEngineResult'a dönüştürür.
 * Batch API normal Message ile aynı shape döndürür.
 */
export function parseBatchResult(message: {
  content: Array<{ type: string; text?: string; thinking?: string }>
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
  stop_reason: string | null
}, model: string, durationMs: number): AiEngineResult {
  const trace: AiEngineTraceEntry[] = []
  let finalText: string | null = null
  for (const block of message.content) {
    if (block.type === 'text' && block.text) {
      finalText = block.text
      trace.push({ iteration: 1, type: 'text', preview: block.text.slice(0, 200) })
    } else if (block.type === 'thinking' && block.thinking) {
      trace.push({ iteration: 1, type: 'thinking', preview: block.thinking.slice(0, 200) })
    }
  }
  const output = parseFinalOutput(finalText)
  trace.push({
    iteration: 1,
    type: 'final_json',
    preview: output ? 'parsed' : `parse_failed stop=${message.stop_reason} len=${finalText?.length ?? 0}`,
  })
  const meta: AiEngineRunMeta = {
    model,
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
    cache_read_tokens: message.usage.cache_read_input_tokens ?? 0,
    cache_creation_tokens: message.usage.cache_creation_input_tokens ?? 0,
    tool_calls_count: 0,
    iterations: 1,
    duration_ms: durationMs,
    trace,
  }
  return { output: output ?? emptyOutput(), meta }
}

/* ── Final mesajdan JSON parse ────────────────────────────── */
function parseFinalOutput(text: string | null): AiEngineOutput | null {
  if (!text) return null
  try {
    return validateOutput(JSON.parse(text))
  } catch { /* devam */ }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch) {
    try {
      return validateOutput(JSON.parse(fenceMatch[1]))
    } catch { /* devam */ }
  }
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return validateOutput(JSON.parse(text.slice(firstBrace, lastBrace + 1)))
    } catch { /* devam */ }
  }
  return null
}

function validateOutput(raw: unknown): AiEngineOutput {
  const r = raw as Record<string, unknown>
  return {
    critical_alerts: Array.isArray(r.critical_alerts) ? (r.critical_alerts as AiEngineOutput['critical_alerts']) : [],
    opportunities: Array.isArray(r.opportunities) ? (r.opportunities as AiEngineOutput['opportunities']) : [],
    recommended_actions: Array.isArray(r.recommended_actions) ? (r.recommended_actions as AiEngineOutput['recommended_actions']) : [],
    summary: typeof r.summary === 'string' ? r.summary : undefined,
  }
}

function emptyOutput(): AiEngineOutput {
  return { critical_alerts: [], opportunities: [], recommended_actions: [] }
}
