/**
 * Credit Required Modal — Source-level Unit Tests
 *
 * Bu testler bir DOM render harness'i (jsdom) gerektirmediği için,
 * davranış garantileri component kaynağı + ilgili route/page kaynağı
 * üzerinde statik metin denetimleriyle koruma altına alınır.
 *
 * Çalıştırma:
 *   npx tsx src/tests/creditRequiredModal.test.ts
 */

import assert from 'assert'
import fs from 'node:fs'
import path from 'node:path'

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

const repoRoot = path.join(__dirname, '..', '..')
const modalFile = path.join(repoRoot, 'components', 'billing', 'CreditRequiredModal.tsx')
const optimizasyonPage = path.join(repoRoot, 'app', 'optimizasyon', 'page.tsx')
const billingCurrent = path.join(repoRoot, 'app', 'api', 'billing', 'current', 'route.ts')
const serverGuard = path.join(repoRoot, 'lib', 'meta', 'optimization', 'serverGuard.ts')
const claudeMd = path.join(repoRoot, 'CLAUDE.md')

const modalSrc = fs.readFileSync(modalFile, 'utf-8')
const pageSrc = fs.readFileSync(optimizasyonPage, 'utf-8')
const billingSrc = fs.readFileSync(billingCurrent, 'utf-8')
const guardSrc = fs.readFileSync(serverGuard, 'utf-8')
const claudeSrc = fs.readFileSync(claudeMd, 'utf-8')

// ── 1. Component contract ─────────────────────────────────────────
console.log('\n[1] CreditRequiredModal davranışı')

test('component dosyası mevcut', () => {
  assert.ok(fs.existsSync(modalFile), 'CreditRequiredModal.tsx eksik')
})

test('kapatma X butonu yok', () => {
  assert.ok(
    !/<X[\s/]/i.test(modalSrc) && !/aria-label="Close"/i.test(modalSrc),
    'Modal kapatma butonu içermemeli (X yok)',
  )
})

test('ESC tuşu yutuluyor', () => {
  assert.ok(
    /key === 'Escape'/.test(modalSrc) && /preventDefault\(\)/.test(modalSrc),
    'ESC kapanmasını engelleyen handler bulunmuyor',
  )
})

test('dış tıklama kapatmıyor (backdrop preventDefault)', () => {
  assert.ok(
    /onClick=\{\s*\(e\)\s*=>\s*\{[\s\S]*?preventDefault\(\)[\s\S]*?stopPropagation/.test(
      modalSrc,
    ),
    'Backdrop onClick yutmuyor (preventDefault+stopPropagation eksik)',
  )
})

test('blur backdrop mevcut', () => {
  assert.ok(
    /backdrop-blur-md/.test(modalSrc) && /bg-black\/50/.test(modalSrc),
    'Blur arkalık (backdrop-blur-md + bg-black/50) yok',
  )
})

test('CTA buton mevcut ve ROUTES.SUBSCRIPTION/abonelik\'e gidiyor', () => {
  assert.ok(
    /ROUTES\.SUBSCRIPTION/.test(modalSrc),
    'CTA hedefi ROUTES.SUBSCRIPTION değil',
  )
})

test('body scroll lock var', () => {
  assert.ok(
    /document\.body\.style\.overflow\s*=\s*'hidden'/.test(modalSrc),
    'Body scroll lock yok',
  )
})

test('amber/yellow renk kuralı ihlali yok', () => {
  assert.ok(
    !/bg-amber-|text-amber-|border-amber-|bg-yellow-|text-yellow-|border-yellow-/.test(
      modalSrc,
    ),
    'Modal amber/yellow ton içeriyor — CLAUDE.md renk kuralı ihlali',
  )
})

// ── 2. /optimizasyon entegrasyonu ──────────────────────────────────
console.log('\n[2] /optimizasyon entegrasyonu')

test('CreditRequiredModal import edildi', () => {
  assert.ok(
    /from\s+'@\/components\/billing\/CreditRequiredModal'/.test(pageSrc),
    'page.tsx CreditRequiredModal import etmiyor',
  )
})

test('403 response için accessDenied state set ediliyor', () => {
  assert.ok(
    /response\.status\s*===\s*403/.test(pageSrc) &&
      /setAccessDenied\(true\)/.test(pageSrc),
    '403 dalında setAccessDenied(true) çağrılmıyor',
  )
})

test('accessDenied açıkken modal render ediliyor', () => {
  assert.ok(
    /accessDenied\s*&&\s*\([\s\S]*?CreditRequiredModal/.test(pageSrc),
    'accessDenied bayrağı modal render etmiyor',
  )
})

test('accessDenied açıkken inline error bastırılıyor', () => {
  assert.ok(
    /!accessDenied\s*&&\s*error\s*&&/.test(pageSrc),
    'Inline error state accessDenied ile gating yapılmıyor',
  )
})

// ── 3. Owner bypass (UI tarafı: /api/billing/current) ──────────────
console.log('\n[3] Owner bypass — /api/billing/current')

test('isSuperAdminEmail import edildi', () => {
  assert.ok(
    /from\s+'@\/lib\/admin\/superAdmin'/.test(billingSrc),
    'billing/current isSuperAdminEmail import etmiyor',
  )
})

test('owner için enterprise/active subscription stub döndürülüyor', () => {
  assert.ok(
    /isSuperAdminEmail\(user\.email\)/.test(billingSrc) &&
      /planId:\s*'enterprise'/.test(billingSrc) &&
      /status:\s*'active'/.test(billingSrc),
    'Owner bypass dalı enterprise/active stub döndürmüyor',
  )
})

// ── 4. Backend guard güvenliği korunuyor ───────────────────────────
console.log('\n[4] Backend guard güvenliği')

test('requireOptimizationAccess hâlâ unauthenticated 401 üretiyor', () => {
  assert.ok(
    /deny\(401,\s*'unauthenticated'/.test(guardSrc),
    'serverGuard 401 unauthenticated dalı bozulmuş',
  )
})

test('requireOptimizationAccess hâlâ 403 no_subscription üretiyor', () => {
  assert.ok(
    /deny\(403,\s*'no_subscription'/.test(guardSrc),
    'serverGuard 403 no_subscription dalı bozulmuş',
  )
})

test('owner allowlist bypass dalı var', () => {
  assert.ok(
    /isSuperAdminEmail\(user\.email\)/.test(guardSrc) &&
      /planId:\s*'enterprise'/.test(guardSrc),
    'serverGuard owner bypass dalı eksik/değişmiş',
  )
})

// ── 5. CLAUDE.md kuralı ────────────────────────────────────────────
console.log('\n[5] CLAUDE.md proje kuralı')

test('CLAUDE.md credit modal kuralı içeriyor', () => {
  assert.ok(
    /CreditRequiredModal\.tsx/.test(claudeSrc) &&
      /düz inline hata mesajı gösterilmez/.test(claudeSrc),
    'CLAUDE.md yeni kural eklenmemiş',
  )
})

// ── Sonuç ──────────────────────────────────────────────────────────
setTimeout(() => {
  console.log(`\n  ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}, 50)
