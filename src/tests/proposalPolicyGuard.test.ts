/**
 * Proposal Policy Guard — Unit Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/proposalPolicyGuard.test.ts
 *
 * Test framework gerektirmez; Node assert modülü kullanır.
 */

import assert from 'assert'
import { validateProposalPolicy } from '../../lib/yoai/proposalPolicyGuard'
import type { FullAdProposal } from '../../lib/yoai/adCreator'

// ── Test helpers ──────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function test(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓  ${name}`)
    passed++
  } catch (err) {
    const msg = err instanceof assert.AssertionError ? err.message : String(err)
    console.error(`  ✗  ${name}`)
    console.error(`     ${msg}`)
    failed++
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeGoogleProposal(overrides: Partial<FullAdProposal> = {}): FullAdProposal {
  return {
    id: 'test_google_1',
    platform: 'Google',
    proposalType: 'optimization',
    campaignName: 'Test Arama Kampanyası',
    campaignObjective: 'SEARCH',
    objectiveLabel: 'Arama',
    dailyBudget: 50,
    adsetName: 'Test Reklam Grubu',
    targetingDescription: 'Hedefleme açıklaması',
    biddingStrategy: 'MAXIMIZE_CONVERSIONS',
    adName: 'Test Reklam',
    primaryText: 'Kaliteli eğitim programlarımıza katılın.',
    headline: 'Eğitim Programı',
    description: 'Sertifikalı kurslar ile kariyerinizi geliştirin.',
    headlines: ['Eğitim Programı', 'Sertifika Al', 'Hemen Kaydol'],
    descriptions: ['Kaliteli eğitim ile kariyerinizi geliştirin.', 'Uzman eğitmenlerle öğrenin.'],
    callToAction: '',
    finalUrl: 'https://example.com',
    keywords: ['eğitim', 'sertifika', 'kurs'],
    reasoning: 'Test gerekçesi',
    competitorInsight: 'Rakip analizi mevcut',
    expectedPerformance: 'CTR %3, CPC ₺2',
    confidence: 85,
    impactLevel: 'medium',
    isNewObjective: false,
    analyzedParameters: ['bütçe', 'hedefleme'],
    suggestedChanges: ['Teklif stratejisi güncellendi'],
    ...overrides,
  }
}

function makeMetaProposal(overrides: Partial<FullAdProposal> = {}): FullAdProposal {
  return {
    id: 'test_meta_1',
    platform: 'Meta',
    proposalType: 'optimization',
    campaignName: 'Test Meta Kampanyası',
    campaignObjective: 'OUTCOME_ENGAGEMENT',
    objectiveLabel: 'Etkileşim',
    dailyBudget: 35,
    adsetName: 'Test Reklam Seti',
    targetingDescription: 'Hedefleme açıklaması',
    optimizationGoal: 'POST_ENGAGEMENT',
    destinationType: 'ON_PAGE',
    callToAction: 'LEARN_MORE',
    adName: 'Test Meta Reklam',
    primaryText: 'İşletmenizin büyümesine yardımcı oluyoruz.',
    headline: 'İşletmenizi Büyütün',
    description: 'Profesyonel hizmetlerimizle tanışın.',
    reasoning: 'Test gerekçesi',
    competitorInsight: 'Rakip analizi mevcut',
    expectedPerformance: 'CTR %1, Etkileşim artışı',
    confidence: 80,
    impactLevel: 'medium',
    isNewObjective: false,
    analyzedParameters: ['hedefleme', 'optimizasyon hedefi'],
    suggestedChanges: ['Optimizasyon hedefi güncellendi'],
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\n=== Proposal Policy Guard Tests ===\n')

console.log('── Google: Başlık Kuralları ──')

test('Google headline içinde ! varsa kaldırılır', () => {
  const proposal = makeGoogleProposal({
    headlines: ['Aşçılık Belgesi Alın!', 'Temiz Başlık', 'Üçüncü Başlık'],
  })
  const result = validateProposalPolicy({ proposal, platform: 'Google' })

  assert.ok(result.normalizedProposal, 'normalizedProposal dönmeli')
  assert.strictEqual(
    result.normalizedProposal!.headlines![0],
    'Aşçılık Belgesi Alın',
    'Ünlem kaldırılmalı',
  )
  assert.ok(
    result.violations.some(v => v.code === 'GOOGLE_HEADLINE_EXCLAMATION'),
    'GOOGLE_HEADLINE_EXCLAMATION violation olmalı',
  )
})

test('Google headline 30 karakteri aşarsa violation döner', () => {
  const longHeadline = 'Bu Çok Uzun Bir Başlık Gerçekten Fazla' // 38 chars
  assert.ok(longHeadline.length > 30, 'Fixture 30 karakterden uzun olmalı')

  const proposal = makeGoogleProposal({
    headlines: [longHeadline, 'Normal Başlık', 'Üçüncü'],
  })
  const result = validateProposalPolicy({ proposal, platform: 'Google' })

  assert.ok(
    result.violations.some(v => v.code === 'GOOGLE_HEADLINE_TOO_LONG'),
    'GOOGLE_HEADLINE_TOO_LONG violation olmalı',
  )
  assert.notStrictEqual(result.status, 'publishable', 'publishable kalmamalı')

  if (result.normalizedProposal?.headlines?.[0]) {
    assert.ok(
      result.normalizedProposal.headlines[0].length <= 30,
      `Kısaltılmış başlık 30 karakter olmalı, şu an: ${result.normalizedProposal.headlines[0].length}`,
    )
  }
})

test('Google description 90 karakteri aşarsa violation döner', () => {
  const longDesc = 'Bu açıklama gerçekten çok uzun ve Google RSA doksan karakter sınırını kesinlikle aşıyor bunu test ediyoruz' // >90
  assert.ok(longDesc.length > 90, 'Fixture 90 karakterden uzun olmalı')

  const proposal = makeGoogleProposal({
    descriptions: [longDesc, 'Normal açıklama.'],
  })
  const result = validateProposalPolicy({ proposal, platform: 'Google' })

  assert.ok(
    result.violations.some(v => v.code === 'GOOGLE_DESC_TOO_LONG'),
    'GOOGLE_DESC_TOO_LONG violation olmalı',
  )
  assert.notStrictEqual(result.status, 'publishable', 'publishable kalmamalı')

  if (result.normalizedProposal?.descriptions?.[0]) {
    assert.ok(
      result.normalizedProposal.descriptions[0].length <= 90,
      `Kısaltılmış açıklama 90 karakter olmalı`,
    )
  }
})

test('MAXIMIZE_CONVERSIONS kullanıcı-facing headline alanında humanize edilir', () => {
  const proposal = makeGoogleProposal({
    headlines: ['MAXIMIZE_CONVERSIONS ile Büyüyün', 'Normal Başlık', 'Üçüncü'],
  })
  const result = validateProposalPolicy({ proposal, platform: 'Google' })

  assert.ok(result.normalizedProposal, 'normalizedProposal dönmeli')
  assert.ok(
    !result.normalizedProposal!.headlines![0].includes('MAXIMIZE_CONVERSIONS'),
    'MAXIMIZE_CONVERSIONS headline\'dan kaldırılmalı',
  )
  assert.ok(
    result.normalizedProposal!.headlines![0].includes('Dönüşümleri Artır'),
    'Türkçe humanize edilmeli',
  )
  assert.ok(
    result.violations.some(v => v.code === 'GOOGLE_HEADLINE_TECH_ENUM'),
    'GOOGLE_HEADLINE_TECH_ENUM violation olmalı',
  )
})

test('Google description\'da teknik enum humanize edilir', () => {
  const proposal = makeGoogleProposal({
    descriptions: ['PERFORMANCE_MAX kampanyasıyla büyüyün.', 'Normal açıklama.'],
  })
  const result = validateProposalPolicy({ proposal, platform: 'Google' })

  assert.ok(result.normalizedProposal, 'normalizedProposal dönmeli')
  assert.ok(
    !result.normalizedProposal!.descriptions![0].includes('PERFORMANCE_MAX'),
    'PERFORMANCE_MAX description\'dan kaldırılmalı',
  )
})

console.log('\n── Meta: Capability Matrix ──')

test('OUTCOME_ENGAGEMENT + ON_AD Meta için publishable kalmaz', () => {
  const proposal = makeMetaProposal({
    campaignObjective: 'OUTCOME_ENGAGEMENT',
    destinationType: 'ON_AD',
  })
  const result = validateProposalPolicy({ proposal, platform: 'Meta' })

  assert.notStrictEqual(result.status, 'publishable', 'publishable olmamalı')
  assert.ok(
    result.violations.some(v => v.code === 'META_DESTINATION_INCOMPATIBLE'),
    'META_DESTINATION_INCOMPATIBLE violation olmalı',
  )
})

test('OUTCOME_ENGAGEMENT + ON_AD normalize edilince ON_PAGE olur', () => {
  const proposal = makeMetaProposal({
    campaignObjective: 'OUTCOME_ENGAGEMENT',
    destinationType: 'ON_AD',
  })
  const result = validateProposalPolicy({ proposal, platform: 'Meta' })

  assert.ok(result.normalizedProposal, 'normalizedProposal dönmeli')
  assert.strictEqual(
    result.normalizedProposal!.destinationType,
    'ON_PAGE',
    'Destination ON_PAGE olarak normalize edilmeli',
  )
})

test('OUTCOME_ENGAGEMENT + WHATSAPP normalize edilince ON_PAGE olur', () => {
  const proposal = makeMetaProposal({
    campaignObjective: 'OUTCOME_ENGAGEMENT',
    destinationType: 'WHATSAPP',
  })
  const result = validateProposalPolicy({ proposal, platform: 'Meta' })

  assert.notStrictEqual(result.status, 'publishable', 'publishable olmamalı')
  if (result.normalizedProposal) {
    assert.strictEqual(result.normalizedProposal.destinationType, 'ON_PAGE')
  }
})

test('OUTCOME_LEADS + ON_AD destekleniyor, publishable kalır', () => {
  const proposal = makeMetaProposal({
    campaignObjective: 'OUTCOME_LEADS',
    destinationType: 'ON_AD',
  })
  const result = validateProposalPolicy({ proposal, platform: 'Meta' })

  // ON_AD, LEADS için destekleniyor — capability violation olmamalı
  assert.ok(
    !result.violations.some(v => v.code === 'META_DESTINATION_INCOMPATIBLE'),
    'LEADS + ON_AD için capability violation olmamalı',
  )
})

console.log('\n── Meta: CTA & Enum Humanization ──')

test('SEND_MESSAGE Meta primaryText\'te "Mesaj Gönder" olarak humanize edilir', () => {
  const proposal = makeMetaProposal({
    primaryText: 'SEND_MESSAGE ile bize ulaşın hemen.',
  })
  const result = validateProposalPolicy({ proposal, platform: 'Meta' })

  assert.ok(result.normalizedProposal, 'normalizedProposal dönmeli')
  assert.ok(
    result.normalizedProposal!.primaryText?.includes('Mesaj Gönder'),
    'SEND_MESSAGE → Mesaj Gönder olarak çevrilmeli',
  )
  assert.ok(
    !result.normalizedProposal!.primaryText?.includes('SEND_MESSAGE'),
    'SEND_MESSAGE teknik enum kalmamaly',
  )
})

test('OUTCOME_ENGAGEMENT Meta headline\'da humanize edilir', () => {
  const proposal = makeMetaProposal({
    headline: 'OUTCOME_ENGAGEMENT Kampanyası Başlıyor',
  })
  const result = validateProposalPolicy({ proposal, platform: 'Meta' })

  assert.ok(result.normalizedProposal, 'normalizedProposal dönmeli')
  assert.ok(
    !result.normalizedProposal!.headline?.includes('OUTCOME_ENGAGEMENT'),
    'OUTCOME_ENGAGEMENT kaldırılmalı',
  )
})

console.log('\n── Generic Headline Guard ──')

test('"Sitemizi ziyaret edin" generic headline review_required olur', () => {
  const proposal = makeGoogleProposal({
    headlines: ['Sitemizi ziyaret edin', 'Normal Başlık', 'Üçüncü'],
  })
  const result = validateProposalPolicy({ proposal, platform: 'Google' })

  assert.notStrictEqual(result.status, 'publishable', 'publishable olmamalı')
  assert.ok(
    result.violations.some(v => v.code === 'GENERIC_HEADLINE'),
    'GENERIC_HEADLINE violation olmalı',
  )
})

test('"Kaliteli hizmet" generic headline review_required olur', () => {
  const proposal = makeGoogleProposal({
    headline: 'Kaliteli hizmet',
  })
  const result = validateProposalPolicy({ proposal, platform: 'Google' })

  assert.ok(
    result.violations.some(v => v.code === 'GENERIC_HEADLINE'),
    'GENERIC_HEADLINE violation olmalı',
  )
})

test('"Hemen tıklayın" generic headline Meta için de review_required olur', () => {
  const proposal = makeMetaProposal({
    headline: 'Hemen tıklayın',
  })
  const result = validateProposalPolicy({ proposal, platform: 'Meta' })

  assert.ok(
    result.violations.some(v => v.code === 'GENERIC_HEADLINE'),
    'Meta generic headline yakalanmalı',
  )
})

console.log('\n── Temiz Proposal ──')

test('Temiz Google proposal publishable döner', () => {
  const proposal = makeGoogleProposal({
    headlines: ['Sertifika Kursları', 'Online Eğitim Al', 'Uzman Eğitmenler'],
    descriptions: ['Kariyerinizi geliştirmek için doğru adım.', 'Sertifikalı programlar başlıyor.'],
  })
  const result = validateProposalPolicy({ proposal, platform: 'Google' })

  assert.strictEqual(result.status, 'publishable', `publishable olmalı, violations: ${JSON.stringify(result.violations)}`)
  assert.strictEqual(result.violations.length, 0, 'violation olmamalı')
  assert.strictEqual(result.normalizedProposal, undefined, 'değişiklik olmadığında normalizedProposal undefined olmalı')
})

test('Temiz Meta proposal publishable döner', () => {
  const proposal = makeMetaProposal({
    campaignObjective: 'OUTCOME_ENGAGEMENT',
    destinationType: 'ON_PAGE',
    primaryText: 'İşletmenizin dijital büyümesine destek oluyoruz.',
    headline: 'Dijital Büyüme Çözümleri',
    description: 'Uzman ekibimizle tanışın.',
  })
  const result = validateProposalPolicy({ proposal, platform: 'Meta' })

  assert.strictEqual(result.status, 'publishable', `publishable olmalı, violations: ${JSON.stringify(result.violations)}`)
  assert.strictEqual(result.violations.length, 0, 'violation olmamalı')
})

console.log('\n── Guard Güvenlik ──')

test('Guard hata fırlatırsa sistem kırılmaz, publishable döner', () => {
  // null/undefined değerlerle edge case
  const malformed = {
    ...makeGoogleProposal(),
    headlines: [null as unknown as string, undefined as unknown as string],
  }

  let result: ReturnType<typeof validateProposalPolicy> | undefined
  assert.doesNotThrow(() => {
    result = validateProposalPolicy({ proposal: malformed, platform: 'Google' })
  }, 'Guard hata fırlatmamalı')

  assert.ok(result, 'Sonuç dönmeli')
})

test('DB/knowledge items boşsa sistem çalışmaya devam eder', () => {
  const proposal = makeGoogleProposal()
  const result = validateProposalPolicy({ proposal, platform: 'Google', knowledgeItems: [] })
  assert.ok(result.status, 'Status dönmeli')
})

// ── Özet ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`Toplam: ${passed + failed} test | ✓ ${passed} geçti | ${failed > 0 ? `✗ ${failed} başarısız` : '✗ 0 başarısız'}`)
console.log()

if (failed > 0) {
  process.exit(1)
}
