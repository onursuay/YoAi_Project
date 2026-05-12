/**
 * Proposal Visibility Filter — Unit Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/proposalVisibilityFilter.test.ts
 */

import assert from 'assert'
import { filterVisibleYoaiProposals } from '../../lib/yoai/proposalVisibilityFilter'
import { isGenericProposalContent, isEmptyCompetitorInsight, sanitizeProposalForDisplay } from '../../lib/yoai/competitorDisplay'
import type { FullAdProposal } from '../../lib/yoai/adCreator'

let passed = 0
let failed = 0

function test(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e instanceof Error ? e.message : e}`)
    failed++
  }
}

function makeProposal(overrides: Partial<FullAdProposal> = {}): FullAdProposal {
  return {
    id: 'test-id-1',
    platform: 'Meta',
    proposalType: 'optimization',
    campaignName: 'Test Kampanya',
    campaignObjective: 'OUTCOME_TRAFFIC',
    objectiveLabel: 'Trafik',
    dailyBudget: 100,
    adsetName: 'Test Reklam Seti',
    targetingDescription: '25-45 yaş, İstanbul',
    adName: 'Test Reklam',
    primaryText: 'Markanız için özel çözümler sunuyoruz.',
    headline: 'Güçlü Dijital Reklamlar',
    description: 'Hedef kitlenize ulaşın.',
    callToAction: 'LEARN_MORE',
    reasoning: 'CTR düşük, yeni hook dene.',
    competitorInsight: 'Rakipler benzer CTA kullanıyor.',
    expectedPerformance: '%3 CTR bekleniyor.',
    confidence: 75,
    impactLevel: 'high',
    isNewObjective: false,
    analyzedParameters: [],
    suggestedChanges: [],
    ...overrides,
  }
}

// ── Test 1: Generic headline filtrelenir ──
console.log('\n[1] Generic headline filtering')

test('hızlı yanıt al içeren proposal filtrelenir', () => {
  const p = makeProposal({ headline: 'Hızlı Yanıt Al!' })
  assert.strictEqual(isGenericProposalContent(p), true)
})

test('kariyerinize yön verin içeren proposal filtrelenir', () => {
  const p = makeProposal({ headline: 'Kariyerinize Yön Verin!' })
  assert.strictEqual(isGenericProposalContent(p), true)
})

test('yeni ürünler sizi bekliyor içeren proposal filtrelenir', () => {
  const p = makeProposal({ primaryText: 'Yeni Ürünler Sizi Bekliyor! Hemen ziyaret edin.' })
  assert.strictEqual(isGenericProposalContent(p), true)
})

test('hemen başvurun içeren proposal filtrelenir', () => {
  const p = makeProposal({ description: 'Hemen Başvurun ve fırsatları yakalayın!' })
  assert.strictEqual(isGenericProposalContent(p), true)
})

test('fırsatları kaçırmayın içeren proposal filtrelenir', () => {
  const p = makeProposal({ primaryText: 'Fırsatları kaçırmayın, şimdi harekete geçin.' })
  assert.strictEqual(isGenericProposalContent(p), true)
})

// ── Test 2: Meta Ad Library yanlış platformda filtrelenir ──
console.log('\n[2] Wrong competitor source filtering')

test('Google kartında Meta Ad Library içeren insight temizlenir', () => {
  const p = makeProposal({
    platform: 'Google',
    competitorInsight: "Meta Ad Library'den rakip reklam bulunamadı.",
  })
  const sanitized = sanitizeProposalForDisplay(p)
  assert.strictEqual(sanitized.competitorInsight, undefined)
})

test('Meta kartında Meta Ad Library içeren insight temizlenir', () => {
  const p = makeProposal({
    platform: 'Meta',
    competitorInsight: "Meta Ad Library'den eşleşen rakip reklam bulunamadı.",
  })
  const sanitized = sanitizeProposalForDisplay(p)
  assert.strictEqual(sanitized.competitorInsight, undefined)
})

// ── Test 3: policyStatus rejected filtrelenir ──
console.log('\n[3] policyStatus rejected filtering')

test('policyStatus rejected olan proposal filterVisibleYoaiProposals ile kaldırılır', () => {
  const p = makeProposal({ policyStatus: 'rejected' })
  const result = filterVisibleYoaiProposals([p])
  assert.strictEqual(result.length, 0)
})

test('policyStatus publishable olan proposal korunur', () => {
  const p = makeProposal({ policyStatus: 'publishable' })
  const result = filterVisibleYoaiProposals([p])
  assert.strictEqual(result.length, 1)
})

// ── Test 4: approvalStatus expired filtrelenir ──
console.log('\n[4] expired approval filtering')

test('expiredIds içindeki proposal filterVisibleYoaiProposals ile kaldırılır', () => {
  const p = makeProposal({ id: 'expired-id' })
  const result = filterVisibleYoaiProposals([p], { expiredIds: new Set(['expired-id']) })
  assert.strictEqual(result.length, 0)
})

test('expiredIds dışındaki proposal korunur', () => {
  const p = makeProposal({ id: 'active-id' })
  const result = filterVisibleYoaiProposals([p], { expiredIds: new Set(['different-id']) })
  assert.strictEqual(result.length, 1)
})

// ── Test 5: Technical enum filtrelenir ──
console.log('\n[5] Technical enum filtering')

test('OUTCOME_TRAFFIC gibi enum içeren headline filtrelenir', () => {
  const p = makeProposal({ headline: 'OUTCOME_TRAFFIC optimizasyonu' })
  assert.strictEqual(isGenericProposalContent(p), true)
})

test('CONVERSION_VALUE içeren description filtrelenir', () => {
  const p = makeProposal({ description: 'CONVERSION_VALUE hedefli kampanya' })
  assert.strictEqual(isGenericProposalContent(p), true)
})

// ── Test 6: Geçerli mevcut proposal korunur ──
console.log('\n[6] Valid proposal passes filter')

test('gerçek içerikli proposal tüm filtrelerden geçer', () => {
  const p = makeProposal({
    headline: 'Profesyonel SEO Hizmetleri',
    primaryText: 'İşletmenizin online görünürlüğünü artırın.',
    description: "Google'da öne çıkın, müşteri kazanın.",
    policyStatus: 'publishable',
  })
  const result = filterVisibleYoaiProposals([p])
  assert.strictEqual(result.length, 1)
  assert.strictEqual(isGenericProposalContent(p), false)
})

// ── Test 7: Boş competitor insight kaldırılır ──
console.log('\n[7] Empty competitor insight sanitization')

test("bulunamadı mesajı isEmptyCompetitorInsight ile tespit edilir", () => {
  assert.strictEqual(isEmptyCompetitorInsight("Meta Reklam Kütüphanesi'nde eşleşen rakip reklam bulunamadı. Karşılaştırma yapılmadı."), true)
  assert.strictEqual(isEmptyCompetitorInsight("Google Reklam Şeffaflık Merkezi'nde eşleşen rakip reklam bulunamadı. Karşılaştırma yapılmadı."), true)
  assert.strictEqual(isEmptyCompetitorInsight('Rakip reklam verisi bulunamadı. Karşılaştırma yapılmadı.'), true)
})

test('anlamlı competitor insight isEmptyCompetitorInsight ile geçer', () => {
  assert.strictEqual(isEmptyCompetitorInsight('Rakipler %20 daha düşük CPA ile benzer hedefleme kullanıyor.'), false)
})

test('sanitizeProposalForDisplay boş insight için competitorInsight undefined yapar', () => {
  const p = makeProposal({
    platform: 'Meta',
    competitorInsight: "Meta Reklam Kütüphanesi'nde eşleşen rakip reklam bulunamadı. Karşılaştırma yapılmadı.",
  })
  const sanitized = sanitizeProposalForDisplay(p)
  assert.strictEqual(sanitized.competitorInsight, undefined)
})

// ── Test 8: Google/Meta source label ayrımı ──
console.log('\n[8] Platform source label correctness')

test('Google platform için Meta kaynak içeren insight silinir', () => {
  const p = makeProposal({
    platform: 'Google',
    competitorInsight: 'Meta Reklam Kütüphanesi kaynağından alınan rakip reklamlar analiz edildi.',
  })
  const sanitized = sanitizeProposalForDisplay(p)
  assert.strictEqual(sanitized.competitorInsight, undefined)
})

test('Google platform için geçerli Google insight korunur', () => {
  const p = makeProposal({
    platform: 'Google',
    competitorInsight: "Google Şeffaflık Merkezi'nde 3 rakip reklam tespit edildi.",
  })
  const sanitized = sanitizeProposalForDisplay(p)
  assert.notStrictEqual(sanitized.competitorInsight, undefined)
})

// ── Test 9: filterVisibleYoaiProposals generic içeriği filtreler ──
console.log('\n[9] filterVisibleYoaiProposals integration')

test('generic ve temiz proposal karışık listede sadece temizi döner', () => {
  const generic = makeProposal({ id: 'g1', headline: 'Hemen Tıklayın!' })
  const valid = makeProposal({ id: 'v1', headline: 'Profesyonel Dijital Pazarlama' })
  const result = filterVisibleYoaiProposals([generic, valid])
  assert.strictEqual(result.length, 1)
  assert.strictEqual(result[0].id, 'v1')
})

// ── Test 10: Google headlines array içinde generic filtrelenir ──
console.log('\n[10] Google RSA headlines generic filtering')

test('headlines array içinde kaliteli hizmet içeren Google proposal filtrelenir', () => {
  const p = makeProposal({
    platform: 'Google',
    headlines: ['Kaliteli Hizmet', 'Uygun Fiyat'],
    descriptions: ['İşletmenize özel çözümler.'],
  })
  assert.strictEqual(isGenericProposalContent(p), true)
})

test('anlamlı headlines array olan Google proposal geçer', () => {
  const p = makeProposal({
    platform: 'Google',
    headlines: ["İstanbul'da SEO Uzmanı", 'Google Ads Yönetimi', 'Dönüşüm Odaklı Reklamlar'],
    descriptions: ['10 yıllık deneyimle işletmenizi büyütün.'],
  })
  assert.strictEqual(isGenericProposalContent(p), false)
})

// ── Summary ──
console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  process.exit(1)
}
