/**
 * Audience User-ID Binding & RLS Tests (Faz 2)
 *
 * Çalıştırma:
 *   npx tsx src/tests/audienceUserIdBinding.test.ts
 *
 * Statik dosya içeriği analizi ile:
 *   - Migration: user_id kolonu, index, RLS, 4 policy
 *   - MetaContext: userId alanı
 *   - Tüm route'lar: user_id filtresi + INSERT yazımı
 *   - Lookalike seed: cross-user erişim engeli
 *   - Orphan güvenliği: NULL fallback yok
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'

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
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

const ROOT = path.resolve(__dirname, '../../')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}

/* ── Migration ── */

console.log('🧪 Audience User-ID Binding & RLS Tests\n')
console.log('▶ Migration — user_id kolonu + RLS')

const MIGRATION = 'supabase/migrations/20260515100000_audiences_user_id_rls.sql'

test('migration dosyası mevcut', () => {
  assert.ok(
    fs.existsSync(path.join(ROOT, MIGRATION)),
    `Migration dosyası bulunamadı: ${MIGRATION}`
  )
})

test('migration: user_id TEXT kolonu ekleniyor', () => {
  const sql = read(MIGRATION)
  assert.ok(
    sql.includes('ADD COLUMN') && sql.includes('user_id') && sql.includes('TEXT'),
    'user_id TEXT ADD COLUMN ifadesi bulunamadı'
  )
})

test('migration: user_id için index oluşturuluyor', () => {
  const sql = read(MIGRATION)
  assert.ok(
    sql.includes('idx_audiences_user_id'),
    'idx_audiences_user_id index ifadesi bulunamadı'
  )
})

test('migration: ENABLE ROW LEVEL SECURITY', () => {
  const sql = read(MIGRATION)
  assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'), 'RLS enable ifadesi bulunamadı')
})

test('migration: SELECT policy tanımlı', () => {
  const sql = read(MIGRATION)
  assert.ok(sql.includes('audiences_select_own'), 'SELECT policy bulunamadı')
})

test('migration: INSERT policy tanımlı', () => {
  const sql = read(MIGRATION)
  assert.ok(sql.includes('audiences_insert_own'), 'INSERT policy bulunamadı')
})

test('migration: UPDATE policy tanımlı', () => {
  const sql = read(MIGRATION)
  assert.ok(sql.includes('audiences_update_own'), 'UPDATE policy bulunamadı')
})

test('migration: DELETE policy tanımlı', () => {
  const sql = read(MIGRATION)
  assert.ok(sql.includes('audiences_delete_own'), 'DELETE policy bulunamadı')
})

/* ── MetaContext ── */

console.log('\n▶ MetaContext — userId alanı')

test('MetaContext interface userId: string içeriyor', () => {
  const ctx = read('lib/meta/context.ts')
  assert.ok(ctx.includes('userId: string'), 'MetaContext userId alanı bulunamadı')
})

test('resolveMetaContext userId: sessionId döndürüyor', () => {
  const ctx = read('lib/meta/context.ts')
  assert.ok(ctx.includes('userId: sessionId'), 'resolveMetaContext userId: sessionId döndürmüyor')
})

/* ── Route: GET + POST /api/audiences ── */

console.log('\n▶ Route: /api/audiences (list + create)')

const LIST_ROUTE = 'app/api/audiences/route.ts'

test('list GET: user_id filtresi var', () => {
  const content = read(LIST_ROUTE)
  assert.ok(
    content.includes(".eq('user_id', ctx.userId)"),
    'GET /api/audiences user_id filtresi eksik'
  )
})

test('create POST: row\'a user_id yazılıyor', () => {
  const content = read(LIST_ROUTE)
  assert.ok(
    content.includes('user_id: ctx.userId'),
    'POST /api/audiences INSERT row user_id eksik'
  )
})

/* ── Route: GET + PATCH + DELETE /api/audiences/[id] ── */

console.log('\n▶ Route: /api/audiences/[id] (get + patch + delete)')

const ID_ROUTE = 'app/api/audiences/[id]/route.ts'

test('[id] GET: user_id filtresi var', () => {
  const content = read(ID_ROUTE)
  const getBlock = content.match(/async function GET[\s\S]{0,800}/)?.[0] ?? ''
  assert.ok(
    getBlock.includes(".eq('user_id', ctx.userId)"),
    'GET /api/audiences/[id] user_id filtresi eksik'
  )
})

