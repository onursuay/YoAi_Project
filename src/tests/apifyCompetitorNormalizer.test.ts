/**
 * Apify Competitor Normalizer (A3) Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/apifyCompetitorNormalizer.test.ts
 *
 * normalizeApifyMetaAd: actor'ın güncel NESTED snapshot şemasını
 * (snapshot.body.text/title/cta_text/link_url/cards) + eski düz
 * şemayı (fallback) doğru okuduğunu doğrular.
 * normalizeApifyGoogleAd: metin döndürmeyen actor için dürüst
 * text_available bayrağını + advertiser/URL/tarih çıkarımını doğrular.
 */

import assert from 'assert'
import {
  normalizeApifyMetaAd,
  normalizeApifyGoogleAd,
} from '../../lib/yoai/apifyCompetitorProvider'

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

const CTX = { query_keyword: 'Trendyol', campaign_type_context: null }

/* ── Meta: NESTED snapshot (actor güncel şeması — audit canlı test) ── */

test('Meta nested snapshot: body.text/title/cta_text/link_url okunuyor', () => {
  const raw = {
    adArchiveID: '123456',
    pageName: 'Trendyol',
    pageID: '999',
    is_active: true,
    start_date: 1772179200,
    snapshot: {
      body: { text: "Aradığın ne varsa Trendyol'da! 🏃" },
      title: '{{product.name}}',
      cta_text: 'Shop now',
      link_url: 'https://www.trendyol.com/',
      caption: 'trendyol.com',
    },
  }
  const ad = normalizeApifyMetaAd(raw, CTX)
  assert.strictEqual(ad.advertiser_name, 'Trendyol')
  assert.strictEqual(ad.ad_body, "Aradığın ne varsa Trendyol'da! 🏃")
  assert.strictEqual(ad.ad_title, '{{product.name}}')
  assert.strictEqual(ad.call_to_action, 'Shop now')
  assert.strictEqual(ad.destination_url, 'https://www.trendyol.com/')
  assert.strictEqual(ad.is_active, true)
  assert.ok(ad.ad_delivery_start_time, 'start_date Unix saniye parse edilmeli')
})

test('Meta nested: snapshot.body düz string de olabilir', () => {
  const raw = { pageName: 'X', snapshot: { body: 'Düz metin gövde', title: 'Başlık' } }
  const ad = normalizeApifyMetaAd(raw, CTX)
  assert.strictEqual(ad.ad_body, 'Düz metin gövde')
  assert.strictEqual(ad.ad_title, 'Başlık')
})

test('Meta nested: body.markup.__html HTML temizleniyor', () => {
  const raw = { pageName: 'X', snapshot: { body: { markup: { __html: '<p>Merhaba&nbsp;<b>dünya</b></p>' } } } }
  const ad = normalizeApifyMetaAd(raw, CTX)
  assert.strictEqual(ad.ad_body, 'Merhaba dünya')
})

test('Meta nested: cards[] fallback (carousel ilk dolu kart)', () => {
  const raw = {
    pageName: 'X',
    snapshot: {
      cards: [
        { body: null, title: null },
        { body: 'Kart gövdesi', title: 'Kart başlığı', cta_text: 'Learn more', link_url: 'https://x.co' },
      ],
    },
  }
  const ad = normalizeApifyMetaAd(raw, CTX)
  assert.strictEqual(ad.ad_body, 'Kart gövdesi')
  assert.strictEqual(ad.ad_title, 'Kart başlığı')
  assert.strictEqual(ad.call_to_action, 'Learn more')
  assert.strictEqual(ad.destination_url, 'https://x.co')
})

test('Meta nested: snapshot.images/videos → creative_assets', () => {
  const raw = {
    pageName: 'X',
    snapshot: {
      body: { text: 'm' },
      images: [{ original_image_url: 'https://img/1.jpg' }],
      videos: [{ video_hd_url: 'https://vid/1.mp4', video_preview_image_url: 'https://thumb/1.jpg' }],
    },
  }
  const ad = normalizeApifyMetaAd(raw, CTX)
  assert.strictEqual(ad.creative_assets.length, 2)
  assert.strictEqual(ad.creative_assets[0].type, 'image')
  assert.strictEqual(ad.creative_assets[0].image_url, 'https://img/1.jpg')
  assert.strictEqual(ad.creative_assets[1].type, 'video')
  assert.strictEqual(ad.creative_assets[1].video_url, 'https://vid/1.mp4')
})

test('Meta FALLBACK: eski düz şema (top-level) hâlâ çalışıyor', () => {
  const raw = {
    adArchiveID: '1',
    pageName: 'EskiMarka',
    adCreativeBodies: ['Eski gövde'],
    adCreativeLinkTitles: ['Eski başlık'],
    callToAction: 'Sign Up',
    targetUrl: 'https://eski.co',
  }
  const ad = normalizeApifyMetaAd(raw, CTX)
  assert.strictEqual(ad.advertiser_name, 'EskiMarka')
  assert.strictEqual(ad.ad_body, 'Eski gövde')
  assert.strictEqual(ad.ad_title, 'Eski başlık')
  assert.strictEqual(ad.call_to_action, 'Sign Up')
  assert.strictEqual(ad.destination_url, 'https://eski.co')
})

test('Meta: tamamen boş kayıt crash etmiyor (toleranslı)', () => {
  const ad = normalizeApifyMetaAd({}, CTX)
  assert.strictEqual(ad.ad_body, null)
  assert.strictEqual(ad.advertiser_name, null)
  assert.strictEqual(ad.platform, 'meta')
})

/* ── Google: actor metin döndürmüyor — dürüst text_available ── */

test('Google metinsiz kayıt: advertiser/URL/format çıkıyor, text_available=false', () => {
  const raw = {
    creativeId: 'CR123',
    advertiserId: 'AD999',
    advertiserName: 'Reachpeople OU',
    adFormat: 'image',
    adUrl: 'https://adstransparency.google.com/...',
    firstShown: 1772179200,
    lastShown: 1774771200,
    previewUrl: 'https://preview/1.png',
  }
  const ad = normalizeApifyGoogleAd(raw, { query_keyword: 'Trendyol', campaign_type_context: null })
  assert.strictEqual(ad.advertiser_name, 'Reachpeople OU')
  assert.strictEqual(ad.source_ad_id, 'CR123')
  assert.strictEqual(ad.destination_url, 'https://adstransparency.google.com/...')
  assert.strictEqual(ad.ad_body, null)
  assert.strictEqual(ad.ad_title, null)
  assert.strictEqual(ad.extracted_signals.text_available, false)
  assert.strictEqual(ad.extracted_signals.format, 'image')
  assert.ok(ad.creative_assets.length >= 1, 'previewUrl creative asset olmalı')
})

test('Google metinli kayıt (varsa): text_available=true', () => {
  const raw = {
    creativeId: 'CR1',
    advertiserName: 'X',
    headline: 'Başlık var',
    description: 'Açıklama var',
  }
  const ad = normalizeApifyGoogleAd(raw, { query_keyword: 'x', campaign_type_context: null })
  assert.strictEqual(ad.ad_title, 'Başlık var')
  assert.strictEqual(ad.ad_body, 'Açıklama var')
  assert.strictEqual(ad.extracted_signals.text_available, true)
})

async function runAll(): Promise<void> {
  console.log('\nApify Competitor Normalizer (A3) testleri:\n')
  for (const t of pending) await t()
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

runAll()
