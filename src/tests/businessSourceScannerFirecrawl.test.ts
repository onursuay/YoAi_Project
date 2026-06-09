/**
 * businessSourceScanner — Firecrawl entegrasyonu + regresyon testleri
 * Çalıştırma: npx tsx src/tests/businessSourceScannerFirecrawl.test.ts
 * global.fetch monkey-patch: hem HTTP site fetch'i hem Firecrawl API'si mock'lanır.
 */
import assert from 'assert'
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

const realFetch = global.fetch
function mockFetch(
  handler: (url: string) => { ok: boolean; status?: number; headers?: Record<string, string>; text?: string; json?: unknown },
): void {
  // @ts-expect-error test override
  global.fetch = async (url: string) => {
    const r = handler(String(url))
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      headers: { get: (k: string) => (r.headers || { 'content-type': 'text/html' })[k.toLowerCase()] ?? null },
      text: async () => r.text ?? '',
      json: async () => r.json ?? {},
    } as unknown as Response
  }
}
function restoreFetch(): void {
  global.fetch = realFetch
}

const SAMPLE_HTML =
  '<html><head><title>Antso Hukuk</title><meta name="description" content="İstanbul avukatlık hizmetleri"></head>' +
  '<body><h1>Hizmetlerimiz</h1><p>İletişime geç, randevu al. Profesyonel kurumsal yaklaşım. İstanbul ve Ankara.</p></body></html>'

test('REGRESYON: flag kapalı → HTTP fetch ile taranır, çıktı bozulmaz', async () => {
  delete process.env.FIRECRAWL_ENABLED
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(() => ({ ok: true, text: SAMPLE_HTML }))
  const out = await scanBusinessSource({ source_type: 'website', source_url: 'https://antso.com' })
  restoreFetch()
  assert.strictEqual(out.scan_status, 'completed')
  assert.strictEqual(out.extracted_title, 'Antso Hukuk')
  assert.strictEqual(out.extracted_description, 'İstanbul avukatlık hizmetleri')
  // NOT: 'İstanbul' (büyük İ) toLowerCase tuzağı nedeniyle eşleşmez (önceden var olan bug);
  // 'Ankara' temiz round-trip yapar → konum çıkarımının çalıştığını bununla doğrularız.
  assert.ok(out.extracted_locations.includes('Ankara'))
  assert.strictEqual(out.scanProvider, 'http')
})

test('Firecrawl yolu: flag açık → scanProvider firecrawl, markdown içeriği işlenir', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  process.env.FIRECRAWL_ENABLED = 'true'
  mockFetch((url) => {
    if (url.includes('/v2/map')) return { ok: true, json: { success: true, links: [] } }
    if (url.includes('/v2/scrape')) {
      return {
        ok: true,
        json: {
          success: true,
          data: { markdown: 'Profesyonel kurumsal avukatlık. İletişime geç. Ankara.', metadata: { title: 'Antso', description: 'Hukuk' } },
        },
      }
    }
    return { ok: true, text: SAMPLE_HTML }
  })
  const out = await scanBusinessSource({ source_type: 'website', source_url: 'https://antso.com' })
  restoreFetch()
  assert.strictEqual(out.scan_status, 'completed')
  assert.strictEqual(out.scanProvider, 'firecrawl')
  assert.strictEqual(out.extracted_title, 'Antso')
  assert.ok(out.extracted_locations.includes('Ankara'))
})

test("Fallback: flag açık ama Firecrawl boş döner → HTTP fetch'e düşer", async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  process.env.FIRECRAWL_ENABLED = 'true'
  mockFetch((url) => {
    if (url.includes('/v2/map')) return { ok: true, json: { success: true, links: [] } }
    if (url.includes('/v2/scrape')) return { ok: true, json: { success: true, data: { metadata: {} } } } // markdown yok → null
    return { ok: true, text: SAMPLE_HTML } // HTTP fallback
  })
  const out = await scanBusinessSource({ source_type: 'website', source_url: 'https://antso.com' })
  restoreFetch()
  assert.strictEqual(out.scan_status, 'completed')
  assert.strictEqual(out.scanProvider, 'http')
  assert.strictEqual(out.extracted_title, 'Antso Hukuk')
})

test('Sosyal kaynak Firecrawl\'a girmez (flag açık olsa bile)', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  process.env.FIRECRAWL_ENABLED = 'true'
  let firecrawlCalled = false
  mockFetch((url) => {
    if (url.includes('api.firecrawl.dev')) {
      firecrawlCalled = true
      return { ok: true, json: { success: true, data: { markdown: 'x' } } }
    }
    return { ok: true, text: '<html><head><title>IG</title></head><body>x</body></html>' }
  })
  await scanBusinessSource({ source_type: 'instagram', source_url: 'https://instagram.com/antso' })
  restoreFetch()
  assert.strictEqual(firecrawlCalled, false)
})

async function runAll(): Promise<void> {
  for (const t of pending) await t()
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}
runAll()
