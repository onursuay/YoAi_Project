/**
 * YoAlgoritma — Scan Business Brief (A1) Tests + Smoke Report
 *
 * Çalıştırma:
 *   npx tsx src/tests/yoalgoritmaScanBusinessBrief.test.ts
 *
 * Pure builder (buildScanBusinessBrief) + buildUserBrief üzerinden
 * kullanıcı beyanı + iş zekası bağlamının Claude payload'ına
 * eksiksiz girdiğini doğrular. Supabase'e dokunmaz (fixture).
 *
 * Smoke senaryosu: "Belgemod" (mesleki belgelendirme) — Onur'un
 * verdiği örnek. Amaç: marka adı + iş tanımı + ürünler + rakipler +
 * intelligence Claude'a tam gidiyor mu? + token bütçesi ne kadar arttı?
 */

import assert from 'assert'
import { buildScanBusinessBrief } from '../../lib/yoai/ai/scanBusinessBrief'
import type { BusinessContext } from '../../lib/yoai/businessContextStore'
import { buildUserBrief } from '../../lib/yoai/ai/systemPrompt'

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

/* ── Fixture: Belgemod (mesleki yeterlilik belgelendirme) ── */

const BELGEMOD_DESC =
  'Belgemod, MYK onaylı mesleki yeterlilik belgelendirme ve mesleki yeterlilik kursları sunan bir ' +
  'eğitim kurumudur. Çalışanların ve işverenlerin mevzuata uygun MYK belgesi alması için sınav, ' +
  'eğitim ve danışmanlık hizmeti verir; tehlikeli ve çok tehlikeli işlerde çalışanlar için zorunlu ' +
  'belgelendirme süreçlerini uçtan uca yönetir. Hizmet kapsamı bireysel adaylardan kurumsal toplu ' +
  'belgelendirmeye kadar uzanır.'

