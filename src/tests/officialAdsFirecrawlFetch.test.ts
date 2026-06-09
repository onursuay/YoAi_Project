/**
 * Official Ads Firecrawl Fetch — Unit Tests
 * Çalıştırma: npx tsx src/tests/officialAdsFirecrawlFetch.test.ts
 * global.fetch monkey-patch: api.firecrawl.dev → Firecrawl; diğer URL → kaynak içerik.
 */
import assert from 'assert'
import { fetchOfficialAdsSource, type OfficialAdsSource } from '../../lib/yoai/officialAdsDocsRefresh'

let passed = 0
let failed = 0
const queue: Array<() => Promise<void>> = []
function test(name: string, fn: () => void | Promise<void>): void {
  queue.push(async () => {
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

function src(over: Partial<OfficialAdsSource> = {}): OfficialAdsSource {
  return {
    id: 's1',
    platform: 'meta',
    source_type: 'docs',
    title: 'T',
    url: 'https://docs.example.com/page',
    fetch_strategy: 'html',
    content_hash: null,
    status: 'active',
    importance: 'high',
    notes: null,
    ...over,
  }
}

const realFetch = global.fetch
let firecrawlHit = false
function mockFetch(opts: { scrapeMarkdown?: string | null; siteHtml?: string; siteRss?: string }): void {
  firecrawlHit = false
  // @ts-expect-error override
  global.fetch = async (url: string) => {
    const u = String(url)
    if (u.includes('api.firecrawl.dev')) {
      firecrawlHit = true
      if (u.includes('/v2/map')) return { ok: true, status: 200, json: async () => ({ success: true, links: [] }) } as Response
      // scrape
      const md = opts.scrapeMarkdown
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: md ? { markdown: md, metadata: {} } : { metadata: {} } }),
      } as Response
    }
    // kaynak sitesi (düz fetch)
    const body = opts.siteRss ?? opts.siteHtml ?? '<html><body>düz fetch içeriği</body></html>'
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'text/html' },
      text: async () => body,
    } as unknown as Response
  }
}
function restore(): void {
  global.fetch = realFetch
}

test('Firecrawl açık + html → markdown çekilir, hash üretilir', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  process.env.FIRECRAWL_ENABLED = 'true'
  mockFetch({ scrapeMarkdown: 'Meta kampanya amaçları güncellendi. Min bütçe 90 TL.' })
  const r = await fetchOfficialAdsSource(src({ fetch_strategy: 'html' }))
  restore()
  assert.strictEqual(r.success, true)
  assert.ok(firecrawlHit, 'Firecrawl çağrılmalı')
  assert.ok(r.normalizedText.includes('Min bütçe 90 TL'), 'markdown içeriği normalize edilmeli')
  assert.strictEqual(r.contentHash.length, 64)
})

test('Firecrawl boş döner → düz fetch fallback', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  process.env.FIRECRAWL_ENABLED = 'true'
  mockFetch({ scrapeMarkdown: null, siteHtml: '<html><body>fallback metni burada</body></html>' })
  const r = await fetchOfficialAdsSource(src({ fetch_strategy: 'html' }))
  restore()
  assert.strictEqual(r.success, true)
  assert.ok(r.normalizedText.includes('fallback metni'), 'düz fetch içeriği kullanılmalı')
})

test('rss stratejisi Firecrawl\'a girmez (flag açık olsa bile)', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  process.env.FIRECRAWL_ENABLED = 'true'
  mockFetch({ siteRss: '<rss><channel><title>Blog</title><item><title>Yeni</title><description>d</description></item></channel></rss>' })
  const r = await fetchOfficialAdsSource(src({ fetch_strategy: 'rss' }))
  restore()
  assert.strictEqual(firecrawlHit, false, 'rss için Firecrawl çağrılmamalı')
  assert.ok(r.normalizedText.includes('Blog'), 'rss düz fetch ile işlenmeli')
})

test('REGRESYON: flag kapalı → düz fetch (Firecrawl yok)', async () => {
  delete process.env.FIRECRAWL_ENABLED
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch({ siteHtml: '<html><body>düz fetch normal yol</body></html>' })
  const r = await fetchOfficialAdsSource(src({ fetch_strategy: 'html' }))
  restore()
  assert.strictEqual(firecrawlHit, false, 'flag kapalıyken Firecrawl çağrılmamalı')
  assert.ok(r.normalizedText.includes('düz fetch normal yol'))
})

;(async () => {
  for (const t of queue) await t()
  console.log(`\n${passed + failed} test: ${passed} geçti, ${failed} başarısız`)
  if (failed > 0) process.exit(1)
})()
