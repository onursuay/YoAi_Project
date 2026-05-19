/* ──────────────────────────────────────────────────────────
   Anthropic SDK Client (singleton)
   Faz 2: YoAlgoritma AI Engine için resmî SDK kullanımı.
   ────────────────────────────────────────────────────────── */

import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY tanımlı değil — AI engine devre dışı.')
  }
  _client = new Anthropic({ apiKey })
  return _client
}

export function isAnthropicReady(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

/**
 * AI Engine için varsayılan model. Sonnet 4.6: hızlı agentic loop +
 * adaptive thinking + 64K output. Override için ANTHROPIC_MODEL_AI_ENGINE.
 */
export function getAiEngineModel(): string {
  return process.env.ANTHROPIC_MODEL_AI_ENGINE || 'claude-sonnet-4-6'
}
