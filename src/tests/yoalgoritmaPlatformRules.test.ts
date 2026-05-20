/**
 * YoAlgoritma — Platform Reklam Kuralları (A2) Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/yoalgoritmaPlatformRules.test.ts
 *
 * buildSystemBlocks(platform) — curated Meta/Google reklam kurallarının
 * doğru platforma, cache'li olarak, izole biçimde eklendiğini doğrular.
 */

import assert from 'assert'
import { buildSystemBlocks } from '../../lib/yoai/ai/systemPrompt'
import { META_AD_RULES_CURATED } from '../../lib/yoai/ai/docs/meta_ad_rules_curated'
import { GOOGLE_ADS_RULES_CURATED } from '../../lib/yoai/ai/docs/google_ads_rules_curated'

let passed = 0
let failed = 0
const pending: Array<() => Promise<void>> = []

function test(name: string, fn: () => void | Promise<void>): void {
  pending.push(async () => {
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

const approxTokens = (s: string) => Math.ceil(s.length / 3.6)

test('Meta scan: 2 blok döner, ikisi de cache_control ephemeral', () => {
  const blocks = buildSystemBlocks('Meta')
  assert.strictEqual(blocks.length, 2, '2 system blok bekleniyor')
  for (const b of blocks) {
    assert.strictEqual(b.type, 'text')
    assert.strictEqual(b.cache_control.type, 'ephemeral', 'cache_control eksik')
  }
})

test('Meta scan: 2. blok Meta kurallarını içeriyor', () => {
  const blocks = buildSystemBlocks('Meta')
  const rules = blocks[1].text
  assert.ok(rules.includes('Meta Ads'), 'Meta başlığı yok')
  assert.ok(rules.includes('Advantage+'), 'Advantage+ yok')
  assert.ok(rules.includes('Traffic kampanyası'), 'satış-Traffic hatası kuralı yok')
})

test('Google scan: 2. blok Google kurallarını içeriyor', () => {
  const blocks = buildSystemBlocks('Google')
  const rules = blocks[1].text
  assert.ok(rules.includes('Google Ads'), 'Google başlığı yok')
  assert.ok(rules.includes('Performance Max'), 'PMax yok')
  assert.ok(rules.includes('RSA başlık') && rules.includes('30 karakter'), 'RSA limit kuralı yok')
})

test('Platform izolasyonu: Meta bloğunda Google-özel içerik yok', () => {
  const meta = buildSystemBlocks('Meta')[1].text
  assert.ok(!meta.includes('Performance Max'), 'Meta bloğuna Google PMax sızmış')
  assert.ok(!meta.includes('Merchant Center'), 'Meta bloğuna Google Merchant sızmış')
})

test('Platform izolasyonu: Google bloğunda Meta-özel içerik yok', () => {
  const google = buildSystemBlocks('Google')[1].text
  assert.ok(!google.includes('Advantage+ Placements'), 'Google bloğuna Meta placement sızmış')
})

test('1. blok her iki platformda da aynı (sabit system prompt → cache hit)', () => {
  const meta = buildSystemBlocks('Meta')[0].text
  const google = buildSystemBlocks('Google')[0].text
  assert.strictEqual(meta, google, '1. blok platforma göre değişmemeli')
  assert.ok(meta.includes('Platform reklam kuralları'), 'system prompt platform-kural direktifi yok')
})

test('Token bütçesi: her curated blok 8K token altında', () => {
  assert.ok(approxTokens(META_AD_RULES_CURATED) < 8000, `Meta curated çok büyük: ${approxTokens(META_AD_RULES_CURATED)}`)
  assert.ok(approxTokens(GOOGLE_ADS_RULES_CURATED) < 8000, `Google curated çok büyük: ${approxTokens(GOOGLE_ADS_RULES_CURATED)}`)
})

async function runAll(): Promise<void> {
  console.log('\nYoAlgoritma Platform Kuralları (A2) testleri:\n')
  for (const t of pending) await t()
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  console.log(`Meta curated ~${approxTokens(META_AD_RULES_CURATED)} tok · Google curated ~${approxTokens(GOOGLE_ADS_RULES_CURATED)} tok`)
  if (failed > 0) process.exit(1)
}

runAll()