test('[id] PATCH — status check: user_id filtresi var', () => {
  const content = read(ID_ROUTE)
  const patchBlock = content.match(/async function PATCH[\s\S]{0,3000}/)?.[0] ?? ''
  const occurrences = (patchBlock.match(/\.eq\('user_id', ctx\.userId\)/g) ?? []).length
  assert.ok(
    occurrences >= 2,
    `PATCH route user_id filtresi yalnızca ${occurrences} yerde — hem status check hem update'te olmalı`
  )
})

test('[id] DELETE: user_id filtresi var', () => {
  const content = read(ID_ROUTE)
  const deleteBlock = content.match(/async function DELETE[\s\S]{0,600}/)?.[0] ?? ''
  assert.ok(
    deleteBlock.includes(".eq('user_id', ctx.userId)"),
    'DELETE /api/audiences/[id] user_id filtresi eksik'
  )
})

/* ── Route: POST /api/audiences/sync ── */

console.log('\n▶ Route: /api/audiences/sync')

test('sync POST: user_id filtresi var', () => {
  const content = read('app/api/audiences/sync/route.ts')
  assert.ok(
    content.includes(".eq('user_id', ctx.userId)"),
    'POST /api/audiences/sync user_id filtresi eksik'
  )
})

/* ── Route: POST /api/audiences/[id]/create ── */

console.log('\n▶ Route: /api/audiences/[id]/create (meta-create + seed güvenliği)')

const CREATE_ROUTE = 'app/api/audiences/[id]/create/route.ts'

test('meta-create: ana audience fetch user_id filtreli', () => {
  const content = read(CREATE_ROUTE)
  // İlk .eq('id', id) bloğu — audience kendi kullanıcıya ait mi?
  const fetchBlock = content.match(/Fetch audience from DB[\s\S]{0,400}/)?.[0] ?? ''
  assert.ok(
    fetchBlock.includes(".eq('user_id', ctx.userId)"),
    'meta-create ana audience fetch user_id filtresi eksik'
  )
})

test('lookalike seed lookup: user_id cross-user engeli var', () => {
  const content = read(CREATE_ROUTE)
  // seedRow lookup bloğu
  const seedBlock = content.match(/seedAudienceId bir YoAi UUID[\s\S]{0,400}/)?.[0] ?? ''
  assert.ok(
    seedBlock.includes(".eq('user_id', ctx.userId)"),
    'Lookalike seed lookup user_id filtresi eksik — cross-user seed erişimi mümkün!'
  )
})

test('lookalike seed lookup: ad_account_id cross-account engeli var', () => {
  const content = read(CREATE_ROUTE)
  const seedBlock = content.match(/seedAudienceId bir YoAi UUID[\s\S]{0,400}/)?.[0] ?? ''
  assert.ok(
    seedBlock.includes(".eq('ad_account_id', ctx.accountId)"),
    'Lookalike seed lookup ad_account_id filtresi eksik'
  )
})

/* ── Orphan güvenliği ── */

console.log('\n▶ Orphan güvenliği — NULL user_id fallback yok')

const AUDIENCE_ROUTES = [
  'app/api/audiences/route.ts',
  'app/api/audiences/[id]/route.ts',
  'app/api/audiences/[id]/create/route.ts',
  'app/api/audiences/sync/route.ts',
]

test('hiçbir route user_id IS NULL fallback içermiyor', () => {
  const violators: string[] = []
  for (const rel of AUDIENCE_ROUTES) {
    const content = read(rel)
    if (content.includes('user_id IS NULL') || content.includes("is('user_id', null)")) {
      violators.push(rel)
    }
  }
  assert.deepStrictEqual(
    violators,
    [],
    `Şu route'lar NULL user_id fallback içeriyor (orphan leak riski):\n  ${violators.join('\n  ')}`
  )
})

test('hiçbir route user_id .or() bypass içermiyor', () => {
  const violators: string[] = []
  for (const rel of AUDIENCE_ROUTES) {
    const content = read(rel)
    // .or('user_id.eq.X,user_id.is.null') gibi bypass pattern
    if (/\.or\(.*user_id/.test(content)) {
      violators.push(rel)
    }
  }
  assert.deepStrictEqual(
    violators,
    [],
    `Şu route'lar user_id .or() bypass içeriyor:\n  ${violators.join('\n  ')}`
  )
})

/* ── Runner ── */
void runAll()
