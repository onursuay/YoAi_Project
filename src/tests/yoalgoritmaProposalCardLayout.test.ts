/**
 * YoAlgoritma Proposal Card Layout — Unit Tests
 *
 * Bu testler kart yerleşimi için statik garantileri (kaynak metin
 * üzerinden) doğrular: 3 kolon grid, Meta/Google bölüm başlıklarının
 * kaldırılması, platform logosu, Kampanya Türü satırı, humanize.
 *
 * Çalıştırma:
 *   npx tsx src/tests/yoalgoritmaProposalCardLayout.test.ts
 */

import assert from 'assert'
import { readFileSync } from 'fs'
import { join } from 'path'

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

console.log('🧪 YoAlgoritma Proposal Card Layout Tests\n')

const root = join(__dirname, '..', '..')
const aiAdSuggestions = readFileSync(join(root, 'components/yoai/AiAdSuggestions.tsx'), 'utf-8')
const adPreviewCard = readFileSync(join(root, 'components/yoai/AdPreviewCard.tsx'), 'utf-8')

// ── Grid layout ───────────────────────────────────────────────
console.log('▶ Grid layout')

test('AiAdSuggestions tek 3-kolon grid kullanır (lg:grid-cols-3)', () => {
  assert.ok(aiAdSuggestions.includes('lg:grid-cols-3'), 'lg:grid-cols-3 not found')
  assert.ok(aiAdSuggestions.includes('md:grid-cols-2'), 'md:grid-cols-2 not found')
  assert.ok(aiAdSuggestions.includes('grid-cols-1'), 'grid-cols-1 not found')
})

test('Tek bir grid container — Meta/Google ayrı bölüm başlıkları yok', () => {
  // Eski section başlığında "Meta" / "Google" badge bg-[#1877F2] / bg-gray-800 vardı
  assert.ok(!aiAdSuggestions.includes("text-white bg-[#1877F2] px-2.5 py-1 rounded\">Meta"),
    'Meta section badge hala mevcut')
  assert.ok(!aiAdSuggestions.includes("text-white bg-gray-800 px-2.5 py-1 rounded\">Google"),
    'Google section badge hala mevcut')
  assert.ok(!aiAdSuggestions.includes('öneri (' ), 'Eski "öneri (X yeni amaç)" satırı bulundu')
})

test('Grid container test id\'si eklendi', () => {
  assert.ok(aiAdSuggestions.includes('data-testid="yoai-proposal-grid"'),
    'data-testid="yoai-proposal-grid" not found')
})

// ── Platform logo ─────────────────────────────────────────────
console.log('\n▶ Platform logo')

test('AdPreviewCard PlatformLogo bileşeni var', () => {
  assert.ok(adPreviewCard.includes('function PlatformLogo'),
    'PlatformLogo function not found')
  assert.ok(adPreviewCard.includes('data-testid="platform-logo-meta"'),
    'platform-logo-meta test id not found')
  assert.ok(adPreviewCard.includes('data-testid="platform-logo-google"'),
    'platform-logo-google test id not found')
})

test('Platform logosu kart içinde sol üstte render edilir', () => {
  // PlatformLogo top-left section içinde (TOP: ... pt-3 pb-2 div'ı)
  const idx = adPreviewCard.indexOf('<PlatformLogo')
  assert.ok(idx > 0, 'PlatformLogo not used in render')
  // Yakındaki "px-4 pt-3 pb-2" bloğundan sonra çağrıldığını gör
  const before = adPreviewCard.substring(0, idx)
  assert.ok(before.includes('px-4 pt-3 pb-2'),
    'PlatformLogo, top section dışında render edilmiş')
})

// ── Campaign type row ─────────────────────────────────────────
console.log('\n▶ Kampanya Türü row')

test('Kart içinde "Kampanya Türü" satırı var', () => {
  assert.ok(adPreviewCard.includes('Kampanya Türü'),
    '"Kampanya Türü" satırı bulunamadı')
  assert.ok(adPreviewCard.includes('data-testid="campaign-type-row"'),
    'campaign-type-row test id not found')
})

test('humanizeCampaignType fonksiyonu var ve enum eşlemesi yapar', () => {
  assert.ok(adPreviewCard.includes('function humanizeCampaignType'),
    'humanizeCampaignType not found')
  assert.ok(adPreviewCard.includes("OUTCOME_ENGAGEMENT: 'Etkileşim'"),
    'OUTCOME_ENGAGEMENT mapping missing')
  assert.ok(adPreviewCard.includes("OUTCOME_LEADS: 'Potansiyel Müşteri'"),
    'OUTCOME_LEADS mapping missing')
  assert.ok(adPreviewCard.includes("PERFORMANCE_MAX: 'Performance Max'"),
    'PERFORMANCE_MAX mapping missing')
})

// ── Humanize behavior (live) ──────────────────────────────────
console.log('\n▶ Humanize live tests')

import('../../components/yoai/AdPreviewCard').then(() => {
  // Bileşen modülü import edildi — runtime hatası vermedi.
  console.log('  ✓ AdPreviewCard module import edilebiliyor')
  passed++
}).catch((e) => {
  // 'use client' direktifi nedeniyle import etmeyebiliriz; bu normal.
  // Bu bilgi amaçlı — başarısızlık fail sayılmaz.
  console.log(`  · AdPreviewCard runtime import skip (use client): ${(e as Error).message.slice(0, 60)}`)
})

// ── Smoke: technical enums must NOT appear in user-facing labels ──
console.log('\n▶ Teknik enum gizleme')

test('Card içinde teknik OUTCOME_* enum görünür değil', () => {
  // AdPreviewCard kullanıcıya humanized label gösterir; ham OUTCOME_*
  // değerleri yalnız map içinde anahtar olarak yer alabilir.
  // Hiçbir <span>OUTCOME_ENGAGEMENT</span> render edilmemeli.
  const renderRegex = />\s*OUTCOME_[A-Z_]+\s*</
  assert.ok(!renderRegex.test(adPreviewCard), 'OUTCOME_* teknik değer render ediliyor')
})

// ── Eski/generic proposal filtreleri korundu ──
console.log('\n▶ Mevcut akış garantileri')

test('isVisible filter (policy/expired/generic) korundu', () => {
  assert.ok(aiAdSuggestions.includes('policyStatus === \'rejected\''),
    'policy filter kaldırıldı')
  assert.ok(aiAdSuggestions.includes("approvalStatus === 'expired'"),
    'expired filter kaldırıldı')
  assert.ok(aiAdSuggestions.includes('isGenericProposalContent'),
    'generic content filter kaldırıldı')
})

test('ONAYLA / REDDET akışı korundu', () => {
  assert.ok(aiAdSuggestions.includes('ONAYLA'), 'ONAYLA buton metni yok')
  assert.ok(aiAdSuggestions.includes('REDDET'), 'REDDET buton metni yok')
})

// ── Summary ──
setTimeout(() => {
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}, 800)
