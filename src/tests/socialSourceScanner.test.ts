/**
 * Social Source Scanner — Unit Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/socialSourceScanner.test.ts
 *
 * Network erişim çağrıları test ortamında fetch monkey-patch
 * edilerek dış bağımlılık tetiklenmez.
 */

import assert from 'assert'
import {
  scanSocialSource,
  isSocialSourceType,
  getSocialScanProviderInfo,
} from '../../lib/yoai/socialSourceScanner'
import { scanBusinessSource } from '../../lib/yoai/businessSourceScanner'

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

console.log('🧪 Social Source Scanner Tests\n')

/* ── fetch monkey-patch helper ── */

const originalFetch = globalThis.fetch
function withMockedFetch(
  responder: (url: string) => { ok: boolean; status?: number; html?: string; contentType?: string } | Promise<{ ok: boolean; status?: number; html?: string; contentType?: string }>,
  fn: () => Promise<void>,
): Promise<void> {
  globalThis.fetch = (async (input: any) => {
    const url = typeof input === 'string' ? input : input?.url || ''
    const r = await responder(url)
    return {
      ok: !!r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? r.contentType ?? 'text/html; charset=utf-8' : null) },
      text: async () => r.html ?? '',
    } as any
  }) as any
  return fn().finally(() => {
    globalThis.fetch = originalFetch
  })
}

/* ── Tests ── */

console.log('▶ isSocialSourceType')

test('Instagram/Facebook/LinkedIn/YouTube/TikTok sosyal kabul edilir', () => {
  for (const t of ['instagram', 'facebook', 'linkedin', 'youtube', 'tiktok'] as const) {
    assert.ok(isSocialSourceType(t))
  }
})

test('website / google_business / marketplace sosyal değildir', () => {
  for (const t of ['website', 'google_business', 'marketplace', 'extra'] as const) {
    assert.ok(!isSocialSourceType(t))
  }
})

console.log('\n▶ Provider info')

test('Provider info APIFY_API_TOKEN durumunu yansıtır', () => {
  const info = getSocialScanProviderInfo()
  assert.strictEqual(info.provider, 'public_metadata')
  assert.strictEqual(typeof info.apifyTokenPresent, 'boolean')
})

console.log('\n▶ scanSocialSource — public metadata fallback')

test('og:title + og:description çıkarıldığında scan_status=completed olur', async () => {
  await withMockedFetch(
    () => ({
      ok: true,
      html: `
        <html><head>
          <meta property="og:title" content="Test Aşçılık Akademisi" />
          <meta property="og:description" content="MYK belgeli aşçılık eğitimleri, hijyen kursları" />
          <meta property="og:site_name" content="Test Akademi" />
          <title>Aşçılık Akademisi</title>
        </head><body><p>İstanbul'da hizmet veren aşçılık akademisi. Bize ulaşın.</p></body></html>
      `,
    }),
    async () => {
      const out = await scanSocialSource({ source_type: 'instagram', source_url: 'https://instagram.com/test' })
      assert.strictEqual(out.scan_status, 'completed')
      assert.ok(out.extracted_title?.includes('Aşçılık'))
      assert.ok(out.extracted_description?.includes('MYK'))
      assert.ok(out.confidence > 30)
      assert.strictEqual(out.error_message, null)
    },
  )
})

test('Login wall karşılaşılırsa scan_status=failed yazılır (fake veri YOK)', async () => {
  await withMockedFetch(
    () => ({
      ok: true,
      html: `<html><head><title>Login</title></head><body>Log in to see this content. Sign up to continue.</body></html>`,
    }),
    async () => {
      const out = await scanSocialSource({ source_type: 'instagram', source_url: 'https://instagram.com/private' })
      assert.strictEqual(out.scan_status, 'failed')
      assert.ok(out.error_message?.includes('login_wall'))
      assert.strictEqual(out.confidence, 0)
      // Fake veri kontrolü: keywords/ctas/services boş olmalı
      assert.deepStrictEqual(out.extracted_keywords, [])
      assert.deepStrictEqual(out.extracted_services, [])
    },
  )
})

