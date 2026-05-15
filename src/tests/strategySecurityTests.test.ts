/**
 * Strategy Güvenlik Testleri — Faz 1+2 Final Blocker Fix
 *
 * Çalıştırma:
 *   npx tsx src/tests/strategySecurityTests.test.ts
 *
 * Statik kod analizi:
 *   - GET /api/strategy/instances: user_id filtresi
 *   - POST /api/strategy/instances: owner bypass + normal user kontrolleri
 *   - Cross-user kayıt izolasyonu
 *   - Migration: user_id kolonu, RLS policies, deduct_strategy_credit RPC
 *   - strategy_tasks category check: optimization dahil
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
  console.log(`Sonuçlar: ${passed} geçti, ${failed} başarısız`)
  if (failed > 0) process.exit(1)
}

const ROOT = path.resolve(__dirname, '../../')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}

const INSTANCES_ROUTE = 'app/api/strategy/instances/route.ts'
const MIGRATION = 'supabase/migrations/20260516000000_strategy_user_id_rls.sql'

// ─────────────────────────────────────────────────────────────
// Migration — yapısal doğrulama
// ─────────────────────────────────────────────────────────────
console.log('🧪 Strategy Güvenlik Testleri\n')
console.log('▶ Migration — user_id kolonu + RLS + RPC')

test('migration dosyası mevcut', () => {
  assert.ok(
    fs.existsSync(path.join(ROOT, MIGRATION)),
    `Migration dosyası bulunamadı: ${MIGRATION}`
  )
})

test('strategy_instances user_id TEXT kolonu ekleniyor', () => {
  const sql = read(MIGRATION)
  assert.ok(
    sql.includes('ADD COLUMN IF NOT EXISTS user_id TEXT'),
    'user_id TEXT kolonu ekleme ifadesi eksik'
  )
})

test('strategy_instances user_id index ekleniyor', () => {
  const sql = read(MIGRATION)
  assert.ok(
    sql.includes('idx_si_user_id'),
    'user_id index eksik'
  )
})

test('strategy_instances SELECT policy mevcut', () => {
  const sql = read(MIGRATION)
  assert.ok(
    sql.includes('"strategy_instances_select_own"'),
    'strategy_instances SELECT RLS policy eksik'
  )
})

test('strategy_instances INSERT policy mevcut', () => {
  const sql = read(MIGRATION)
  assert.ok(
    sql.includes('"strategy_instances_insert_own"'),
    'strategy_instances INSERT RLS policy eksik'
  )
})

test('strategy_inputs child table RLS policy mevcut', () => {
  const sql = read(MIGRATION)
  assert.ok(
    sql.includes('"strategy_inputs_select_own"'),
    'strategy_inputs SELECT RLS policy eksik'
  )
})

test('sync_jobs child table RLS policy mevcut', () => {
  const sql = read(MIGRATION)
  assert.ok(
    sql.includes('"sync_jobs_select_own"'),
    'sync_jobs SELECT RLS policy eksik'
  )
})

test('metrics_snapshots child table RLS policy mevcut', () => {
  const sql = read(MIGRATION)
  assert.ok(
    sql.includes('"metrics_snapshots_select_own"'),
    'metrics_snapshots SELECT RLS policy eksik'
  )
})

test('deduct_strategy_credit RPC fonksiyonu mevcut', () => {
  const sql = read(MIGRATION)
  assert.ok(
    sql.includes('CREATE OR REPLACE FUNCTION public.deduct_strategy_credit'),
    'deduct_strategy_credit RPC fonksiyonu eksik'
  )
})

test('RPC SECURITY DEFINER ile tanımlı', () => {
  const sql = read(MIGRATION)
  assert.ok(
    sql.includes('SECURITY DEFINER'),
    'deduct_strategy_credit SECURITY DEFINER ile tanımlı değil'
  )
})

test('RPC balance >= p_cost guard içeriyor', () => {
  const sql = read(MIGRATION)
  assert.ok(
    sql.includes('AND balance  >= p_cost') || sql.includes('AND balance >= p_cost'),
    'deduct_strategy_credit atomik guard eksik: balance >= p_cost'
  )
})

test('strategy_tasks category constraint optimization içeriyor', () => {
  const sql = read(MIGRATION)
  assert.ok(
    sql.includes("'optimization'"),
    "strategy_tasks category CHECK constraint 'optimization' içermiyor"
  )
})

test('child table policy EXISTS JOIN ile strategy_instances user_id kontrol ediyor', () => {
  const sql = read(MIGRATION)
  const existsCount = (sql.match(/EXISTS \(\s*SELECT 1 FROM public\.strategy_instances si/g) ?? []).length
  assert.ok(
    existsCount >= 5,
    `Child table EXISTS JOIN sayısı beklenenden az: ${existsCount} (en az 5 bekleniyor)`
  )
})

// ─────────────────────────────────────────────────────────────
// Route — GET /api/strategy/instances
// ─────────────────────────────────────────────────────────────
console.log('\n▶ GET /api/strategy/instances — user_id izolasyonu')

test('GET handler user_id filtresi içeriyor', () => {
  const content = read(INSTANCES_ROUTE)
  const getBlock = content.match(/async function GET[\s\S]{0,600}/)?.[0] ?? ''
  assert.ok(
    getBlock.includes(".eq('user_id', ctx.userId)"),
    'GET /api/strategy/instances user_id filtresi eksik — cross-user leak riski!'
  )
})

test('GET handler ad_account_id filtresi koruyor', () => {
  const content = read(INSTANCES_ROUTE)
  const getBlock = content.match(/async function GET[\s\S]{0,600}/)?.[0] ?? ''
  assert.ok(
    getBlock.includes(".eq('ad_account_id', ctx.accountId)"),
    'GET /api/strategy/instances ad_account_id filtresi kaldırılmış'
  )
})

test('GET handler hem ad_account_id hem user_id filtresiyle çift izolasyon sağlıyor', () => {
  const content = read(INSTANCES_ROUTE)
  const getBlock = content.match(/async function GET[\s\S]{0,600}/)?.[0] ?? ''
  const hasAccount = getBlock.includes(".eq('ad_account_id', ctx.accountId)")
  const hasUser = getBlock.includes(".eq('user_id', ctx.userId)")
  assert.ok(
    hasAccount && hasUser,
    `GET double-filter eksik: ad_account_id=${hasAccount}, user_id=${hasUser}`
  )
})

// ─────────────────────────────────────────────────────────────
// Route — POST /api/strategy/instances — Owner bypass
// ─────────────────────────────────────────────────────────────
console.log('\n▶ POST /api/strategy/instances — Owner bypass')

test('SUPER_ADMIN_EMAILS sabiti tanımlı ve onursuay@hotmail.com içeriyor', () => {
  const content = read(INSTANCES_ROUTE)
  assert.ok(
    content.includes('SUPER_ADMIN_EMAILS'),
    'SUPER_ADMIN_EMAILS sabiti tanımlı değil'
  )
  assert.ok(
    content.includes('onursuay@hotmail.com'),
    'onursuay@hotmail.com SUPER_ADMIN_EMAILS listesinde değil'
  )
})

test('isOwner fonksiyonu DB üzerinden signups tablosunu sorgular', () => {
  const content = read(INSTANCES_ROUTE)
  const ownerBlock = content.match(/async function isOwner[\s\S]{0,300}/)?.[0] ?? ''
  assert.ok(
    ownerBlock.includes("from('signups')"),
    'isOwner fonksiyonu signups tablosunu sorgulamıyor'
  )
})

test('isOwner email karşılaştırması case-insensitive (.toLowerCase())', () => {
  const content = read(INSTANCES_ROUTE)
  const ownerBlock = content.match(/async function isOwner[\s\S]{0,300}/)?.[0] ?? ''
  assert.ok(
    ownerBlock.includes('.toLowerCase()'),
    'isOwner email karşılaştırması case-insensitive değil'
  )
})

test('POST handler ownerMode kontrolü yapıyor', () => {
  const content = read(INSTANCES_ROUTE)
  assert.ok(
    content.includes('const ownerMode = await isOwner(userId)'),
    'POST handler ownerMode kontrolü eksik'
  )
})

test('plan limiti owner bypass ile atlanıyor (!ownerMode bloğu içinde)', () => {
  const content = read(INSTANCES_ROUTE)
  const postBlock = content.match(/export async function POST[\s\S]*/)?.[0] ?? ''
  // if (!ownerMode) bloğunu yakala — kapanış parantezine kadar (en fazla 5000 karakter)
  const ownerBypassBlock = postBlock.match(/if \(!ownerMode\) \{[\s\S]{0,5000}/)?.[0] ?? ''
  assert.ok(
    ownerBypassBlock.includes('resolveMonthlyStrategyLimit'),
    'resolveMonthlyStrategyLimit owner bypass bloğu dışına çıkmış'
  )
})

