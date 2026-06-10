/**
 * Uzman Metin Kalite Rehberi (A2) — Unit Tests
 * Çalıştırma: npx tsx src/tests/copyQualityGuide.test.ts
 */
import assert from 'assert'
import { COPY_QUALITY_GUIDE, copyQualityBlock, isExpertCopyEnabledForYoAlgoritma } from '../../lib/yoai/ai/docs/copyQualityGuide'
import { buildPerCampaignSystemBlocks } from '../../lib/yoai/ai/perCampaignPrompt'
import { buildExpertPlanPrompt } from '../../lib/strategy/expertPlan'

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

test('rehber: temel ikna ilkelerini içerir', () => {
  assert.ok(COPY_QUALITY_GUIDE.includes('HOOK'))
  assert.ok(COPY_QUALITY_GUIDE.includes('ÇOKLU VARYANT'))
  assert.ok(COPY_QUALITY_GUIDE.includes('CTA'))
  assert.ok(COPY_QUALITY_GUIDE.includes('uydurma') || COPY_QUALITY_GUIDE.includes('SOMUTLUK'))
})

test('copyQualityBlock: ephemeral-cache system bloğu', () => {
  const b = copyQualityBlock()
  assert.strictEqual(b.type, 'text')
  assert.strictEqual(b.cache_control.type, 'ephemeral')
  assert.ok(b.text.includes('HOOK'))
})

test('isExpertCopyEnabledForYoAlgoritma: flag mantığı', () => {
  process.env.YOALGORITHM_EXPERT_COPY_ENABLED = 'false'
  assert.strictEqual(isExpertCopyEnabledForYoAlgoritma(), false)
  process.env.YOALGORITHM_EXPERT_COPY_ENABLED = 'true'
  assert.strictEqual(isExpertCopyEnabledForYoAlgoritma(), true)
})

test('REGRESYON: flag kapalı → perCampaign blokları rehber İÇERMEZ', () => {
  delete process.env.YOALGORITHM_EXPERT_COPY_ENABLED
  const blocks = buildPerCampaignSystemBlocks('Meta', undefined, undefined)
  const hasGuide = blocks.some((b) => b.text.includes('İKNA EDİCİ REKLAM METNİ KALİTE'))
  assert.strictEqual(hasGuide, false)
})

test('flag açık → perCampaign blokları rehber İÇERİR', () => {
  process.env.YOALGORITHM_EXPERT_COPY_ENABLED = 'true'
  const blocks = buildPerCampaignSystemBlocks('Meta', undefined, undefined)
  const hasGuide = blocks.some((b) => b.text.includes('İKNA EDİCİ REKLAM METNİ KALİTE'))
  assert.strictEqual(hasGuide, true)
  delete process.env.YOALGORITHM_EXPERT_COPY_ENABLED
})

test('expertPlan (Strateji) prompt rehberi her zaman içerir (DRY tek kaynak)', () => {
  const { system } = buildExpertPlanPrompt(
    {
      input: {
        goal_type: 'sales', product: 'x', industry: 'moda', geographies: ['İstanbul'], language: 'tr',
        monthly_budget_try: 9000, currency: 'TRY', time_horizon_days: 30,
        channels: { meta: true, google: false, tiktok: false },
        integrations: { pixel: 'green', analytics: 'green', crm: 'yellow' },
      },
      platform: 'meta',
    },
    { value: 'OUTCOME_SALES', label: 'Satış' },
  )
  assert.ok(system.includes('İKNA EDİCİ REKLAM METNİ KALİTE'))
})

;(async () => {
  for (const t of queue) await t()
  console.log(`\n${passed + failed} test: ${passed} geçti, ${failed} başarısız`)
  if (failed > 0) process.exit(1)
})()
