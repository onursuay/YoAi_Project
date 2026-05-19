/* ──────────────────────────────────────────────────────────
   YoAlgoritma AI Engine — Agentic Loop Runner (Faz 2)

   Claude Sonnet 4.6 + adaptive thinking + tool use ile döngü.
   Manual loop kullanıyoruz (tool runner beta) — her iterasyonda:
     1. messages.create() çağır (cached system prompt + tools)
     2. response.content iç bloklarını gez
     3. tool_use varsa dispatchTool() ile çalıştır, tool_result ile döngüye devam
     4. stop_reason 'end_turn' olduğunda son metin bloğundan JSON parse et

   Prompt caching: system prompt + tools birlikte cache'lenir
   (5dk TTL). Aynı gün içinde yeniden tarama olursa yüksek cache hit.

   Hata yönetimi: typed Anthropic exception'ları yakalanır, geçici
   hatalar SDK tarafından otomatik retry edilir (max_retries=2 default).
   ────────────────────────────────────────────────────────── */

import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient, getAiEngineModel } from '@/lib/anthropic/client'
import {
  AI_ENGINE_SYSTEM_PROMPT,
  AI_ENGINE_SYSTEM_PROMPT_SINGLE_PASS,
  buildUserBrief,
  buildUserBriefSinglePass,
} from './systemPrompt'
import { buildTools, dispatchTool, type ToolContext } from './tools'
import { BENCHMARKS, buildAccountOverview, buildCampaignsDetail } from './accountSerializer'
import type {
  AiEngineOutput,
  AiEngineResult,
  AiEngineRunMeta,
  AiEngineTraceEntry,
} from './types'

const MAX_ITERATIONS = 15
const MAX_TOKENS_PER_TURN = 16000
// Single-pass: thinking + visible output toplamı için yeterli pay
// (adaptive thinking 10K kadar tüketebilir; output JSON 6-10K)
const SINGLE_PASS_MAX_TOKENS = 24000
const SINGLE_PASS_THINKING_BUDGET = 8000

export interface RunAiEngineArgs {
  ctx: ToolContext
  industry?: string
  businessContext?: string
}

export async function runAiEngineForAccount(args: RunAiEngineArgs): Promise<AiEngineResult> {
  const client = getAnthropicClient()
  const model = getAiEngineModel()
  const tools = buildTools()

  const startedAt = Date.now()
  const trace: AiEngineTraceEntry[] = []
  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens = 0
  let cacheCreationTokens = 0
  let toolCallsCount = 0
  let iterations = 0

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: buildUserBrief({
        platform: args.ctx.platform,
        accountId: args.ctx.accountId,
        industry: args.industry,
        businessContext: args.businessContext,
      }),
    },
  ]

  let finalText: string | null = null

  while (iterations < MAX_ITERATIONS) {
    iterations++

    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS_PER_TURN,
      thinking: { type: 'adaptive' },
      tools,
      system: [
        {
          type: 'text',
          text: AI_ENGINE_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    })

    // Usage tracking
    inputTokens += response.usage.input_tokens
    outputTokens += response.usage.output_tokens
    cacheReadTokens += response.usage.cache_read_input_tokens ?? 0
    cacheCreationTokens += response.usage.cache_creation_input_tokens ?? 0

    // Append assistant turn — tool_use bloklarını korumak ZORUNDA (manual loop kuralı)
    messages.push({ role: 'assistant', content: response.content })

    // Trace assistant content
    for (const block of response.content) {
      if (block.type === 'text') {
        trace.push({ iteration: iterations, type: 'text', preview: block.text.slice(0, 200) })
      } else if (block.type === 'thinking') {
        trace.push({ iteration: iterations, type: 'thinking', preview: block.thinking?.slice(0, 200) })
      } else if (block.type === 'tool_use') {
        trace.push({
          iteration: iterations,
          type: 'tool_use',
          tool_name: block.name,
          tool_input_keys: Object.keys((block.input as Record<string, unknown>) ?? {}),
        })
      }
    }

    // Bitiş: tool_use yoksa end_turn — final metin
    if (response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence') {
      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
      finalText = textBlock?.text ?? null
      break
    }

    if (response.stop_reason === 'refusal') {
      throw new Error('Model refused (refusal stop_reason). System prompt veya hesap durumu kontrol edilmeli.')
    }

    if (response.stop_reason === 'max_tokens') {
      // Bir turn max_tokens'a takılırsa — kullanıcı kayboldu sanmasın diye trace'e yaz ama devam ettir
      // (tool sonuçları ekleyip devam edemiyoruz çünkü zaten end_turn değil)
      trace.push({ iteration: iterations, type: 'error', preview: 'max_tokens reached on a non-tool turn' })
      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
      finalText = textBlock?.text ?? null
      break
    }

    // tool_use stop → tool'ları çalıştır
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )

    if (toolUseBlocks.length === 0) {
      // tool_use stop_reason ama tool block yok — savunmacı: çık
      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
      finalText = textBlock?.text ?? null
      break
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const tu of toolUseBlocks) {
      toolCallsCount++
      const result = await dispatchTool(tu.name, (tu.input as Record<string, unknown>) ?? {}, args.ctx)
      if (!result.ok) {
        trace.push({
          iteration: iterations,
          type: 'tool_use',
          tool_name: tu.name,
          tool_error: true,
          preview: result.error,
        })
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify({ error: result.error }),
          is_error: true,
        })
      } else {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result.data),
        })
      }
    }

    messages.push({ role: 'user', content: toolResults })
  }

  if (iterations >= MAX_ITERATIONS && finalText == null) {
    trace.push({ iteration: iterations, type: 'error', preview: 'max iterations reached without final JSON' })
  }

  const output = parseFinalOutput(finalText)
  trace.push({ iteration: iterations, type: 'final_json', preview: output ? 'parsed' : 'parse_failed' })

  const meta: AiEngineRunMeta = {
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_tokens: cacheReadTokens,
    cache_creation_tokens: cacheCreationTokens,
    tool_calls_count: toolCallsCount,
    iterations,
    duration_ms: Date.now() - startedAt,
    trace,
  }

  return { output: output ?? emptyOutput(), meta }
}