test('kredi kontrolü owner bypass ile atlanıyor (!ownerMode bloğu içinde)', () => {
  const content = read(INSTANCES_ROUTE)
  const postBlock = content.match(/export async function POST[\s\S]*/)?.[0] ?? ''
  const ownerBypassBlock = postBlock.match(/if \(!ownerMode\) \{[\s\S]{0,5000}/)?.[0] ?? ''
  assert.ok(
    ownerBypassBlock.includes('deduct_strategy_credit'),
    'deduct_strategy_credit (kredi düşme RPC) owner bypass bloğu dışına çıkmış'
  )
})

test('kredi düşme RPC owner bypass ile atlanıyor (!ownerMode bloğu içinde)', () => {
  const content = read(INSTANCES_ROUTE)
  const postBlock = content.match(/export async function POST[\s\S]*/)?.[0] ?? ''
  const ownerBypassBlock = postBlock.match(/if \(!ownerMode\) \{[\s\S]{0,5000}/)?.[0] ?? ''
  assert.ok(
    ownerBypassBlock.includes("rpc('deduct_strategy_credit'"),
    "supabase.rpc('deduct_strategy_credit') owner bypass bloğu dışına çıkmış"
  )
})

// ─────────────────────────────────────────────────────────────
// Route — POST — Normal kullanıcı kontrolleri
// ─────────────────────────────────────────────────────────────
console.log('\n▶ POST /api/strategy/instances — Normal kullanıcı güvenlik kontrolleri')

test('normal kullanıcı için plan_limit 403 dönüyor', () => {
  const content = read(INSTANCES_ROUTE)
  assert.ok(
    content.includes("error: 'plan_limit'"),
    "plan_limit 403 response eksik"
  )
})

test('normal kullanıcı için monthly_limit_reached 429 dönüyor', () => {
  const content = read(INSTANCES_ROUTE)
  assert.ok(
    content.includes("error: 'monthly_limit_reached'"),
    "monthly_limit_reached 429 response eksik"
  )
})

test('normal kullanıcı için insufficient_credits 402 dönüyor', () => {
  const content = read(INSTANCES_ROUTE)
  assert.ok(
    content.includes("error: 'insufficient_credits'"),
    "insufficient_credits 402 response eksik"
  )
})

test('aylık limit sayımı user_id ile filtreleniyor (cross-count leak yok)', () => {
  const content = read(INSTANCES_ROUTE)
  const countBlock = content.match(/count.*exact[\s\S]{0,300}/)?.[0] ?? ''
  assert.ok(
    countBlock.includes(".eq('user_id', userId)"),
    'Aylık limit sayımında user_id filtresi eksik — başka kullanıcı sayısı dahil edilebilir'
  )
})

test('POST user_id INSERT row\'ına yazılıyor', () => {
  const content = read(INSTANCES_ROUTE)
  const rowBlock = content.match(/const row = \{[\s\S]{0,400}/)?.[0] ?? ''
  assert.ok(
    rowBlock.includes('user_id: userId'),
    "INSERT row'unda user_id: userId eksik — yeni kayıt izolasyon kolonu olmadan oluşuyor"
  )
})

// ─────────────────────────────────────────────────────────────
// Cross-user izolasyon — hiçbir orphan / bypass yok
// ─────────────────────────────────────────────────────────────
console.log('\n▶ Cross-user izolasyon — orphan/bypass koruması')

test('GET handler NULL user_id fallback içermiyor', () => {
  const content = read(INSTANCES_ROUTE)
  const getBlock = content.match(/async function GET[\s\S]{0,600}/)?.[0] ?? ''
  assert.ok(
    !getBlock.includes('user_id IS NULL') && !getBlock.includes("is('user_id', null)"),
    'GET handler NULL user_id fallback içeriyor — orphan leak riski'
  )
})

test('GET handler .or() user_id bypass içermiyor', () => {
  const content = read(INSTANCES_ROUTE)
  const getBlock = content.match(/async function GET[\s\S]{0,600}/)?.[0] ?? ''
  assert.ok(
    !/\.or\(.*user_id/.test(getBlock),
    'GET handler .or(user_id...) bypass içeriyor'
  )
})

/* ── Runner ── */
void runAll()