test('HTTP 404 dönerse scan_status=failed olur', async () => {
  await withMockedFetch(
    () => ({ ok: false, status: 404, html: '' }),
    async () => {
      const out = await scanSocialSource({ source_type: 'facebook', source_url: 'https://facebook.com/missing' })
      assert.strictEqual(out.scan_status, 'failed')
      assert.ok(out.error_message?.includes('http_404'))
    },
  )
})

test('URL boşsa failed döner', async () => {
  const out = await scanSocialSource({ source_type: 'tiktok', source_url: '' })
  assert.strictEqual(out.scan_status, 'failed')
  assert.ok(out.error_message?.includes('no_url'))
})

test('Sosyal olmayan source_type girilirse failed döner', async () => {
  const out = await scanSocialSource({ source_type: 'website', source_url: 'https://example.com' })
  assert.strictEqual(out.scan_status, 'failed')
  assert.ok(out.error_message?.includes('unsupported_source_type'))
})

test('Hiç extractable metadata yoksa failed (fake veri YOK)', async () => {
  await withMockedFetch(
    () => ({ ok: true, html: '<html><head></head><body><div></div></body></html>' }),
    async () => {
      const out = await scanSocialSource({ source_type: 'youtube', source_url: 'https://youtube.com/empty' })
      assert.strictEqual(out.scan_status, 'failed')
      assert.ok(out.error_message?.includes('no_extractable_metadata'))
    },
  )
})

console.log('\n▶ businessSourceScanner — entegre social binding')

test('Instagram URL artık doğrudan scraper_provider_missing ile kalmaz', async () => {
  await withMockedFetch(
    () => ({
      ok: true,
      html: `<html><head>
        <meta property="og:title" content="Marka Hesabı" />
        <meta property="og:description" content="Marka açıklaması burada" />
      </head><body>Marka anasayfa içerik özeti.</body></html>`,
    }),
    async () => {
      const out = await scanBusinessSource({ source_type: 'instagram', source_url: 'https://instagram.com/brand' })
      // Provider missing değil, public metadata fallback üzerinden completed olmalı
      assert.notStrictEqual(out.error_message, 'scraper_provider_missing')
      assert.notStrictEqual(out.error_message, 'social_scraper_not_implemented')
      assert.strictEqual(out.scan_status, 'completed')
    },
  )
})

test('Facebook/LinkedIn/YouTube/TikTok social tarama provider_info etiketler', async () => {
  await withMockedFetch(
    () => ({
      ok: true,
      html: `<html><head>
        <meta property="og:title" content="Profil" />
        <meta property="og:description" content="Açıklama" />
      </head><body>İçerik metni.</body></html>`,
    }),
    async () => {
      for (const t of ['facebook', 'linkedin', 'youtube', 'tiktok'] as const) {
        const out = await scanBusinessSource({ source_type: t, source_url: `https://${t}.com/test` })
        assert.strictEqual(out.scan_status, 'completed', `${t} should complete via public metadata`)
      }
    },
  )
})

test('Google Business URL hala HTTP scanner ile taranır (sosyal değildir)', async () => {
  await withMockedFetch(
    () => ({
      ok: true,
      html: `<html><head><title>Google Business</title>
        <meta name="description" content="İşletme açıklaması" /></head>
        <body>İletişime geç. Randevu al. İstanbul merkez.</body></html>`,
    }),
    async () => {
      const out = await scanBusinessSource({ source_type: 'google_business', source_url: 'https://maps.google.com/place/x' })
      assert.strictEqual(out.scan_status, 'completed')
      assert.ok(out.extracted_title?.length || out.extracted_description?.length)
    },
  )
})

console.log('\n▶ Hata toleransı')

test('Network hatası fake veri üretmez', async () => {
  await withMockedFetch(
    () => { throw new Error('ECONNRESET') },
    async () => {
      const out = await scanSocialSource({ source_type: 'instagram', source_url: 'https://instagram.com/x' })
      assert.strictEqual(out.scan_status, 'failed')
      // Hiçbir extracted alan dolu olmamalı
      assert.strictEqual(out.extracted_title, null)
      assert.strictEqual(out.extracted_description, null)
    },
  )
})

// ── Runner ──
void runAll()