/* ── Final mesajdan JSON parse ────────────────────────────── */
function parseFinalOutput(text: string | null): AiEngineOutput | null {
  if (!text) return null
  // Direkt parse dene
  try {
    return validateOutput(JSON.parse(text))
  } catch { /* devam */ }
  // Markdown code fence içinde olabilir
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch) {
    try {
      return validateOutput(JSON.parse(fenceMatch[1]))
    } catch { /* devam */ }
  }
  // İlk { ile son } arasında JSON arıyoruz (savunmacı)
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

/* ──────────────────────────────────────────────────────────
   Single-Pass Runner (Batch API uyumlu)

   Tool kullanılmaz; tüm campaign verisi user message içinde
   structured JSON olarak Claude'a sunulur. Tek messages.create
   çağrısı yapılır, response içindeki text bloğundan final JSON
   parse edilir.

   Bu fonksiyon hem normal API ile (smoke testing) hem ileride
   Batch API request'i olarak (build edip messageBatches.create'a
   gönderilecek) kullanılabilir. Aynı output shape'i (AiEngineResult)
   döndürdüğü için persist.ts'i bozmaz.
   ────────────────────────────────────────────────────────── */
export async function runAiEngineSinglePass(args: RunAiEngineArgs): Promise<AiEngineResult> {
  const client = getAnthropicClient()
  const model = getAiEngineModel()

  const accountSnapshot = buildAccountOverview(args.ctx.platform, args.ctx.accountId, args.ctx.campaigns, args.industry)
  const campaignsDetail = buildCampaignsDetail(args.ctx.campaigns)

  const userMessage = buildUserBriefSinglePass({
    platform: args.ctx.platform,
    accountId: args.ctx.accountId,
    industry: args.industry,
    businessContext: args.businessContext,
    accountSnapshot,
    campaignsDetail,
    benchmarks: BENCHMARKS,
  })

  const startedAt = Date.now()
  const trace: AiEngineTraceEntry[] = []

  // Streaming zorunlu (max_tokens > ~16K, "long request" guard). Final message ile aynı shape.
  const stream = client.messages.stream({
    model,
    max_tokens: SINGLE_PASS_MAX_TOKENS,
    thinking: { type: 'enabled', budget_tokens: SINGLE_PASS_THINKING_BUDGET },
    system: [
      {
        type: 'text',
        text: AI_ENGINE_SYSTEM_PROMPT_SINGLE_PASS,
        cache_control: { type: 'ephemeral' },
      },
    ],
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
    throw new Error('Model refused (single-pass).')
  }

  const output = parseFinalOutput(finalText)
  trace.push({
    iteration: 1,
    type: 'final_json',
    preview: output
      ? 'parsed'
      : `parse_failed stop=${response.stop_reason} finalText_len=${finalText?.length ?? 0}`,
  })

  // Debug: parse fail ise finalText'in başını ve sonunu trace'e koy
  if (!output && finalText) {
    trace.push({ iteration: 1, type: 'text', preview: 'HEAD:' + finalText.slice(0, 400) })
    trace.push({ iteration: 1, type: 'text', preview: 'TAIL:' + finalText.slice(-400) })
  }

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
