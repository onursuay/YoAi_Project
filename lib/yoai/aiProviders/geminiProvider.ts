/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Gemini Provider (Faz 4)

   Creative rolü için Google Gemini generateContent çağrısı.
   GEMINI_API_KEY yoksa status='skipped' döner.
   Bu fazda görsel/video input yok; text-only creative analysis.
   Görsel asset yoksa "visual assets unavailable" notu alır.
   ────────────────────────────────────────────────────────── */

import type { RoleDecisionOutput, MultiAiStatus } from '../multiAiTypes'
import {
  safeParseJson,
  extractJsonFromText,
  estimateTokenCount,
  asStringArray,
} from './providerGuards'

function resolveGeminiModel(): string {
  return (
    process.env.GEMINI_MODEL ||
    process.env.GOOGLE_AI_MODEL ||
    'gemini-1.5-flash'
  )
}

function makeSkippedOutput(errorMessage: string, startMs: number): RoleDecisionOutput {
  return {
    role: 'creative',
    provider: 'gemini',
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
    role: 'creative',
    provider: 'gemini',
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

export async function callGeminiJsonRole(params: {
  role: 'creative'
  systemPrompt: string
  userPrompt: string
  timeoutMs?: number
}): Promise<RoleDecisionOutput> {
  const startMs = Date.now()

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return makeSkippedOutput('GEMINI_API_KEY not set', startMs)
  }

  const model = resolveGeminiModel()
  const timeoutMs = params.timeoutMs ?? 45_000

  try {
    const abortController = new AbortController()
    const timer = setTimeout(() => abortController.abort(), timeoutMs)

    // Gemini system + user → tek prompt (text-only, bu fazda)
    const fullPrompt = `${params.systemPrompt}\n\n${params.userPrompt}`

    let res: Response
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 2000,
              responseMimeType: 'application/json',
            },
          }),
          signal: abortController.signal,
        },
      )
    } finally {
      clearTimeout(timer)
    }

    const latencyMs = Date.now() - startMs

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      return makeFailedOutput(
        model,
        `Gemini ${res.status}: ${errBody.slice(0, 200)}`,
        latencyMs,
      )
    }

    const data = await res.json()
    const content: string | null =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null

    if (!content) {
      const finishReason: string | undefined = data?.candidates?.[0]?.finishReason
      return makeFailedOutput(
        model,
        `Gemini content=null, finishReason=${finishReason}`,
        latencyMs,
      )
    }

    const jsonText = extractJsonFromText(content)
    const parsed = safeParseJson(jsonText)
    if (!parsed.ok) {
      return makeFailedOutput(model, `JSON parse error: ${parsed.error}`, latencyMs)
    }

    const usageMeta = data?.usageMetadata || {}
    const inputTokens: number =
      usageMeta.promptTokenCount || estimateTokenCount(fullPrompt)
    const outputTokens: number =
      usageMeta.candidatesTokenCount || estimateTokenCount(content)

    return {
      role: 'creative',
      provider: 'gemini',
      model,
      status: 'success',
      confidence: Number(parsed.data.confidence ?? 60),
      riskLevel: String(parsed.data.riskLevel ?? 'low'),
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
