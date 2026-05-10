/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Provider Guards (Faz 4)

   Timeout wrapper, JSON parse helper, input hash,
   secret redaction, cost estimation utilities.
   ────────────────────────────────────────────────────────── */

import crypto from 'crypto'

/* ── Timeout wrapper ── */

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`[TIMEOUT] ${label} exceeded ${timeoutMs}ms`)),
      timeoutMs,
    )
    promise.then(
      (result) => { clearTimeout(timer); resolve(result) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}

/* ── JSON parse helper ── */

export type SafeParseResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string }

export function safeParseJson(text: string): SafeParseResult {
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, data: parsed as Record<string, unknown> }
    }
    return { ok: false, error: 'Parsed JSON is not a plain object' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/* ── JSON extraction from text (markdown fence / raw) ── */

export function extractJsonFromText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (fenced) return fenced[1].trim()
  const objMatch = text.match(/\{[\s\S]*\}/)
  if (objMatch) return objMatch[0]
  return text
}

/* ── Secret redaction ── */

export function redactSecrets(input: string): string {
  return input
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/(sk-|AIza)[A-Za-z0-9\-_]{10,}/g, '[REDACTED_KEY]')
}

/* ── Hash helpers ── */

export function hashInput(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16)
}

export function hashObject(obj: unknown): string {
  try {
    const sorted = JSON.stringify(obj, (_, v) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort())
        : v,
    )
    return crypto.createHash('sha256').update(sorted).digest('hex').slice(0, 16)
  } catch {
    return crypto.createHash('sha256').update(String(obj)).digest('hex').slice(0, 16)
  }
}

/* ── Token estimation (rough: 1 token ≈ 4 chars) ── */

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

/* ── Cost estimation (USD, rough) ── */

const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 5.00, output: 15.00 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
}

export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  const p = PRICING[model] || { input: 1.00, output: 5.00 }
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000
}

/* ── String array coercion ── */

export function asStringArray(v: unknown): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  if (typeof v === 'string') return v.trim() ? [v.trim()] : []
  return []
}