function belgemodContext(): BusinessContext {
  return {
    userId: 'onur-test-user',
    locked: false,
    lockedReason: null,
    profile: {
      user_id: 'onur-test-user',
      company_name: 'Belgemod',
      sector_main: 'Eğitim',
      sector_sub: 'Mesleki Belgelendirme',
      specialization: 'MYK mesleki yeterlilik belgelendirme',
      business_description: BELGEMOD_DESC,
      main_conversion_goal: 'Telefon araması',
      target_locations: ['Ankara', 'Türkiye'],
      target_audience: '18-50 yaş arası erkek çalışanlar',
      website_url: 'https://belgemod.com',
      instagram_url: 'https://instagram.com/belgemod',
      facebook_url: 'https://facebook.com/belgemod',
      linkedin_url: null,
      youtube_url: null,
      tiktok_url: null,
      google_business_profile_url: null,
      marketplace_url: null,
      keywords: ['mesleki yeterlilik belgesi', 'MYK belgesi', 'mesleki yeterlilik kursları', 'belgelendirme'],
      products_or_services: ['Mesleki yeterlilik belgesi', 'MYK belgesi', 'Mesleki yeterlilik kursları'],
      most_profitable_services: ['MYK belgesi', 'Kurumsal toplu belgelendirme'],
      monthly_ad_budget_range: '10.000-25.000 TL',
      brand_tone: 'Güven veren, resmi, uzman',
      forbidden_claims: ['garantili işe yerleştirme', '%100 sınav garantisi'],
      compliance_notes: 'MYK mevzuatına aykırı vaat verilmez.',
      extra_notes: null,
      onboarding_completed: true,
      profile_confidence: 85,
      scan_status: 'partial',
      intelligence_status: 'completed',
    },
    competitors: [
      { user_id: 'u', profile_id: 'p', competitor_name: 'VOC Akademi', website_url: 'https://vocakademi.com', instagram_url: 'https://instagram.com/vocakademi', facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null, scan_status: 'completed', scan_error: null, confidence: 70 },
      { user_id: 'u', profile_id: 'p', competitor_name: 'Üsküdar MYM', website_url: 'https://uskudarmym.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null, scan_status: 'completed', scan_error: null, confidence: 60 },
      { user_id: 'u', profile_id: 'p', competitor_name: 'Vize Belgelendirme', website_url: 'https://vizebelge.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null, scan_status: 'completed', scan_error: null, confidence: 55 },
      { user_id: 'u', profile_id: 'p', competitor_name: 'Anadolu Sertifika', website_url: 'https://anadolusertifika.com', instagram_url: null, facebook_url: null, linkedin_url: null, youtube_url: null, tiktok_url: null, google_business_url: null, extra_url: null, scan_status: 'completed', scan_error: null, confidence: 50 },
    ],
    sourceScans: [],
    intelligenceMemory: {
      user_id: 'onur-test-user',
      profile_id: 'p',
      company_summary: 'MYK onaylı mesleki yeterlilik belgelendirme kurumu; bireysel ve kurumsal adaylara sınav+eğitim.',
      business_model: 'B2C + B2B belgelendirme hizmeti',
      sector_summary: 'Mesleki belgelendirme sektörü mevzuat odaklı, talep zorunluluktan doğuyor.',
      local_market_summary: 'Ankara merkezli, Türkiye geneli online+yüz yüze.',
      services_summary: 'MYK belgesi, mesleki yeterlilik kursları, kurumsal toplu belgelendirme.',
      products_summary: null,
      target_audience_summary: 'Tehlikeli işlerde çalışan 18-50 yaş erkekler ve onları istihdam eden işverenler.',
      conversion_goal_summary: 'Telefonla danışmanlık → belgelendirme kaydı.',
      competitor_summary: 'Rakipler fiyat ve hız üzerinden konumlanıyor; VOC Akademi en agresif dijital reklam veren.',
      competitor_positioning_summary: 'Belgemod güven + mevzuat uzmanlığı ile premium konumlanabilir; rakipler ucuz/hızlı vaadinde.',
      keyword_themes: ['mesleki yeterlilik belgesi', 'MYK belgesi', 'tehlikeli işler belgesi'],
      recommended_google_campaign_types: ['Search', 'Performance Max'],
      recommended_meta_objectives: ['Leads', 'Messages'],
      recommended_content_angles: ['Mevzuat zorunluluğu', 'İş güvenliği', 'Hızlı belgelendirme süreci'],
      recommended_offer_angles: ['Kurumsal toplu indirim', 'Ücretsiz ön değerlendirme'],
      risk_claims: ['garantili işe yerleştirme'],
      forbidden_claims: ['%100 sınav garantisi'],
      brand_positioning: 'Mevzuat uzmanı, güvenilir belgelendirme partneri.',
      audience_pains: ['Belgesiz çalışma cezası', 'Karmaşık mevzuat', 'Zaman kaybı'],
      audience_motivations: ['Yasal zorunluluk', 'İş bulma/koruma', 'Kurumsal uyum'],
      location_insights: 'Ankara + Türkiye geneli online belgelendirme talebi yüksek.',
      source_coverage: null,
      confidence: 78,
      missing_data: [],
    },
    sectorInsight: null,
    companyName: 'Belgemod',
    sectorLabel: 'Eğitim · Mesleki Belgelendirme',
    targetLocations: ['Ankara', 'Türkiye'],
    brandTone: 'Güven veren, resmi, uzman',
    forbiddenClaims: ['garantili işe yerleştirme', '%100 sınav garantisi'],
    keywords: ['mesleki yeterlilik belgesi', 'MYK belgesi', 'mesleki yeterlilik kursları', 'belgelendirme'],
    productsOrServices: ['Mesleki yeterlilik belgesi', 'MYK belgesi', 'Mesleki yeterlilik kursları'],
    mainConversionGoal: 'Telefon araması',
    diagnostic: {
      hasProfile: true,
      onboardingCompleted: true,
      hasIntelligence: true,
      intelligenceStale: false,
      sourceCoverage: { own_brand_total: 3, own_brand_completed: 2, competitor_total: 4, competitor_completed: 4 },
      competitorCount: 4,
      missingData: [],
      confidence: 82,
      source: 'profile_with_intelligence',
    },
  }
}

// Yaklaşık token tahmini (Türkçe için ~3.6 char/token konservatif).
function approxTokens(s: string): number {
  return Math.ceil(s.length / 3.6)
}

/* ── Tests ── */

test('Marka adı (company_name) Claude bağlamına giriyor', () => {
  const brief = buildScanBusinessBrief(belgemodContext())
  assert.ok(brief.businessContext?.includes('Belgemod'), 'company_name eksik')
})

test('İş tanımı TAM metniyle gidiyor (kırpma yok)', () => {
  const brief = buildScanBusinessBrief(belgemodContext())
  assert.ok(brief.businessContext?.includes(BELGEMOD_DESC), 'business_description kırpılmış/eksik')
})

test('Ürün/hizmetler + en kârlı hizmetler giriyor', () => {
  const brief = buildScanBusinessBrief(belgemodContext())
  assert.ok(brief.businessContext?.includes('MYK belgesi'), 'ürün/hizmet eksik')
  assert.ok(brief.businessContext?.includes('Kurumsal toplu belgelendirme'), 'most_profitable_services eksik')
})

test('Anahtar kelimeler + hedef lokasyon + hedef kitle giriyor', () => {
  const brief = buildScanBusinessBrief(belgemodContext())
  const c = brief.businessContext || ''
  assert.ok(c.includes('mesleki yeterlilik kursları'), 'keyword eksik')
  assert.ok(c.includes('Ankara'), 'lokasyon eksik')
  assert.ok(c.includes('18-50 yaş'), 'hedef kitle eksik')
})

test('Yasaklı iddialar Claude bağlamına giriyor (negatif sınır)', () => {
  const brief = buildScanBusinessBrief(belgemodContext())
  assert.ok(brief.businessContext?.includes('%100 sınav garantisi'), 'forbidden_claims eksik')
})

test('Marka kaynakları (web + sosyal) giriyor', () => {
  const brief = buildScanBusinessBrief(belgemodContext())
  assert.ok(brief.businessContext?.includes('belgemod.com'), 'website eksik')
  assert.ok(brief.businessContext?.includes('instagram.com/belgemod'), 'instagram eksik')
})

test('4 rakip de adıyla giriyor', () => {
  const brief = buildScanBusinessBrief(belgemodContext())
  const c = brief.businessContext || ''
  for (const name of ['VOC Akademi', 'Üsküdar MYM', 'Vize Belgelendirme', 'Anadolu Sertifika']) {
    assert.ok(c.includes(name), `rakip eksik: ${name}`)
  }
})

test('Intelligence enrichment (rakip konumlandırma + öneriler) giriyor', () => {
  const brief = buildScanBusinessBrief(belgemodContext())
  const c = brief.businessContext || ''
  assert.ok(c.includes('Rakip konumlandırma'), 'competitor_positioning_summary eksik')
  assert.ok(c.includes('Performance Max'), 'recommended_google_campaign_types eksik')
  assert.ok(c.includes('Mevzuat zorunluluğu'), 'recommended_content_angles eksik')
})

test('Profil yoksa hasProfile=false ve bağlam boş', () => {
  const empty = belgemodContext()
  empty.profile = null
  const brief = buildScanBusinessBrief(empty)
  assert.strictEqual(brief.hasProfile, false)
  assert.strictEqual(brief.businessContext, undefined)
})

test('buildUserBrief businessContext bloğunu kırpmadan gömüyor', () => {
  const brief = buildScanBusinessBrief(belgemodContext())
  const userMsg = buildUserBrief({
    platform: 'Meta',
    accountId: 'act_123',
    industry: brief.industry,
    businessContext: brief.businessContext,
    accountSnapshot: { spend: 1000, impressions: 50000 },
    campaignsDetail: [{ id: 'c1', name: 'Marka Bilinirlik', metrics: { spend: 1000 } }],
    benchmarks: { ctr: 1.5 },
  })
  assert.ok(userMsg.includes(BELGEMOD_DESC), 'iş tanımı user message içinde kırpılmış')
  assert.ok(userMsg.includes('VOC Akademi'), 'rakip user message içinde yok')
  assert.ok(userMsg.includes('ZORUNLU bağlam'), 'zorunluluk direktifi yok')
})

/* ── Smoke raporu (A1.5 + A1.6 önce/sonra) ── */

async function smokeReport(): Promise<void> {
  const ctx = belgemodContext()
  const brief = buildScanBusinessBrief(ctx)
  const newCtx = brief.businessContext || ''

  // ÖNCE: eski 6-alan minimal bağlam (1500 char clamp'li)
  const p = ctx.profile!
  const oldParts: string[] = []
  if (p.business_description) oldParts.push(`İşletme: ${p.business_description}`)
  if (p.target_audience) oldParts.push(`Hedef kitle: ${p.target_audience}`)
  if (p.brand_tone) oldParts.push(`Marka tonu: ${p.brand_tone}`)
  if (p.main_conversion_goal) oldParts.push(`Ana dönüşüm hedefi: ${p.main_conversion_goal}`)
  const oldCtx = oldParts.join('\n').slice(0, 1500)

  console.log(`\n${'─'.repeat(64)}`)
  console.log('A1 SMOKE RAPORU — Belgemod (mesleki belgelendirme)')
  console.log('─'.repeat(64))
  console.log('ÖNCE (eski 6-alan minimal bağlam):')
  console.log(`  • char: ${oldCtx.length}  ~token: ${approxTokens(oldCtx)}`)
  console.log('  • İçerik: business_description, target_audience, brand_tone, main_conversion_goal')
  console.log('  • EKSİK: marka adı, ürünler, keywords, lokasyon, yasaklı iddialar, rakipler, intelligence')
  console.log('')
  console.log('SONRA (yeni tam beyan + enrichment):')
  console.log(`  • char: ${newCtx.length}  ~token: ${approxTokens(newCtx)}`)
  console.log(`  • Δ token: +${approxTokens(newCtx) - approxTokens(oldCtx)} (50K bütçe limitinin çok altında)`)
  console.log('  • İçerik: marka adı + tam iş tanımı + ürün/hizmet + keywords + lokasyon +')
  console.log('           hedef kitle + yasaklı iddialar + marka kaynakları + 4 rakip + intelligence')
  console.log('─'.repeat(64))
  console.log('YENİ BAĞLAM ÖRNEĞİ (Claude\'a giden tam metin):')
  console.log(newCtx)
  console.log('─'.repeat(64))
}

async function runAll(): Promise<void> {
  console.log('\nYoAlgoritma Scan Business Brief (A1) testleri:\n')
  for (const t of pending) await t()
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  await smokeReport()
  if (failed > 0) process.exit(1)
}

runAll()
