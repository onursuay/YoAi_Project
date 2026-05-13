/**
 * Hedef Kitle — Business Context Binding Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/hedefKitleBusinessContextBinding.test.ts
 *
 * Pure builder (buildAudienceContextFromBusiness) test edilir;
 * runtime wrapper (getAudienceBusinessContext) supabase'e dayandığı için
 * tip ve şema bütünlüğü pure builder üzerinden doğrulanır.
 */

import assert from 'assert'
import {
  buildAudienceContextFromBusiness,
  type AudienceBusinessContextRuntime,
} from '../../lib/yoai/audienceBusinessContext'
import type { BusinessContext } from '../../lib/yoai/businessContextStore'

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

async function runAll(): Promise<void> {
  for (const t of pending) await t()
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

/* ── Fixtures ── */

function lockedCtx(reason: string): BusinessContext {
  return {
    userId: 'u-locked',
    locked: true,
    lockedReason: reason,
    profile: null,
    competitors: [],
    sourceScans: [],
    intelligenceMemory: null,
    sectorInsight: null,
    companyName: null,
    sectorLabel: null,
    targetLocations: [],
    brandTone: null,
    forbiddenClaims: [],
    keywords: [],
    productsOrServices: [],
    mainConversionGoal: null,
    diagnostic: {
      hasProfile: false,
      onboardingCompleted: false,
      hasIntelligence: false,
      intelligenceStale: false,
      sourceCoverage: { own_brand_total: 0, own_brand_completed: 0, competitor_total: 0, competitor_completed: 0 },
      competitorCount: 0,
      missingData: [reason],
      confidence: 0,
      source: 'no_profile',
    },
  }
}

function readyCtx(): BusinessContext {
  return {
    userId: 'u-ready',
    locked: false,
    lockedReason: null,
    profile: {
      id: 'p1',
      user_id: 'u-ready',
      company_name: 'Test Akademi',
      sector_main: 'egitim',
      sector_sub: 'kurs',
      specialization: null,
      business_description: 'Aşçılık ve hijyen kursları',
      main_conversion_goal: 'lead',
      target_locations: ['İstanbul', 'Ankara'],
      target_audience: '25-45 yaş, mesleki gelişim arayan',
      website_url: 'https://test.com',
      instagram_url: null, facebook_url: null, linkedin_url: null,
      youtube_url: null, tiktok_url: null, google_business_profile_url: null,
      marketplace_url: null,
      keywords: ['aşçılık', 'kurs', 'MYK'],
      products_or_services: ['aşçılık kursu', 'hijyen sertifikası'],
      most_profitable_services: [],
      monthly_ad_budget_range: null,
      brand_tone: 'profesyonel/kurumsal',
      forbidden_claims: [],
      compliance_notes: null, extra_notes: null,
      onboarding_completed: true,
      profile_confidence: 70,
      scan_status: 'completed',
      intelligence_status: 'completed',
    },
    competitors: [],
    sourceScans: [],
    intelligenceMemory: {
      id: 'i1', user_id: 'u-ready', profile_id: 'p1',
      company_summary: 'Test Akademi — aşçılık eğitimi',
      business_model: 'Eğitim',
      sector_summary: 'Eğitim sektörü',
      local_market_summary: 'İstanbul yoğun',
      services_summary: 'aşçılık | hijyen',
      products_summary: '—',
      target_audience_summary: 'Mesleki gelişim arayanlar',
      conversion_goal_summary: 'Lead toplama',
      competitor_summary: '—',
      competitor_positioning_summary: '—',
      keyword_themes: ['aşçılık', 'MYK', 'kurs'],
      recommended_google_campaign_types: ['SEARCH'],
      recommended_meta_objectives: ['LEAD_GENERATION'],
      recommended_content_angles: [],
      recommended_offer_angles: [],
      risk_claims: [],
      forbidden_claims: [],
      brand_positioning: 'Profesyonel',
      audience_pains: ['Güvenilir belge', 'Esnek saat'],
      audience_motivations: ['Kariyer', 'Sertifika'],
      location_insights: 'İstanbul/Ankara',
      source_coverage: {},
      confidence: 75,
      missing_data: [],
    },
    sectorInsight: null,
    companyName: 'Test Akademi',
    sectorLabel: 'Eğitim / Kurs',
    targetLocations: ['İstanbul', 'Ankara'],
    brandTone: 'profesyonel/kurumsal',
    forbiddenClaims: [],
    keywords: ['aşçılık', 'kurs', 'MYK'],
    productsOrServices: ['aşçılık kursu', 'hijyen sertifikası'],
    mainConversionGoal: 'lead',
    diagnostic: {
      hasProfile: true,
      onboardingCompleted: true,
      hasIntelligence: true,
      intelligenceStale: false,
      sourceCoverage: { own_brand_total: 1, own_brand_completed: 1, competitor_total: 0, competitor_completed: 0 },
      competitorCount: 0,
      missingData: [],
      confidence: 75,
      source: 'profile_with_intelligence',
    },
  }
}

/* ── Tests ── */

console.log('🧪 Hedef Kitle Business Context Binding Tests\n')

console.log('▶ Locked / no profile')

test('Locked context (no profile) → businessContextLoaded=false', () => {
  const out: AudienceBusinessContextRuntime = buildAudienceContextFromBusiness(lockedCtx('no_business_profile'))
  assert.strictEqual(out.businessContextLoaded, false)
  assert.strictEqual(out.locked, true)
  assert.strictEqual(out.lockedReason, 'no_business_profile')
})

test('Locked summary kullanıcıya rehberlik metni içerir', () => {
  const out = buildAudienceContextFromBusiness(lockedCtx('no_business_profile'))
  assert.ok(/profil|onboarding|tamamla/i.test(out.summaryText), out.summaryText)
})

test('Locked context AudienceSeedHints alanları boş ama tipli', () => {
  const out = buildAudienceContextFromBusiness(lockedCtx('no_business_profile'))
  const s = out.audienceSeedHints
  assert.deepStrictEqual(s.primaryLocations, [])
  assert.deepStrictEqual(s.audiencePains, [])
  assert.deepStrictEqual(s.audienceMotivations, [])
  assert.deepStrictEqual(s.recommendedMetaObjectives, [])
  assert.deepStrictEqual(s.recommendedGoogleCampaignTypes, [])
  assert.strictEqual(s.sectorMain, null)
})

console.log('\n▶ Ready / business memory bağlı')

test('Hazır context → businessContextLoaded=true ve confidence pozitif', () => {
  const out = buildAudienceContextFromBusiness(readyCtx())
  assert.strictEqual(out.businessContextLoaded, true)
  assert.strictEqual(out.locked, false)
  assert.ok(out.businessContextConfidence > 0)
})

test('Sector ve location runtime context içine geçti', () => {
  const out = buildAudienceContextFromBusiness(readyCtx())
  assert.strictEqual(out.sector, 'egitim')
  assert.deepStrictEqual(out.location, ['İstanbul', 'Ankara'])
})

test('Intelligence memory audience_pains/motivations seed hint olarak aktarılır', () => {
  const out = buildAudienceContextFromBusiness(readyCtx())
  assert.ok(out.audienceSeedHints.audiencePains.includes('Güvenilir belge'))
  assert.ok(out.audienceSeedHints.audienceMotivations.includes('Kariyer'))
})

test('Recommended Meta/Google önerileri seed hint olarak aktarılır (AI generator için hazır)', () => {
  const out = buildAudienceContextFromBusiness(readyCtx())
  assert.ok(out.audienceSeedHints.recommendedMetaObjectives.includes('LEAD_GENERATION'))
  assert.ok(out.audienceSeedHints.recommendedGoogleCampaignTypes.includes('SEARCH'))
})

test('Declared target audience aktarılır', () => {
  const out = buildAudienceContextFromBusiness(readyCtx())
  assert.ok(out.audienceSeedHints.declaredTargetAudience?.includes('mesleki gelişim'))
})

test('summaryText hazır context için sektör/lokasyon/audience özetini içerir', () => {
  const out = buildAudienceContextFromBusiness(readyCtx())
  assert.ok(/sektör|hedef kitle|lokasyon/i.test(out.summaryText), out.summaryText)
})

test('AudienceSeedHints tip şeması sabit (AI generator için stabil interface)', () => {
  const out = buildAudienceContextFromBusiness(readyCtx())
  const expected = [
    'sectorMain', 'sectorSub', 'sectorLabel', 'primaryLocations',
    'audiencePains', 'audienceMotivations', 'audienceTypes',
    'keywordThemes', 'brandTone', 'productsOrServices',
    'mainConversionGoal', 'declaredTargetAudience',
    'recommendedMetaObjectives', 'recommendedGoogleCampaignTypes',
  ]
  for (const k of expected) {
    assert.ok(k in out.audienceSeedHints, `missing seed key: ${k}`)
  }
})

console.log('\n▶ Diagnostic')

test('sourceCoverage / competitorCount / hasIntelligenceMemory her durumda geri döner', () => {
  const out = buildAudienceContextFromBusiness(readyCtx())
  assert.ok('sourceCoverage' in out)
  assert.strictEqual(typeof out.competitorCount, 'number')
  assert.strictEqual(typeof out.hasIntelligenceMemory, 'boolean')
})

// ── Runner ──
void runAll()
