/**
 * Audience Faz 3 — Business Context Seed Prefill Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/audienceFaz3SeedPrefill.test.ts
 *
 * Statik dosya analizi:
 *   - Modal business-context endpoint'i çekiyor
 *   - seedHintsRef mevcut (race condition koruması)
 *   - description prefill useEffect + reset() içinde
 *   - Fetch hata durumunda sessiz fallback
 *   - Amber/yellow renk ihlali yok
 *   - Konum/ülke prefill YOK (Meta key formatı uyumsuz — doğru karar)
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

const MODAL = 'components/hedef-kitle/AudienceWizardModal.tsx'

console.log('🧪 Audience Faz 3 — Seed Prefill Tests\n')

/* ── Fetch ── */

console.log('▶ Business context fetch')

test('modal /api/audiences/business-context endpoint\'ini çekiyor', () => {
  const content = read(MODAL)
  assert.ok(
    content.includes('/api/audiences/business-context'),
    'business-context fetch çağrısı bulunamadı'
  )
})

test('fetch mount useEffect içinde (dependency array boş)', () => {
  const content = read(MODAL)
  // fetch çağrısını içeren useEffect'in bağımlılık dizisi boş olmalı
  const fetchBlock = content.match(/fetch\('\/api\/audiences\/business-context'\)[\s\S]{0,400}/)?.[0] ?? ''
  assert.ok(fetchBlock.length > 0, 'fetch bloğu bulunamadı')
  // boş dependency array ], []) pattern'i
  assert.ok(
    content.includes('}, [])') || content.includes('},\n  [])\n'),
    'fetch useEffect bağımlılık dizisi boş olmalı (mount-once)'
  )
})

test('fetch hata durumunda sessiz catch var (.catch(() => {}))', () => {
  const content = read(MODAL)
  assert.ok(
    content.includes('.catch(() => {})'),
    'fetch hata durumu için sessiz catch bulunamadı — UI çökmemeli'
  )
})

/* ── seedHintsRef ── */

console.log('\n▶ seedHintsRef — race condition koruması')

test('useRef import edilmiş', () => {
  const content = read(MODAL)
  assert.ok(content.includes('useRef'), 'useRef import edilmemiş')
})

test('seedHintsRef tanımlı', () => {
  const content = read(MODAL)
  assert.ok(content.includes('seedHintsRef'), 'seedHintsRef bulunamadı')
})

test('seedHintsRef BizSeedHints tipinde', () => {
  const content = read(MODAL)
  assert.ok(
    content.includes('BizSeedHints'),
    'BizSeedHints interface bulunamadı'
  )
})

test('BizSeedHints: declaredTargetAudience alanı var', () => {
  const content = read(MODAL)
  assert.ok(
    content.includes('declaredTargetAudience'),
    'BizSeedHints declaredTargetAudience alanı eksik'
  )
})

test('BizSeedHints: sectorLabel alanı var', () => {
  const content = read(MODAL)
  assert.ok(content.includes('sectorLabel'), 'BizSeedHints sectorLabel alanı eksik')
})

/* ── Description prefill ── */

console.log('\n▶ Description prefill — isOpen + reset()')

test('useEffect(isOpen): description prefill seedHintsRef\'ten alınıyor', () => {
  const content = read(MODAL)
  assert.ok(
    content.includes("seedHintsRef.current?.declaredTargetAudience?.trim() ?? ''"),
    'description prefill ifadesi bulunamadı'
  )
})

test('useEffect(isOpen): customState description prefill edilmiş', () => {
  const content = read(MODAL)
  const openBlock = content.match(/When modal opens[\s\S]{0,600}/)?.[0] ?? ''
  assert.ok(
    openBlock.includes('initialCustomAudienceState, description: desc'),
    'customState description prefill useEffect içinde bulunamadı'
  )
})

