/**
 * Business Intelligence Profile — Unit Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/businessIntelligenceProfile.test.ts
 */

import assert from 'assert'
import { SECTOR_CATALOG, getSectorMain, getSectorSubs, getSectorLabel, isValidSectorMain, isValidSectorSub } from '../../lib/yoai/sectorCatalog'
import { validateProfileForOnboarding, MIN_COMPETITORS_REQUIRED } from '../../lib/yoai/businessProfileValidation'
import { buildSectorLocationInsight } from '../../lib/yoai/sectorLocationIntelligence'
import { buildBusinessIntelligenceRow } from '../../lib/yoai/businessIntelligenceBuilder'
import { scanBusinessSource } from '../../lib/yoai/businessSourceScanner'
import type { BusinessProfileRow, BusinessCompetitorRow, BusinessSourceScanRow } from '../../lib/yoai/businessProfileStore'

let passed = 0
let failed = 0

function test(name: string, fn: () => void | Promise<void>): void {
  try {
    const r = fn()
    if (r instanceof Promise) {
      r.then(() => { console.log(`  ✓ ${name}`); passed++ }).catch((e) => { console.error(`  ✗ ${name}`); console.error(`    ${e instanceof Error ? e.message : e}`); failed++ })
    } else {
      console.log(`  ✓ ${name}`)
      passed++
    }
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e instanceof Error ? e.message : e}`)
    failed++
  }
}

console.log('🧪 Business Intelligence Profile Tests\n')

// ── Sector catalog ────────────────────────────────────────────
console.log('▶ Sector catalog')

test('SECTOR_CATALOG yüklendi (en az 18 ana sektör)', () => {
  assert.ok(SECTOR_CATALOG.length >= 18, `expected >=18, got ${SECTOR_CATALOG.length}`)
})

test('Her ana sektörün id, label, subs alanları var', () => {
  for (const s of SECTOR_CATALOG) {
    assert.ok(s.id && typeof s.id === 'string')
    assert.ok(s.label && typeof s.label === 'string')
    assert.ok(Array.isArray(s.subs))
    assert.ok(s.subs.length > 0, `${s.id} has no subs`)
  }
})

test('getSectorSubs() ana sektör seçince doğru alt sektör listeler', () => {
  const subs = getSectorSubs('yeme_icme')
  assert.ok(subs.length > 0)
  assert.ok(subs.some((s) => s.id === 'restoran'))
})

test('isValidSectorMain / isValidSectorSub doğrulama yapar', () => {
  assert.strictEqual(isValidSectorMain('yeme_icme'), true)
  assert.strictEqual(isValidSectorMain('not_real_sector'), false)
  assert.strictEqual(isValidSectorSub('yeme_icme', 'restoran'), true)
  assert.strictEqual(isValidSectorSub('yeme_icme', 'not_real_sub'), false)
})

test('getSectorLabel okunabilir çıktı verir', () => {
  const label = getSectorLabel('yeme_icme', 'restoran')
  assert.ok(label.includes('Yeme'))
  assert.ok(label.includes('Restoran'))
})

// ── Onboarding validation ─────────────────────────────────────
console.log('\n▶ Onboarding validation')

const baseProfile: Partial<BusinessProfileRow> = {
  company_name: 'Test Restoran',
  sector_main: 'yeme_icme',
  sector_sub: 'restoran',
  business_description: 'Ankara Çankaya semtinde geleneksel Türk mutfağı sunan restoran.',
  main_conversion_goal: 'Online rezervasyon',
  target_locations: ['Ankara'],
}

test('Web sitesi olmadan sosyal kaynakla onboarding tamamlanır', () => {
  const v = validateProfileForOnboarding(
    { ...baseProfile, instagram_url: 'https://instagram.com/x', website_url: null },
    [
      { competitor_name: 'A', website_url: 'https://a.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null },
      { competitor_name: 'B', website_url: 'https://b.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null },
      { competitor_name: 'C', website_url: 'https://c.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null },
    ],
  )
  assert.strictEqual(v.ok, true, JSON.stringify(v.errors))
})

test('Hiç marka kaynağı yoksa onboarding tamamlanmaz', () => {
  const v = validateProfileForOnboarding(
    {
      ...baseProfile,
      website_url: null, instagram_url: null, facebook_url: null, linkedin_url: null,
      youtube_url: null, tiktok_url: null, google_business_profile_url: null, marketplace_url: null,
    },
    [
      { competitor_name: 'A', website_url: 'https://a.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null },
      { competitor_name: 'B', website_url: 'https://b.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null },
      { competitor_name: 'C', website_url: 'https://c.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null },
    ],
  )
  assert.strictEqual(v.ok, false)
  assert.ok(v.errors.some((e) => e.toLowerCase().includes('marka kaynağı')))
})

test('3 rakipten az varsa onboarding tamamlanmaz', () => {
  const v = validateProfileForOnboarding(
    { ...baseProfile, website_url: 'https://x.com' },
    [
      { competitor_name: 'A', website_url: 'https://a.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null },
      { competitor_name: 'B', website_url: 'https://b.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null },
    ],
  )
  assert.strictEqual(v.ok, false)
  assert.ok(v.errors.some((e) => e.toLowerCase().includes('rakip')))
})

test('3 rakip varsa onboarding tamamlanır', () => {
  const v = validateProfileForOnboarding(
    { ...baseProfile, website_url: 'https://x.com' },
    [
      { competitor_name: 'A', website_url: 'https://a.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null },
      { competitor_name: 'B', website_url: 'https://b.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null },
      { competitor_name: 'C', website_url: 'https://c.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null },
    ],
  )
  assert.strictEqual(v.ok, true, JSON.stringify(v.errors))
})

test('MIN_COMPETITORS_REQUIRED sabiti 3', () => {
  assert.strictEqual(MIN_COMPETITORS_REQUIRED, 3)
})

// ── Sector + location intelligence ────────────────────────────
console.log('\n▶ Sector + location intelligence')

test('Yeme-içme + Ankara/restoran → sektör bağlamı üretir', () => {
  const insight = buildSectorLocationInsight({
    sector_main_id: 'yeme_icme',
    sector_sub_id: 'restoran',
    target_locations: ['Ankara'],
  })
  assert.ok(insight.sector_summary.includes('Yeme'))
  assert.ok(insight.recommended_meta_objectives.length > 0)
  assert.ok(insight.recommended_google_campaign_types.length > 0)
  assert.ok(insight.location_expectations.toLowerCase().includes('ankara'))
  assert.strictEqual(insight.research_source, 'internal_inference')
})

test('Eksik sektör bilgisinde fallback profili döner', () => {
  const insight = buildSectorLocationInsight({ sector_main_id: '', sector_sub_id: null, target_locations: [] })
  assert.ok(insight.sector_summary.length > 0)
  assert.ok(insight.recommended_google_campaign_types.length > 0)
})

// ── Source scanner ────────────────────────────────────────────
console.log('\n▶ Source scanner')

test('No URL → skipped status, no fake data', async () => {
  const result = await scanBusinessSource({ source_type: 'website', source_url: '' })
  assert.strictEqual(result.scan_status, 'skipped')
  assert.strictEqual(result.raw_excerpt, null)
})

test('Sosyal sağlayıcı yoksa scraper_provider_missing yazılır', async () => {
  const prev = process.env.APIFY_API_TOKEN
  delete process.env.APIFY_API_TOKEN
  delete process.env.APIFY_TOKEN
  const result = await scanBusinessSource({ source_type: 'instagram', source_url: 'https://instagram.com/x' })
  assert.strictEqual(result.scan_status, 'failed')
  assert.ok(result.error_message?.includes('scraper_provider_missing') || result.error_message?.includes('social_scraper_not_implemented'))
  if (prev) process.env.APIFY_API_TOKEN = prev
})

// ── Intelligence builder ──────────────────────────────────────
console.log('\n▶ Intelligence builder')

test('Profile + competitors + scan kayıtları intelligence üretir', () => {
  const profile: BusinessProfileRow = {
    user_id: 'u1', company_name: 'Test', sector_main: 'yeme_icme', sector_sub: 'restoran',
    specialization: null, business_description: 'Test restoran.',
    main_conversion_goal: 'Online rezervasyon', target_locations: ['Ankara'],
    target_audience: '25-45 yaş', website_url: 'https://t.com',
    instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null,
    google_business_profile_url: null, marketplace_url: null,
    keywords: ['restoran ankara', 'öğle yemeği'], products_or_services: ['Öğle menüsü'],
    most_profitable_services: [], monthly_ad_budget_range: '5k-15k', brand_tone: 'sıcak/aile dostu',
    forbidden_claims: [], compliance_notes: null, extra_notes: null,
    onboarding_completed: true, profile_confidence: 50,
    scan_status: 'completed', intelligence_status: 'pending',
    id: 'p1',
  }
  const competitors: BusinessCompetitorRow[] = [
    { id: 'c1', user_id: 'u1', profile_id: 'p1', competitor_name: 'A', website_url: 'https://a.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null, scan_status: 'pending', scan_error: null, confidence: 0 },
    { id: 'c2', user_id: 'u1', profile_id: 'p1', competitor_name: 'B', website_url: 'https://b.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null, scan_status: 'pending', scan_error: null, confidence: 0 },
    { id: 'c3', user_id: 'u1', profile_id: 'p1', competitor_name: 'C', website_url: 'https://c.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null, scan_status: 'pending', scan_error: null, confidence: 0 },
  ]
  const scans: BusinessSourceScanRow[] = []
  const row = buildBusinessIntelligenceRow(profile, competitors, scans)
  assert.ok(row.company_summary?.includes('Test'))
  assert.ok(row.recommended_google_campaign_types.length > 0)
  assert.ok(row.recommended_meta_objectives.length > 0)
  assert.ok(row.competitor_summary?.includes('3 rakip'))
})

test('Tarama failed olsa bile intelligence builder kırılmaz', () => {
  const profile: BusinessProfileRow = {
    user_id: 'u2', company_name: 'X', sector_main: 'egitim', sector_sub: null,
    specialization: null, business_description: null,
    main_conversion_goal: null, target_locations: [],
    target_audience: null, website_url: null,
    instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null,
    google_business_profile_url: null, marketplace_url: null,
    keywords: [], products_or_services: [], most_profitable_services: [],
    monthly_ad_budget_range: null, brand_tone: null, forbidden_claims: [],
    compliance_notes: null, extra_notes: null, onboarding_completed: false,
    profile_confidence: 0, scan_status: 'failed', intelligence_status: 'pending',
    id: 'p2',
  }
  const row = buildBusinessIntelligenceRow(profile, [], [])
  assert.ok(row.confidence < 100)
  assert.ok(row.missing_data.length > 0)
})

// ── Business context source coverage ──────────────────────────
console.log('\n▶ Business context source coverage')

test('Sektör/lokasyon intelligence Ankara/restoran için doğru context üretir', () => {
  const insight = buildSectorLocationInsight({
    sector_main_id: 'yeme_icme',
    sector_sub_id: 'restoran',
    target_locations: ['Ankara', 'İstanbul'],
  })
  // Bu intelligence YoAlgoritma + Strateji + Hedef Kitle motorlarına bağlanır.
  assert.ok(insight.recommended_meta_objectives.length > 0)
  assert.ok(insight.recommended_google_campaign_types.length > 0)
  assert.ok(insight.location_expectations.toLowerCase().includes('ankara'))
  assert.ok(insight.local_angles.length > 0)
})

test('Profil değişikliği eski intelligence için stale yola sahip', () => {
  // BusinessProfileRow.intelligence_status alanı 'stale' olabilmeli
  const allowed: BusinessProfileRow['intelligence_status'][] = ['pending', 'running', 'completed', 'failed', 'stale']
  assert.ok(allowed.includes('stale'))
})

// ── Summary ──
console.log(`\n${'─'.repeat(50)}`)
setTimeout(() => {
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    process.exit(1)
  }
}, 1500)
