/**
 * Meta Analiz Bilgisi Entegrasyonu — Unit Tests
 * Çalıştırma: npx tsx src/tests/metaAnalysisKnowledge.test.ts
 * Test framework gerektirmez; Node assert modülü kullanır.
 */
import assert from 'assert'
import {
  META_ANALYSIS_KNOWLEDGE,
  META_CREATIVE_PRINCIPLES,
  metaAnalysisBlock,
} from '../../lib/yoai/ai/docs/meta_analysis_knowledge'
import { buildPerCampaignSystemBlocks } from '../../lib/yoai/ai/perCampaignPrompt'
import { buildPerAdSystemBlocks } from '../../lib/yoai/ai/perAdPrompt'
// <<BUILDER IMPORTS — yeni import'ları BU SATIRIN ÜSTÜNE ekle>>

const FULL_MARKER = 'Meta Reklam Analiz Bilgisi'
const CREATIVE_MARKER = 'Meta Reklam Kreatif İlkeleri'

let passed = 0
let failed = 0
const queue: Array<() => Promise<void>> = []
function test(name: string, fn: () => void | Promise<void>): void {
  queue.push(async () => {
    try { await fn(); console.log(`  ✓  ${name}`); passed++ }
    catch (err) {
      const msg = err instanceof assert.AssertionError ? err.message : String(err)
      console.error(`  ✗  ${name}`); console.error(`     ${msg}`); failed++
    }
  })
}

// ── Task 1: içerik kontratı ──
test('META_ANALYSIS_KNOWLEDGE ana başlığı ve kilit kavramları içerir', () => {
  assert.ok(META_ANALYSIS_KNOWLEDGE.includes(FULL_MARKER), 'ana başlık yok')
  const lower = META_ANALYSIS_KNOWLEDGE.toLowerCase()
  for (const m of ['marjinal', 'breakdown', 'öğrenme faz', 'auction', 'pacing', 'uygunluk tan']) {
    assert.ok(lower.includes(m), `eksik kavram: ${m}`)
  }
})
test('META_CREATIVE_PRINCIPLES kreatif odaklı, teşhis dolgusu içermez', () => {
  assert.ok(META_CREATIVE_PRINCIPLES.includes(CREATIVE_MARKER), 'kreatif başlık yok')
  assert.ok(META_CREATIVE_PRINCIPLES.toLowerCase().includes('hook'), 'hook yok')
  assert.ok(!META_CREATIVE_PRINCIPLES.includes('Öğrenme Fazı'), 'kreatif alt-küme learning phase içermemeli')
  assert.ok(!META_CREATIVE_PRINCIPLES.includes('Pacing'), 'kreatif alt-küme pacing içermemeli')
})
test('metaAnalysisBlock() cached system block döndürür', () => {
  const b = metaAnalysisBlock()
  assert.strictEqual(b.type, 'text')
  assert.strictEqual(b.cache_control.type, 'ephemeral')
  assert.ok(b.text.includes(FULL_MARKER))
})

test('perCampaign: Meta system block bilgi içerir, Google içermez', () => {
  const meta = buildPerCampaignSystemBlocks('Meta')
  const google = buildPerCampaignSystemBlocks('Google')
  assert.ok(meta.some((b) => b.text.includes(FULL_MARKER)), 'Meta bloğunda bilgi yok')
  assert.ok(!google.some((b) => b.text.includes(FULL_MARKER)), 'Google bloğunda bilgi OLMAMALI')
})

test('perAd: Meta system block bilgi içerir, Google içermez', () => {
  const meta = buildPerAdSystemBlocks('Meta')
  const google = buildPerAdSystemBlocks('Google')
  assert.ok(meta.some((b) => b.text.includes(FULL_MARKER)), 'Meta bloğunda bilgi yok')
  assert.ok(!google.some((b) => b.text.includes(FULL_MARKER)), 'Google bloğunda bilgi OLMAMALI')
})

// <<INJECTION TESTS — yeni test()'leri BU SATIRIN ÜSTÜNE ekle>>

async function run() {
  for (const t of queue) await t()
  console.log(`\n${passed + failed} test: ${passed} geçti, ${failed} başarısız\n`)
  if (failed > 0) process.exit(1)
}
run()