test('useEffect(isOpen): lookalikeState description prefill edilmiş', () => {
  const content = read(MODAL)
  const openBlock = content.match(/When modal opens[\s\S]{0,600}/)?.[0] ?? ''
  assert.ok(
    openBlock.includes('initialLookalikeState, description: desc'),
    'lookalikeState description prefill useEffect içinde bulunamadı'
  )
})

test('useEffect(isOpen): savedState description prefill edilmiş', () => {
  const content = read(MODAL)
  const openBlock = content.match(/When modal opens[\s\S]{0,600}/)?.[0] ?? ''
  assert.ok(
    openBlock.includes('initialSavedAudienceState, description: desc'),
    'savedState description prefill useEffect içinde bulunamadı'
  )
})

test('reset(): description prefill seedHintsRef\'ten alınıyor', () => {
  const content = read(MODAL)
  const resetBlock = content.match(/const reset = useCallback[\s\S]{0,600}/)?.[0] ?? ''
  assert.ok(
    resetBlock.includes("seedHintsRef.current?.declaredTargetAudience?.trim() ?? ''"),
    'reset() içinde description prefill bulunamadı'
  )
})

test('reset(): 3 wizard state description prefill ile başlatılıyor', () => {
  const content = read(MODAL)
  const resetBlock = content.match(/const reset = useCallback[\s\S]{0,600}/)?.[0] ?? ''
  const hasCustom = resetBlock.includes('initialCustomAudienceState, description: desc')
  const hasLookalike = resetBlock.includes('initialLookalikeState, description: desc')
  const hasSaved = resetBlock.includes('initialSavedAudienceState, description: desc')
  assert.ok(
    hasCustom && hasLookalike && hasSaved,
    `reset() prefill eksik — custom:${hasCustom} lookalike:${hasLookalike} saved:${hasSaved}`
  )
})

/* ── Güvenli sınır: locations/countries prefill YOK ── */

console.log('\n▶ Güvenli sınır — Meta key gerektiren alanlar prefill edilmiyor')

test('locations prefill YOK (Meta location key formatı gerektiriyor)', () => {
  const content = read(MODAL)
  // seedHintsRef.current içinde locations assign edilmemeli
  const seedBlock = content.match(/seedHintsRef\.current\s*=[\s\S]{0,300}/)?.[0] ?? ''
  assert.ok(
    !seedBlock.includes('locations'),
    'seedHintsRef içinde locations prefill mevcut — Meta key formatı uyumsuz olabilir'
  )
})

test('countries prefill YOK (ISO kod eşleme yapılmıyor)', () => {
  const content = read(MODAL)
  const seedBlock = content.match(/seedHintsRef\.current\s*=[\s\S]{0,300}/)?.[0] ?? ''
  assert.ok(
    !seedBlock.includes('countries'),
    'seedHintsRef içinde countries prefill mevcut — ISO eşleme riski'
  )
})

/* ── businessContextLoaded guard ── */

console.log('\n▶ Guard — businessContextLoaded false ise prefill yapılmıyor')

test('fetch sonrası businessContextLoaded kontrolü var', () => {
  const content = read(MODAL)
  assert.ok(
    content.includes('businessContextLoaded'),
    'businessContextLoaded guard bulunamadı — yüklenmemiş context prefill\'e neden olabilir'
  )
})

/* ── Renk kuralı ── */

console.log('\n▶ Renk ihlali — amber/yellow yasak')

test('modal dosyasında amber-* sınıfı yok', () => {
  const content = read(MODAL)
  assert.ok(!/\bamber-\w+/.test(content), 'amber-* sınıfı mevcut (CLAUDE.md kuralı ihlali)')
})

test('modal dosyasında yellow-* sınıfı yok', () => {
  const content = read(MODAL)
  assert.ok(!/\byellow-\w+/.test(content), 'yellow-* sınıfı mevcut (CLAUDE.md kuralı ihlali)')
})

/* ── Runner ── */
void runAll()
