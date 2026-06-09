/**
 * Official Knowledge Block — Unit Tests
 * Çalıştırma: npx tsx src/tests/officialKnowledgeBlock.test.ts
 * Store DI ile enjekte edilir (supabase yüklenmez).
 */
import assert from 'assert'
import {
  renderOfficialKnowledge,
  officialKnowledgeBlock,
} from '../../lib/yoai/ai/docs/officialKnowledgeBlock'
import type { OfficialAdsKnowledgeItem } from '../../lib/yoai/officialAdsKnowledgeStore'

let passed = 0
let failed = 0
const queue: Array<() => Promise<void>> = []
function test(name: string, fn: () => void | Promise<void>): void {
  queue.push(async () => {
    try {
      await fn()
      console.log(`  ✓ ${name}`)
      passed++
    } catch (e) {
      console.error(`  ✗ ${name}`)
      console.error(`    ${e instanceof Error ? e.message : e}`)
      failed++
    }
  })
}

function item(over: Partial<OfficialAdsKnowledgeItem> = {}): OfficialAdsKnowledgeItem {
  return {
    id: '1',
    platform: 'meta',
    category: 'objective',
    title: 'Satış',
    normalized_key: 'meta.objective.outcome_sales',
    summary: 'Online satış kampanyası. Min bütçe 90 TL.',
    rules_json: null,
    allowed_values: null,
    forbidden_values: null,
    compatibility_json: null,
    source_id: null,
    source_url: null,
    source_hash: null,
    source_last_seen_at: null,
    effective_from: null,
    effective_to: null,
    confidence: 0.8,
    review_status: 'approved',
    approved_by: null,
    approved_at: null,
    version: 1,
    created_at: '',
    ...over,
  }
}

test('render: item listesi → etiketli blok metni', () => {
  const text = renderOfficialKnowledge([item()])
  assert.ok(text.includes('GÜNCEL ONAYLI RESMİ BİLGİ'), 'başlık etiketi olmalı')
  assert.ok(text.includes('[objective] Satış'), 'kategori + başlık olmalı')
  assert.ok(text.includes('Min bütçe 90 TL'), 'summary olmalı')
})

test('render: boş liste → boş string', () => {
  assert.strictEqual(renderOfficialKnowledge([]), '')
})

test('block: onaylı item varsa ephemeral-cache blok döner', async () => {
  const block = await officialKnowledgeBlock('Meta', { load: async () => [item()] })
  assert.ok(block)
  assert.strictEqual(block!.type, 'text')
  assert.strictEqual(block!.cache_control.type, 'ephemeral')
  assert.ok(block!.text.includes('Satış'))
})

test('block: onaylı item yoksa null (empty-safe → blok eklenmez)', async () => {
  const block = await officialKnowledgeBlock('Google', { load: async () => [] })
  assert.strictEqual(block, null)
})

test('block: loader hata atarsa null (job patlamaz)', async () => {
  const block = await officialKnowledgeBlock('Meta', {
    load: async () => {
      throw new Error('db down')
    },
  })
  assert.strictEqual(block, null)
})

test('block: platform doğru map edilir (Meta→meta)', async () => {
  let got = ''
  await officialKnowledgeBlock('Meta', {
    load: async (p) => {
      got = p
      return []
    },
  })
  assert.strictEqual(got, 'meta')
})

;(async () => {
  for (const t of queue) await t()
  console.log(`\n${passed + failed} test: ${passed} geçti, ${failed} başarısız`)
  if (failed > 0) process.exit(1)
})()
