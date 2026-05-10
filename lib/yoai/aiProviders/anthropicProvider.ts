/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Anthropic Provider (Faz 4)

   Risk Policy rolü için Anthropic Messages API çağrısı.
   ANTHROPIC_API_KEY yoksa status='skipped' döner.
   Secret/model raw input loglama yapılmaz.
   ────────────────────────────────────────────────────────── */

import type { RoleDecisionOutput, MultiAiStatus } from '../multiAiTypes'
import {
  safeParseJson,
  extractJsonFromText,
  estimateTokenCount,
  asStringArray,
} from './providerGuards'

function resolveAnthropicModel(): string {
  return (
    process.env.ANTHROPIC_MODEL_RISK_POLICY ||
    process.env.ANTHROPIC_MODEL ||
    'claude-sonnet-4-20250514'
  )
}

function makeSkippedOutput(errorMessage: string, startMs: number): RoleDecisionOutput {
  return {
    role: 'risk_policy',
    provider: 'anthropic',
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
  model: string,
  errorMessage: string,
  latencyMs: number,
  status: MultiAiStatus = 'failed',
): RoleDecisionOutput {
  return {
    role: 'risk_policy',
    provider: 'anthropic',
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

export async function callAnthropicJsonRole(params: {
  role: 'risk_policy'
  systemPrompt: string
  userPrompt: string
  timeoutMs?: number
}): Promise<RoleDecisionOutput> {
  const startMs = Date.now()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return makeSkippedOutput('ANTHROPIC_API_KEY not set', startMs)
  }

  const model = resolveAnthropicModel()
  const timeoutMs = params.timeoutMs ?? 45_000

  try {
    const abortController = new AbortController()
    const timer = setTimeout(() => abortController.abort(), timeoutMs)

    let res: Response
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2000,
          system: params.systemPrompt,
          messages: [{ role: 'user', content: params.userPrompt }],
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
        model,
        `Anthropic ${res.status}: ${errBody.slice(0, 200)}`,
        latencyMs,
      )
    }

    const data = await res.json()
    const content: string | null = data?.content?.[0]?.text ?? null

    if (!content) {
      return makeFailedOutput(model, 'Anthropic content=null', latencyMs)
    }

    const jsonText = extractJsonFromText(content)
    const parsed = safeParseJson(jsonText)
    if (!parsed.ok) {
      return makeFailedOutput(model, `JSON parse error: ${parsed.error}`, latencyMs)
    }

    const usage = data?.usage || {}
    const inputTokens: number =
      usage.input_tokens || estimateTokenCount(params.systemPrompt + params.userPrompt)
    const outputTokens: number =
      usage.output_tokens || estimateTokenCount(content)

    return {
      role: 'risk_policy',
      provider: 'anthropic',
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
    return makeFailedOutput(model, msg, latencyMs, status)
  }
}
