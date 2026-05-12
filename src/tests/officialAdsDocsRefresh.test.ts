/**
 * Official Ads Docs Refresh — Unit Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/officialAdsDocsRefresh.test.ts
 *
 * Test framework gerektirmez; Node assert modülü kullanır.
 * Supabase ve fetch mock edilir.
 */

import assert from 'assert'
import {
  normalizeOfficialAdsContent,
  hashOfficialAdsContent,
  summarizeOfficialAdsDiff,
  classifyOfficialAdsChange,
  runOfficialAdsDocsRefresh,
  type OfficialAdsSource,
  type FetchResult,
} from '../../lib/yoai/officialAdsDocsRefresh'

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0
let failed = 0
const queue: Array<() => Promise<void>> = []

function test(name: string, fn: () => void | Promise<void>): void {
  queue.push(async () => {
    try {
      await fn()
      console.log(`  ✓  ${name}`)
      passed++
    } catch (err) {
      const msg = err instanceof assert.AssertionError ? err.message : String(err)
      console.error(`  ✗  ${name}`)
      console.error(`     ${msg}`)
      failed++
    }
  })
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeSource(overrides: Partial<OfficialAdsSource> = {}): OfficialAdsSource {
  return {
    id: 'src_1',
    platform: 'google',
    source_type: 'docs',
    title: 'Google Ads Help',
    url: 'https://example.com/docs',
    fetch_strategy: 'html',
    content_hash: null,
    status: 'active',
    importance: 'medium',
    notes: null,
    ...overrides,
  }
}

interface MockCall {
  table: string
  op: string
  data?: any
}

function makeMockSupabase(sources: OfficialAdsSource[]) {
  const calls: MockCall[] = []
  const snapshots: any[] = []

  const chainable = (table: string, op: string, data?: any): any => {
    calls.push({ table, op, data })
    return {
      select: () => chainable(table, 'select'),
      in: () => chainable(table, 'in'),
      eq: () => chainable(table, 'eq'),
      order: () => chainable(table, 'order'),
      limit: () => chainable(table, 'limit'),
      single: async () =>
        table === 'official_ads_sources' && op === 'in'
          ? { data: sources, error: null }
          : { data: null, error: null },
      insert: (d: any) => {
        if (table === 'official_ads_doc_snapshots') snapshots.push(d)
        calls.push({ table, op: 'insert', data: d })
        return {
          select: () => ({ single: async () => ({ data: { id: 'run_1' } }) }),
          catch: () => ({ data: null }),
        }
      },
      update: (d: any) => {
        calls.push({ table, op: 'update', data: d })
        return {
          eq: () => ({ catch: () => {} }),
        }
      },
      catch: () => {},
    }
  }

  return {
    from: (table: string) => ({
      select: (cols?: string) => {
        if (table === 'official_ads_sources') {
          return {
            in: (_col: string, _vals: string[]) =>
              Promise.resolve({ data: sources, error: null }),
          }
        }
        if (table === 'official_ads_doc_snapshots') {
          return {
            eq: () => ({
              order: () => ({
                limit: () => ({
                  single: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }
        }
        return chainable(table, 'select')
      },
      insert: (d: any) => {
        if (table === 'official_ads_doc_snapshots') snapshots.push(d)
        if (table === 'official_ads_refresh_runs') {
          return {
            select: () => ({
              single: async () => ({ data: { id: 'run_1' }, error: null }),
            }),
          }
        }
        calls.push({ table, op: 'insert', data: d })
        return { catch: () => {} }
      },
      update: (d: any) => {
        calls.push({ table, op: 'update', data: d })
        return { eq: () => ({ catch: () => {} }) }
      },
    }),
    _calls: calls,
    _snapshots: snapshots,
  }
}

// Override global fetch for tests
function withMockFetch(
  handler: (url: string) => { ok: boolean; text?: string; status?: number },
  fn: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch
  ;(globalThis as any).fetch = async (url: string) => {
    const result = handler(url)
    if (!result.ok) {
      return { ok: false, status: result.status ?? 500, statusText: 'Error', text: async () => '' }
    }
    return { ok: true, status: 200, statusText: 'OK', text: async () => result.text ?? '' }
  }
  return fn().finally(() => {
    globalThis.fetch = original
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\nOfficial Ads Docs Refresh Tests\n')

// 1. HTML normalization strips tags
test('HTML normalize strips script, style ve etiketleri', () => {
  const html = '<html><head><script>var x=1</script><style>body{}</style></head><body><h1>Google Ads Help</h1><p>Kampanya oluşturun.</p></body></html>'
  const result = normalizeOfficialAdsContent(html, 'html')
  assert.ok(!result.includes('<script>'), 'script etiketi kalmamalı')
  assert.ok(!result.includes('<h1>'), 'h1 etiketi kalmamalı')
  assert.ok(result.includes('Google Ads Help'), 'metin korunmalı')
  assert.ok(result.includes('Kampanya oluşturun'), 'gövde metni korunmalı')
})

// 2. RSS normalization extracts items
test('RSS normalize başlık ve açıklamaları çıkarır', () => {
  const rss = `<?xml version="1.0"?>
  <rss><channel>
    <title>Google Ads Blog</title>
    <item><title>Yeni Özellik</title><description>Detaylar burada</description></item>
  </channel></rss>`
  const result = normalizeOfficialAdsContent(rss, 'rss')
  assert.ok(result.includes('Google Ads Blog'), 'kanal başlığı çıkarılmalı')
  assert.ok(result.includes('Yeni Özellik'), 'item başlığı çıkarılmalı')
  assert.ok(result.includes('Detaylar burada'), 'açıklama çıkarılmalı')
})

// 3. manual_review returns fixed string
test('manual_review stratejisi fetch yapmadan sabit metin döndürür', () => {
  const result = normalizeOfficialAdsContent('herhangi bir içerik', 'manual_review')
  assert.strictEqual(result, '[manual_review — no fetch performed]')
})

// 4. Same content → same hash
test('Aynı içerik aynı hash üretir', () => {
  const text = 'Google Ads resmi doküman içeriği'
  const h1 = hashOfficialAdsContent(text)
  const h2 = hashOfficialAdsContent(text)
  assert.strictEqual(h1, h2)
  assert.strictEqual(h1.length, 64, 'SHA-256 hex 64 karakter olmalı')
})

// 5. Different content → different hash
test('Değişen içerik farklı hash üretir', () => {
  const h1 = hashOfficialAdsContent('içerik A')
  const h2 = hashOfficialAdsContent('içerik B')
  assert.notStrictEqual(h1, h2)
})

// 6. classifyOfficialAdsChange: critical/high → review_required
test('critical ve high önem düzeyli kaynak review_required döndürür', () => {
  assert.strictEqual(classifyOfficialAdsChange({ importance: 'critical' }), 'review_required')
  assert.strictEqual(classifyOfficialAdsChange({ importance: 'high' }), 'review_required')
})

// 7. classifyOfficialAdsChange: medium/low → active
test('medium ve low önem düzeyli kaynak active döndürür', () => {
  assert.strictEqual(classifyOfficialAdsChange({ importance: 'medium' }), 'active')
  assert.strictEqual(classifyOfficialAdsChange({ importance: 'low' }), 'active')
})

// 8. summarizeOfficialAdsDiff produces meaningful string
test('summarizeOfficialAdsDiff kelime sayısı ve değişiklik bölgesi içerir', () => {
  const oldText = 'Google Ads kampanya türleri arama alışveriş'
  const newText = 'Google Ads kampanya türleri arama video alışveriş performans'
  const summary = summarizeOfficialAdsDiff(oldText, newText)
  assert.ok(summary.includes('Kelime:'), 'kelime sayısı bilgisi olmalı')
  assert.ok(summary.length > 10, 'boş özet döndürmemeli')
})

// 9. Hash aynıysa changedSources artmaz
test('Hash aynıysa changedSources artmaz', async () => {
  const existingHash = hashOfficialAdsContent(
    normalizeOfficialAdsContent('<p>Sabit içerik</p>', 'html'),
  )
  const source = makeSource({ content_hash: existingHash, importance: 'medium' })
  const db = makeMockSupabase([source])

  await withMockFetch(() => ({ ok: true, text: '<p>Sabit içerik</p>' }), async () => {
    const result = await runOfficialAdsDocsRefresh(db)
    assert.strictEqual(result.changedSources, 0, 'değişiklik olmamalı')
    assert.strictEqual(result.checkedSources, 1, 'kontrol edilmeli')
    assert.strictEqual(result.failedSources, 0, 'hata olmamalı')
  })
})

// 10. Hash farklıysa snapshot kaydı hazırlanır ve changedSources artar
test('Hash farklıysa changedSources artar ve snapshot eklenir', async () => {
  const source = makeSource({ content_hash: 'eski_hash', importance: 'medium' })
  const db = makeMockSupabase([source])

  await withMockFetch(() => ({ ok: true, text: '<p>Yeni güncellenmiş içerik burada</p>' }), async () => {
    const result = await runOfficialAdsDocsRefresh(db)
    assert.strictEqual(result.changedSources, 1, 'değişiklik sayılmalı')
    assert.strictEqual(result.checkedSources, 1)
    assert.strictEqual(result.changed[0].sourceId, 'src_1')
    assert.ok(result.changed[0].newHash !== 'eski_hash', 'yeni hash farklı olmalı')
  })
})

// 11. critical kaynak değişirse review_required olur
test('Critical kaynak değişirse status review_required olur', async () => {
  const source = makeSource({ content_hash: 'eski_hash', importance: 'critical' })
  const db = makeMockSupabase([source])

  await withMockFetch(() => ({ ok: true, text: '<p>Kritik politika değişikliği</p>' }), async () => {
    const result = await runOfficialAdsDocsRefresh(db)
    assert.strictEqual(result.reviewRequiredCount, 1)
    assert.strictEqual(result.changed[0].status, 'review_required')
  })
})

// 12. Fetch fail job'ı patlatmaz
test('Fetch hatası tüm job\'ı bozmaz, failedSources artar', async () => {
  const sources = [
    makeSource({ id: 'src_1', content_hash: null }),
    makeSource({ id: 'src_2', content_hash: null, url: 'https://fail.example.com' }),
  ]
  const db = makeMockSupabase(sources)

  await withMockFetch((url: string) => {
    if (url.includes('fail.example.com')) return { ok: false, status: 503 }
    return { ok: true, text: '<p>Normal içerik</p>' }
  }, async () => {
    const result = await runOfficialAdsDocsRefresh(db)
    assert.ok(result.failedSources >= 1, 'başarısız kaynak sayılmalı')
    assert.strictEqual(result.checkedSources, 2, 'tüm kaynaklar kontrol edilmeli')
  })
})

// ── Run queue sequentially ────────────────────────────────────────────────────

;(async () => {
  for (const t of queue) await t()
  console.log(`\n${passed + failed} test: ${passed} geçti, ${failed} başarısız\n`)
  if (failed > 0) process.exit(1)
})()
