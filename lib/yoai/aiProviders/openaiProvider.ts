/* ──────────────────────────────────────────────────────────
   YoAlgoritma — OpenAI Provider (Faz 4)

   Strategist, Technical Validator ve Judge rolleri için
   OpenAI Chat Completions JSON mode çağrısı.

   OPENAI_API_KEY yoksa status='skipped' döner; sistem kırılmaz.
   ────────────────────────────────────────────────────────── */

import type { MultiAiRole, RoleDecisionOutput, MultiAiStatus } from '../multiAiTypes'
import {
  safeParseJson,
  estimateTokenCount,
  asStringArray,
} from './providerGuards'

/* ── Model resolver ── */

function resolveOpenAiModel(role: MultiAiRole): string {
  const base = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  switch (role) {
    case 'strategist': return process.env.OPENAI_MODEL_STRATEGIST || base
    case 'technical_validator': return process.env.OPENAI_MODEL_TECHNICAL_VALIDATOR || base
    case 'judge': return process.env.OPENAI_MODEL_JUDGE || base
    default: return base
  }
}

/* ── Fallback output builders ── */

function makeSkippedOutput(
  role: MultiAiRole,
  errorMessage: string,
  startMs: number,
): RoleDecisionOutput {
  return {
    role,
    provider: 'openai',
    model: null,
    status: 'skipped',
    confidence: 0,
    riskLevel: null,
    publishReady: false,
    requiresHumanReview: true,
    recommendations: [],
    objections: [],
    evidence: [],
    outputJson: {},
    latencyMs: Date.now() - startMs,
    tokenUsage: {},
    errorMessage,
  }
}

function makeFailedOutput(
  role: MultiAiRole,
  model: string,
  errorMessage: string,
  latencyMs: number,
  status: MultiAiStatus = 'failed',
): RoleDecisionOutput {
  return {
    role,
    provider: 'openai',
    model,
    status,
    confidence: 0,
    riskLevel: null,
    publishReady: false,
    requiresHumanReview: true,
    recommendations: [],
    objections: [],
    evidence: [],
    outputJson: {},
    latencyMs,
    tokenUsage: {},
    errorMessage,
  }
}

/* ── Main export ── */

export async function callOpenAiJsonRole(params: {
  role: MultiAiRole
  systemPrompt: string
  userPrompt: string
  timeoutMs?: number
}): Promise<RoleDecisionOutput> {
  const startMs = Date.now()

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return makeSkippedOutput(params.role, 'OPENAI_API_KEY not set', startMs)
  }

  const model = resolveOpenAiModel(params.role)
  const timeoutMs = params.timeoutMs ?? 45_000

  try {
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    const abortController = new AbortController()
    const timer = setTimeout(() => abortController.abort(), timeoutMs)

    let res: Response
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userPrompt },
          ],
          temperature: 0.4,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        }),
        signal: abortController.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    const latencyMs = Date.now() - startMs

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      return makeFailedOutput(
        params.role,
        model,
        `OpenAI ${res.status}: ${errBody.slice(0, 200)}`,
        latencyMs,
      )
    }

    const data = await res.json()
    const content: string | null = data?.choices?.[0]?.message?.content ?? null
    const finishReason: string | undefined = data?.choices?.[0]?.finish_reason

    if (!content) {
      return makeFailedOutput(
        params.role,
        model,
        `OpenAI content=null, finish_reason=${finishReason}`,
        latencyMs,
      )
    }

    const parsed = safeParseJson(content)
    if (!parsed.ok) {
      return makeFailedOutput(params.role, model, `JSON parse error: ${parsed.error}`, latencyMs)
    }

    const usage = data?.usage || {}
    const inputTokens: number =
      usage.prompt_tokens || estimateTokenCount(params.systemPrompt + params.userPrompt)
    const outputTokens: number =
      usage.completion_tokens || estimateTokenCount(content)

    return {
      role: params.role,
      provider: 'openai',
      model,
      status: 'success',
      confidence: Number(parsed.data.confidence ?? 70),
      riskLevel: String(parsed.data.riskLevel ?? 'medium'),
      publishReady: Boolean(parsed.data.publishReady ?? false),
      requiresHumanReview: Boolean(parsed.data.requiresHumanReview ?? true),
      recommendations: asStringArray(parsed.data.recommendations),
      objections: asStringArray(parsed.data.objections),
      evidence: asStringArray(parsed.data.evidence),
      outputJson: parsed.data,
      latencyMs,
      tokenUsage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    }
  } catch (e) {
    const latencyMs = Date.now() - startMs
    const msg = e instanceof Error ? e.message : String(e)
    const status: MultiAiStatus =
      msg.includes('aborted') || msg.includes('TIMEOUT') ? 'timeout' : 'failed'
    return makeFailedOutput(params.role, model, msg, latencyMs, status)
  }
}
