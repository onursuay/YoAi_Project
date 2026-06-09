/**
 * Official Ads Refresh — Parser entegrasyon testleri (flag-gated)
 * Çalıştırma: npx tsx src/tests/officialAdsRefreshParserIntegration.test.ts
 */
import assert from 'assert'
import {
  runOfficialAdsDocsRefresh,
  type OfficialAdsSource,
} from '../../lib/yoai/officialAdsDocsRefresh'

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

function makeSource(over: Partial<OfficialAdsSource> = {}): OfficialAdsSource {
  return {
    id: 'src_1',
    platform: 'meta',
    source_type: 'docs',
    title: 'Meta Docs',
    url: 'https://example.com/docs',
    fetch_strategy: 'html',
    content_hash: 'eski_hash',
    status: 'active',
    importance: 'high',
    notes: null,
    ...over,
  }
}

// snapshot insert'leri yakalayan basit supabase mock
function makeDb(sources: OfficialAdsSource[]) {
  const snapshots: any[] = []
  return {
    snapshots,
    from: (table: string) => ({
      select: () => {
        if (table === 'official_ads_sources') {
          return { in: () => Promise.resolve({ data: sources, error: null }) }
        }
        if (table === 'official_ads_doc_snapshots') {
          return { eq: () => ({ order: () => ({ limit: () => ({ single: async () => ({ data: null }) }) }) }) }
        }
        return { in: () => Promise.resolve({ data: [], error: null }) }
      },
      insert: (d: any) => {
        if (table === 'official_ads_doc_snapshots') snapshots.push(d)
        return { catch: () => {} }
      },
      update: () => ({ eq: () => ({ catch: () => {} }) }),
    }),
  }
}

const fetchHtml = (text: string) => {
  const orig = global.fetch
  ;(global as any).fetch = async () =>
    ({ ok: true, status: 200, statusText: 'OK', headers: { get: () => 'text/html' }, text: async () => text } as unknown as Response)
  return () => {
    global.fetch = orig
  }
}

test('flag KAPALI → parser çağrılmaz, createdDrafts=0 (regresyon)', async () => {
  const db = makeDb([makeSource()])
  let parseCalled = false
  const restore = fetchHtml('<p>yeni içerik değişti burada uzun metin</p>')
  const result = await runOfficialAdsDocsRefresh(db, {
    parserEnabled: false,
    parseFn: (async () => { parseCalled = true; return [] }) as any,
    persistFn: (async () => 0) as any,
    loadApprovedFn: async () => [],
  })
  restore()
  assert.strictEqual(result.changedSources, 1)
  assert.strictEqual(parseCalled, false, 'flag kapalıyken parser çağrılmamalı')
  assert.strictEqual(result.createdDrafts, 0)
  assert.strictEqual(db.snapshots[0].parser_status, 'success')
})

test('flag AÇIK → parser çalışır, taslak üretir, parser_status=success', async () => {
  const db = makeDb([makeSource()])
  const restore = fetchHtml('<p>yeni içerik değişti burada uzun metin</p>')
  const result = await runOfficialAdsDocsRefresh(db, {
    parserEnabled: true,
    parseFn: (async () => [{ normalized_key: 'meta.objective.x', category: 'objective', title: 'X', summary: 's' }]) as any,
    persistFn: (async () => 2) as any,
    loadApprovedFn: async () => [],
  })
  restore()
  assert.strictEqual(result.createdDrafts, 2)
  assert.strictEqual(db.snapshots[0].parser_status, 'success')
  assert.strictEqual(db.snapshots[0].created_items_count, 2)
})

test('flag AÇIK + parser hata → parser_status=failed, job devam eder', async () => {
  const db = makeDb([makeSource()])
  const restore = fetchHtml('<p>yeni içerik değişti burada uzun metin</p>')
  const result = await runOfficialAdsDocsRefresh(db, {
    parserEnabled: true,
    parseFn: (async () => { throw new Error('AI patladı') }) as any,
    persistFn: (async () => 0) as any,
    loadApprovedFn: async () => [],
  })
  restore()
  assert.strictEqual(result.changedSources, 1, 'job devam etmeli')
  assert.strictEqual(db.snapshots[0].parser_status, 'failed')
  assert.strictEqual(result.createdDrafts, 0)
})

;(async () => {
  for (const t of queue) await t()
  console.log(`\n${passed + failed} test: ${passed} geçti, ${failed} başarısız`)
  if (failed > 0) process.exit(1)
})()
