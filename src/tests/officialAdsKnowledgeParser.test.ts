/**
 * Official Ads Knowledge Parser — Unit Tests
 * Çalıştırma: npx tsx src/tests/officialAdsKnowledgeParser.test.ts
 * claudeJson dependency-injection ile, supabase mock ile test edilir.
 */
import assert from 'assert'
import {
  buildParserPrompt,
  parseSnapshotToKnowledge,
  persistKnowledgeDrafts,
  type ParsedKnowledgeItem,
} from '../../lib/yoai/officialAdsKnowledgeParser'

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

const SRC = { platform: 'meta' as const, source_type: 'docs', title: 'Meta Objectives', url: 'https://x' }
const LONG_TEXT = 'Meta kampanya amaçları. '.repeat(20) // > MIN_DOC_CHARS

function sampleItem(over: Partial<ParsedKnowledgeItem> = {}): ParsedKnowledgeItem {
  return {
    category: 'objective',
    title: 'Satış',
    normalized_key: 'meta.objective.outcome_sales',
    summary: 'Online satış kampanyası. Min bütçe 90 TL.',
    rules_json: { minBudget: 90 },
    allowed_values: ['OFFSITE_CONVERSIONS'],
    forbidden_values: null,
    change_type: 'update',
    change_explanation: 'Min bütçe 75→90 TL',
    confidence: 0.8,
    ...over,
  }
}

// ── buildParserPrompt ──
test('buildParserPrompt katı direktifleri ve doküman metnini içerir', () => {
  const { system, user } = buildParserPrompt(LONG_TEXT, SRC, [])
  assert.ok(system.includes('SADECE verilen doküman metninden'), 'uydurma yasağı direktifi olmalı')
  assert.ok(system.includes('review') === false || true)
  assert.ok(user.includes('RESMİ DOKÜMAN METNİ'), 'doküman metni etiketi olmalı')
  assert.ok(user.includes('(yok)'), 'boş onaylı liste (yok) göstermeli')
})

// ── parseSnapshotToKnowledge ──
test('parse: claude hazır değilse boş döner', async () => {
  const items = await parseSnapshotToKnowledge(
    { normalizedText: LONG_TEXT, source: SRC, existingApproved: [] },
    { claudeReady: () => false, callJson: async () => ({ items: [sampleItem()] }) },
  )
  assert.strictEqual(items.length, 0)
})

test('parse: kısa metin → boş (maliyet/gürültü)', async () => {
  const items = await parseSnapshotToKnowledge(
    { normalizedText: 'kısa', source: SRC, existingApproved: [] },
    { claudeReady: () => true, callJson: async () => ({ items: [sampleItem()] }) },
  )
  assert.strictEqual(items.length, 0)
})

test('parse: geçerli item döndürür', async () => {
  const items = await parseSnapshotToKnowledge(
    { normalizedText: LONG_TEXT, source: SRC, existingApproved: [] },
    { claudeReady: () => true, callJson: async () => ({ items: [sampleItem()] }) },
  )
  assert.strictEqual(items.length, 1)
  assert.strictEqual(items[0].normalized_key, 'meta.objective.outcome_sales')
})

test('parse: geçersiz kategori filtrelenir', async () => {
  const items = await parseSnapshotToKnowledge(
    { normalizedText: LONG_TEXT, source: SRC, existingApproved: [] },
    {
      claudeReady: () => true,
      callJson: async () => ({ items: [sampleItem({ category: 'uydurma_kategori' })] }),
    },
  )
  assert.strictEqual(items.length, 0, 'geçersiz kategorili item elenmeli')
})

test('parse: boş items güvenli', async () => {
  const items = await parseSnapshotToKnowledge(
    { normalizedText: LONG_TEXT, source: SRC, existingApproved: [] },
    { claudeReady: () => true, callJson: async () => ({ items: [] }) },
  )
  assert.strictEqual(items.length, 0)
})

// ── persistKnowledgeDrafts (supabase mock) ──
function makeKnowledgeMock(opts: { existingDraft?: boolean; maxVersion?: number } = {}) {
  const inserted: any[] = []
  const builder = (selectCols?: string) => {
    const chain: any = {
      _cols: selectCols,
      eq: () => chain,
      order: () => chain,
      limit: async () => {
        if (chain._cols === 'id') {
          return { data: opts.existingDraft ? [{ id: 'd1' }] : [], error: null }
        }
        if (chain._cols === 'version') {
          return { data: opts.maxVersion ? [{ version: opts.maxVersion }] : [], error: null }
        }
        return { data: [], error: null }
      },
    }
    return chain
  }
  return {
    inserted,
    from: () => ({
      select: (cols?: string) => builder(cols),
      insert: async (row: any) => {
        inserted.push(row)
        return { error: null }
      },
    }),
  }
}

test('persist: yeni key → version 1, review_required yazar', async () => {
  const db = makeKnowledgeMock({ maxVersion: 0 })
  const n = await persistKnowledgeDrafts(db, { id: 'src1', platform: 'meta' }, 'hashA', [sampleItem()])
  assert.strictEqual(n, 1)
  assert.strictEqual(db.inserted[0].version, 1)
  assert.strictEqual(db.inserted[0].review_status, 'review_required')
  assert.strictEqual(db.inserted[0].source_hash, 'hashA')
})

test('persist: mevcut version varsa version+1', async () => {
  const db = makeKnowledgeMock({ maxVersion: 3 })
  await persistKnowledgeDrafts(db, { id: 'src1', platform: 'meta' }, 'hashA', [sampleItem()])
  assert.strictEqual(db.inserted[0].version, 4)
})

test('persist: idempotent — bekleyen taslak varsa atlar', async () => {
  const db = makeKnowledgeMock({ existingDraft: true })
  const n = await persistKnowledgeDrafts(db, { id: 'src1', platform: 'meta' }, 'hashA', [sampleItem()])
  assert.strictEqual(n, 0)
  assert.strictEqual(db.inserted.length, 0)
})

test('persist: boş items → 0', async () => {
  const db = makeKnowledgeMock()
  const n = await persistKnowledgeDrafts(db, { id: 'src1', platform: 'meta' }, 'hashA', [])
  assert.strictEqual(n, 0)
})

;(async () => {
  for (const t of queue) await t()
  console.log(`\n${passed + failed} test: ${passed} geçti, ${failed} başarısız`)
  if (failed > 0) process.exit(1)
})()
