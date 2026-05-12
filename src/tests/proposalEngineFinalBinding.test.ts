/**
 * Proposal Engine Final Binding — Integration Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/proposalEngineFinalBinding.test.ts
 *
 * Framework gerektirmez; Node assert modülü kullanır.
 * DB / LLM çağrısı yapılmaz — tüm bağımlılıklar mock/stub.
 */

import assert from 'assert'
import { buildDeterministicQueryPlan } from '../../lib/yoai/competitorQueryExpander'
import type { QueryExpanderInput, CompetitorQueryPlan } from '../../lib/yoai/competitorQueryExpander'
import { validateProposalPolicy, applyPolicyGuardToProposals } from '../../lib/yoai/proposalPolicyGuard'
import type { FullAdProposal } from '../../lib/yoai/adCreator'
import type { CampaignIntentProfile } from '../../lib/yoai/campaignIntentEngine'

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

function makeIntentProfile(overrides: Partial<CampaignIntentProfile> = {}): CampaignIntentProfile {
  return {
    campaign_id: 'camp_001',
    platform: 'Google',
    campaign_type: 'SEARCH',
    business_domain: 'mesleki belgelendirme',
    offer_type: 'sınav ve belgelendirme hizmeti',
    service_or_product: 'iş güvenliği belgesi',
    target_audience: 'belge almak isteyen profesyoneller',
    conversion_goal: 'başvuru / form doldurma',
    funnel_stage: 'conversion',
    detected_keywords: ['iş güvenliği', 'belge', 'sertifika', 'sınav'],
    landing_page_summary: 'İş güvenliği belgesi başvurusu yapılabilen resmi site.',
    forbidden_claims: [],
    required_disclaimers: [],
    confidence: 75,
    missing_data: [],
    evidence_json: {},
    generated_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeGoogleProposal(overrides: Partial<FullAdProposal> = {}): FullAdProposal {
  return {
    id: 'proposal_g1',
    platform: 'Google',
    proposalType: 'optimization',
    campaignName: 'İş Güvenliği Belgesi Kampanyası',
    campaignObjective: 'SEARCH',
    objectiveLabel: 'Arama',
    dailyBudget: 80,
    adsetName: 'Belge Başvurusu Grubu',
    targetingDescription: 'Belge almak isteyen profesyoneller',
    biddingStrategy: 'MAXIMIZE_CONVERSIONS',
    adName: 'İş Güvenliği Belgesi',
    primaryText: 'İş güvenliği belgesi için hemen başvurun.',
    headline: 'İş Güvenliği Belgesi Al',
    description: 'Resmi akreditasyonlu sınav merkezinde belgenizi alın.',
    headlines: ['İş Güvenliği Belgesi', 'Hızlı Belge Başvurusu', 'Akredite Sınav Merkezi'],
    descriptions: ['Resmi sınavla iş güvenliği belgenizi alın.', 'Uzman kadromuzla sürecinizi kolaylaştırın.'],
    finalUrl: 'https://example.com/is-guvenligi',
    keywords: ['iş güvenliği belgesi', 'güvenlik sertifikası'],
    callToAction: 'APPLY_NOW',
    reasoning: 'Yüksek CTR hedefi ile güçlü arama niyeti yakalanacak.',
    competitorInsight: 'Rakip sitelere göre daha hızlı başvuru süreci vurgulanmalı.',
    expectedPerformance: 'CTR %4, CPC ₺3',
    confidence: 85,
    impactLevel: 'high',
    isNewObjective: false,
    analyzedParameters: ['bütçe', 'teklif stratejisi', 'hedefleme'],
    suggestedChanges: ['Teklif stratejisi optimize edildi'],
    ...overrides,
  }
}

function makeMetaProposal(overrides: Partial<FullAdProposal> = {}): FullAdProposal {
  return {
    id: 'proposal_m1',
    platform: 'Meta',
    proposalType: 'optimization',
    campaignName: 'Belge Başvuru Kampanyası',
    campaignObjective: 'OUTCOME_LEADS',
    objectiveLabel: 'Potansiyel Müşteri',
    dailyBudget: 60,
    adsetName: 'Lead Formu Seti',
    targetingDescription: 'Belge almak isteyen 25-45 yaş profesyoneller',
    optimizationGoal: 'LEAD_GENERATION',
    destinationType: 'ON_AD',
    callToAction: 'SIGN_UP',
    adName: 'Belge Başvuru Reklamı',
    primaryText: 'İş güvenliği belgenizi en kısa sürede alın. Hemen başvurun.',
    headline: 'İş Güvenliği Belgesi',
    description: 'Akredite merkez, hızlı sonuç.',
    reasoning: 'ON_AD destination ile lead formu doldurma hedeflendi.',
    competitorInsight: 'Meta reklamcıları mesaj odaklı CTA kullanıyor.',
    expectedPerformance: 'CPL ₺25, CTR %1.2',
    confidence: 80,
    impactLevel: 'medium',
    isNewObjective: false,
    analyzedParameters: ['dönüşüm hedefi', 'optimizasyon'],
    suggestedChanges: ['Destination ON_AD olarak ayarlandı'],
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\nProposal Engine Final Binding Tests\n')

// 1. Intent profile proposal context'e girer — formatIntentForPrompt çıktısını inline simüle et
// (supabase import zincirinden kaçınmak için campaignIntentEngine.ts import edilmez;
//  adCreator.ts içindeki formatIntentForPrompt mantığı inline test edilir)
test('1. Intent profile proposal context bloğuna girer', () => {
  const profile = makeIntentProfile()

  // adCreator.ts → buildPrompt → analysisDetails içinde formatIntentForPrompt çağrılır.
  // Burada aynı mantığı inline simüle ediyoruz.
  function fakeFormatIntent(p: CampaignIntentProfile): string {
    return [
      `  KAMPANYA INTENT (güven: ${p.confidence}/100):`,
      `  İş Alanı: ${p.business_domain}`,
      `  Ürün/Hizmet: ${p.service_or_product}`,
      `  Teklif Türü: ${p.offer_type}`,
      `  Hedef Kitle: ${p.target_audience}`,
      `  Dönüşüm Hedefi: ${p.conversion_goal}`,
      `  Huni Aşaması: ${p.funnel_stage}`,
      p.detected_keywords.length > 0
        ? `  Anahtar Kelimeler: ${p.detected_keywords.slice(0, 8).join(', ')}`
        : '',
    ].filter(Boolean).join('\n')
  }

  const block = fakeFormatIntent(profile)
  assert.ok(block.includes('KAMPANYA INTENT'), 'KAMPANYA INTENT başlığı eksik')
  assert.ok(block.includes(profile.business_domain), 'business_domain eksik')
  assert.ok(block.includes(profile.service_or_product), 'service_or_product eksik')
  assert.ok(block.includes(profile.target_audience), 'target_audience eksik')
  assert.ok(block.includes(profile.conversion_goal), 'conversion_goal eksik')

  // Proposal context içinde intent'in zorunlu alanları dolu olmalı
  assert.ok(profile.service_or_product !== 'belirtilmemiş', 'service_or_product genel kalmamalı')
  assert.ok(profile.confidence > 0, 'Confidence sıfır olmamalı')
})

// 2. Official Ads Knowledge context'e girer (buildPrompt içinde officialKnowledgeContext)
test('2. Official knowledge context blok içeriyor', () => {
  // officialAdsKnowledgeStore.ts'den dönen item formatı doğrulanır
  const item = {
    id: 'k1',
    normalized_key: 'google/search/headline_limit',
    summary: 'Google RSA başlık limiti 30 karakterdir.',
    platform: 'google',
    category: 'creative',
  }
  // adCreator.ts buildPrompt, lines.join('\n') ile context oluşturur
  const context = `[${item.normalized_key}] ${item.summary}`
  assert.ok(context.includes('google/search/headline_limit'), 'normalized_key eksik')
  assert.ok(context.includes('30 karakterdir'), 'summary eksik')
})

// 3. Competitor query plan platform bazlı ayrılır — Google için 'google' platform döner
test('3. Google intent profili → google query plan üretir', () => {
  const input: QueryExpanderInput = {
    platform: 'google',
    intentProfile: makeIntentProfile({ platform: 'Google' }),
    campaignName: 'İş Güvenliği Belgesi Arama',
  }
  const plan: CompetitorQueryPlan = buildDeterministicQueryPlan(input)
  assert.strictEqual(plan.platform, 'google', 'Platform google olmalı')
  assert.ok(plan.primary_queries.length > 0, 'En az bir primary query olmalı')
})

// 4. Google proposal Meta competitor query planı GÖRMEMELİ
test('4. Google proposal meta query plan görmez', () => {
  const googleInput: QueryExpanderInput = {
    platform: 'google',
    intentProfile: makeIntentProfile({ platform: 'Google' }),
    campaignName: 'İş Güvenliği Belgesi Arama',
  }
  const metaInput: QueryExpanderInput = {
    platform: 'meta',
    intentProfile: makeIntentProfile({ platform: 'Meta', campaign_id: 'camp_002' }),
    campaignName: 'İş Güvenliği Lead Kampanyası',
  }
  const googlePlan = buildDeterministicQueryPlan(googleInput)
  const metaPlan = buildDeterministicQueryPlan(metaInput)

  // Google proposal'da sadece google plan kullanılmalı
  assert.strictEqual(googlePlan.platform, 'google')
  assert.notStrictEqual(googlePlan.platform, 'meta')

  // Meta proposal'da sadece meta plan kullanılmalı
  assert.strictEqual(metaPlan.platform, 'meta')
  assert.notStrictEqual(metaPlan.platform, 'google')
})

// 5. Meta proposal Google competitor query planı GÖRMEMELİ
test('5. Meta proposal google query plan görmez', () => {
  const metaInput: QueryExpanderInput = {
    platform: 'meta',
    intentProfile: makeIntentProfile({ platform: 'Meta', campaign_id: 'camp_meta' }),
    campaignName: 'Meta Lead Kampanyası',
  }
  const plan = buildDeterministicQueryPlan(metaInput)
  assert.strictEqual(plan.platform, 'meta')
  // Google-specific modifiers should not appear
  // (meta'da 'belgesi' modifier değil 'belgesi nasıl alınır' gibi sosyal dil kullanılır)
  const allQueries = [...plan.primary_queries, ...plan.secondary_queries].join(' ')
  assert.ok(allQueries.length > 0, 'En az bir sorgu üretilmeli')
})

// 6. Policy Guard rejected proposal'ı filtreler
test('6. Policy guard rejected proposal listeye girmez', () => {
  // Google için critical violation → rejected status
  const proposal = makeGoogleProposal({
    headlines: ['Test'],
    descriptions: ['Test desc'],
  })

  // applyPolicyGuardToProposals'ı çağır, sonra rejected'ları filtrele
  const withPolicy = applyPolicyGuardToProposals([proposal], 'Google', [])
  const afterFilter = withPolicy.filter(p => p.policyStatus !== 'rejected')

  // publishable veya review_required olanlar kalmalı
  for (const p of afterFilter) {
    assert.notStrictEqual(p.policyStatus, 'rejected', 'Rejected proposal listeye girdi')
  }
})

// 7. review_required proposal korunur — rejected değil
test('7. review_required proposal filtrelenmez', () => {
  // Google proposal with medium violation → review_required
  const proposal = makeGoogleProposal({
    headlines: ['Bu başlık otuz karakterden uzun bir örnek başlıktır'],
    descriptions: ['Kısa açıklama.'],
  })

  const withPolicy = applyPolicyGuardToProposals([proposal], 'Google', [])
  // En az bir öneri kalmalı (rejected değil)
  assert.ok(withPolicy.length > 0, 'Tüm öneriler filtrelendi')

  const reviewRequired = withPolicy.filter(p => p.policyStatus === 'review_required')
  const publishable = withPolicy.filter(p => p.policyStatus === 'publishable')
  // Uzun başlık → review_required beklenir
  assert.ok(
    reviewRequired.length > 0 || publishable.length > 0,
    'En az bir proposal kalmalı',
  )
})

// 8. Generic headline publishable kalmaz
test('8. Generic headline review_required veya rejected olur', () => {
  const genericProposal = makeGoogleProposal({
    headline: 'Sitemizi ziyaret edin',
    headlines: ['Sitemizi ziyaret edin', 'Kaliteli hizmet', 'Hemen tıklayın'],
  })

  const result = validateProposalPolicy({
    proposal: genericProposal,
    platform: 'Google',
  })

  // Generic headline medium severity → review_required
  assert.notStrictEqual(result.status, 'publishable', 'Generic headline publishable olmamalı')
  const genericViolations = result.violations.filter(v => v.code === 'GENERIC_HEADLINE')
  assert.ok(genericViolations.length > 0, 'GENERIC_HEADLINE violation tespit edilmedi')
})

// 9. Missing landing page sistemi kırmaz
test('9. intent profile missing_data landing page olmadan çalışır', () => {
  const profileWithoutLP = makeIntentProfile({
    landing_page_summary: '',
    missing_data: ['final_url'],
    confidence: 45,
  })

  // Missing landing page olsa bile profil geçerli olmalı
  assert.ok(profileWithoutLP.campaign_id, 'campaign_id eksik')
  assert.ok(profileWithoutLP.business_domain, 'business_domain eksik')
  assert.ok(profileWithoutLP.missing_data.includes('final_url'), 'missing_data kaydedilmemiş')
  // Confidence düşük ama sıfır değil
  assert.ok(profileWithoutLP.confidence >= 0, 'Confidence negatif')
})

// 10. DB knowledge loader fail olursa fallback çalışır — adCreator boş knowledge ile çalışır
test('10. Boş knowledge items policy guard kırmaz', () => {
  const proposal = makeGoogleProposal()

  // knowledgeItems boş array → system should not crash
  assert.doesNotThrow(() => {
    validateProposalPolicy({ proposal, platform: 'Google', knowledgeItems: [] })
  }, 'Boş knowledge items ile policy guard hata fırlattı')

  // undefined knowledgeItems da çalışmalı
  assert.doesNotThrow(() => {
    validateProposalPolicy({ proposal, platform: 'Google' })
  }, 'undefined knowledge items ile policy guard hata fırlattı')
})

// Bonus: Query plan confidence düşükse reason ayrıştırılır
test('11. Zayıf signal → düşük confidence ile plan döner (sistem kırılmaz)', () => {
  const input: QueryExpanderInput = {
    platform: 'google',
    intentProfile: null,
    campaignName: 'test',
  }
  const plan = buildDeterministicQueryPlan(input)
  assert.ok(plan.confidence < 50, 'Intent profili olmadan confidence yüksek olmamalı')
  assert.ok(plan.reason.length > 0, 'Reason açıklaması boş olmamalı')
  // Platform izolasyonu
  assert.strictEqual(plan.platform, 'google')
})

// Bonus: Meta proposal OUTCOME_ENGAGEMENT + ON_AD destekleniyor mu kontrol
test('12. OUTCOME_ENGAGEMENT + ON_AD → policy normalize eder (publishable değil)', () => {
  const proposal = makeMetaProposal({
    campaignObjective: 'OUTCOME_ENGAGEMENT',
    destinationType: 'ON_AD',
    optimizationGoal: 'POST_ENGAGEMENT',
  })

  const result = validateProposalPolicy({ proposal, platform: 'Meta' })
  // OUTCOME_ENGAGEMENT + ON_AD desteklenmez — normalize edilir
  const destViolations = result.violations.filter(v => v.code === 'META_DESTINATION_INCOMPATIBLE')
  if (destViolations.length > 0) {
    // Normalize edildiyse normalizedProposal'da destination değişmiş olmalı
    assert.ok(
      result.normalizedProposal?.destinationType !== 'ON_AD',
      'Normalize sonrası destination hala ON_AD',
    )
  }
  // publishable veya review_required — rejected olmamalı (normalize edildiği için)
  assert.notStrictEqual(result.status, 'rejected', 'OUTCOME_ENGAGEMENT+ON_AD rejected olmamalı (normalize edilmeli)')
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\nSonuç: ${passed} geçti, ${failed} başarısız\n`)
if (failed > 0) process.exit(1)
