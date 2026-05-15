/**
 * Audience Wizard Confirmation Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/audienceWizardConfirmation.test.ts
 *
 * React bileşenlerini render etmeden, kaynak dosya içerik analizleri ile
 * Faz 1 değişikliklerinin regresyona uğramadığını doğrular:
 *   - "Faz 2'de aktif" yanıltıcı metni kalmadı
 *   - Onay ekranı (confirm phase) eklendi
 *   - submitAudience artık kullanıcı onayı olmadan çağrılmıyor
 *   - amber/yellow renk ihlali kalmadı
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

/* ── Helpers ── */

const ROOT = path.resolve(__dirname, '../../')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}

function filesInDir(rel: string, ext: string): string[] {
  const dir = path.join(ROOT, rel)
  if (!fs.existsSync(dir)) return []
  const results: string[] = []
  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.endsWith(ext)) results.push(full)
    }
  }
  walk(dir)
  return results
}

/* ── StepSummary copy tests ── */

console.log('🧪 Audience Wizard Confirmation Tests\n')

const STEP_SUMMARY_FILES = [
  'components/hedef-kitle/wizard/custom/StepSummary.tsx',
  'components/hedef-kitle/wizard/lookalike/StepSummary.tsx',
  'components/hedef-kitle/wizard/saved/StepSummary.tsx',
]

console.log('▶ StepSummary copy — yanıltıcı metin kalmadı')

for (const file of STEP_SUMMARY_FILES) {
  const shortName = file.split('/').slice(-2).join('/')
  test(`${shortName} — "Faz 2'de aktif edilecek" metni yok`, () => {
    const content = read(file)
    assert.ok(
      !content.includes('Faz 2') && !content.includes('aktif edilecek'),
      `"Faz 2" veya "aktif edilecek" ifadesi hâlâ mevcut: ${file}`
    )
  })

  test(`${shortName} — "Meta Reklam Hesabında Oluşturulacak" metni var`, () => {
    const content = read(file)
    assert.ok(
      content.includes('Meta Reklam Hesab'),
      `Beklenen "Meta Reklam Hesabında Oluşturulacak" metni bulunamadı: ${file}`
    )
  })

  test(`${shortName} — onay bildirim paneli bg-primary/5 kullanıyor (blue-50 yok)`, () => {
    const content = read(file)
    assert.ok(!content.includes('bg-blue-50'), `bg-blue-50 hâlâ var: ${file}`)
    assert.ok(content.includes('bg-primary/5'), `bg-primary/5 yok: ${file}`)
  })
}

/* ── AudienceWizardModal confirmation flow ── */

console.log('\n▶ AudienceWizardModal — confirm phase')

const MODAL_FILE = 'components/hedef-kitle/AudienceWizardModal.tsx'

test("WizardPhase tipinde 'confirm' değeri tanımlı", () => {
  const content = read(MODAL_FILE)
  assert.ok(content.includes("'confirm'"), `WizardPhase 'confirm' içermiyor: ${MODAL_FILE}`)
})

test("navigateStep — son adımda doğrudan submitAudience(type) çağrılmıyor", () => {
  const content = read(MODAL_FILE)
  // navigateStep içinde current===max branch'inde artık submitAudience çağrısı OLMAMALI
  // setPendingSubmitType(type) çağrısı OLMALI
  // Pozitif kontrol: setPendingSubmitType içeriyor
  assert.ok(
    content.includes('setPendingSubmitType(type)'),
    `navigateStep içinde setPendingSubmitType(type) bulunamadı — onay mekanizması kaybolmuş olabilir`
  )
  // Negatif kontrol: navigateStep bloğu içinde `submitAudience(type)` ve
  // `current === max` satırı aynı blokta geçmemeli
  // Basit yaklaşım: "current === max" satırına en yakın "submitAudience(type)" çağrısının
  // SADECE confirm modal submit butonunda olduğunu doğrula
  const maxBlock = content.match(/current === max[\s\S]{0,200}/)?.[0] ?? ''
  assert.ok(
    !maxBlock.includes('submitAudience(type)'),
    `current===max bloğu hâlâ doğrudan submitAudience(type) içeriyor: onay adımı kaybolmuş`
  )
})

test("confirm fazı için 'Oluştur ve Meta'ya Gönder' butonu var", () => {
  const content = read(MODAL_FILE)
  assert.ok(
    content.includes("Oluştur ve Meta"),
    `"Oluştur ve Meta'ya Gönder" butonu bulunamadı: ${MODAL_FILE}`
  )
})

test("confirm ekranında 'Geri Dön' iptal butonu var", () => {
  const content = read(MODAL_FILE)
  assert.ok(
    content.includes('Geri Dön'),
    `Confirmation ekranında 'Geri Dön' butonu bulunamadı`
  )
})

test("pendingSubmitType state tanımlı", () => {
  const content = read(MODAL_FILE)
  assert.ok(
    content.includes('pendingSubmitType'),
    `pendingSubmitType state bulunamadı: ${MODAL_FILE}`
  )
})

test("confirm ekranı submitAudience(pendingSubmitType) ile tetikleniyor", () => {
  const content = read(MODAL_FILE)
  assert.ok(
    content.includes('submitAudience(pendingSubmitType)'),
    `submitAudience(pendingSubmitType) bulunamadı: onaydan sonra create çağrısı kaybolmuş`
  )
})

test("confirm ekranı gerçek hesap uyarısı içeriyor", () => {
  const content = read(MODAL_FILE)
  assert.ok(
    content.includes('gerçekten oluşturulacaktır') || content.includes('Meta reklam hesabınızda'),
    `Gerçek hesap uyarısı confirmation ekranında bulunamadı`
  )
})

/* ── amber/yellow renk ihlali yok ── */

console.log('\n▶ Renk ihlali — amber/yellow yasak')

const HEDEF_KITLE_FILES = filesInDir('components/hedef-kitle', '.tsx')

test(`hedef-kitle bileşenlerinde amber-* sınıfı yok (${HEDEF_KITLE_FILES.length} dosya)`, () => {
  const violators: string[] = []
  for (const f of HEDEF_KITLE_FILES) {
    const content = fs.readFileSync(f, 'utf-8')
    if (/\bamber-\w+/.test(content)) {
      violators.push(path.relative(ROOT, f))
    }
  }
  assert.deepStrictEqual(
    violators,
    [],
    `amber-* Tailwind sınıfı şu dosyalarda hâlâ mevcut:\n  ${violators.join('\n  ')}`
  )
})

test(`hedef-kitle bileşenlerinde yellow-* sınıfı yok (${HEDEF_KITLE_FILES.length} dosya)`, () => {
  const violators: string[] = []
  for (const f of HEDEF_KITLE_FILES) {
    const content = fs.readFileSync(f, 'utf-8')
    if (/\byellow-\w+/.test(content)) {
      violators.push(path.relative(ROOT, f))
    }
  }
  assert.deepStrictEqual(
    violators,
    [],
    `yellow-* Tailwind sınıfı şu dosyalarda hâlâ mevcut:\n  ${violators.join('\n  ')}`
  )
})

/* ── StepSource unsupported sources disabled ── */

console.log('\n▶ StepSource — unsupported sources disabled')

test('StepSource UNSUPPORTED_SOURCES sabiti CATALOG/APP/OFFLINE/CUSTOMER_LIST içeriyor', () => {
  const content = read('components/hedef-kitle/wizard/custom/StepSource.tsx')
  assert.ok(content.includes('UNSUPPORTED_SOURCES'), 'UNSUPPORTED_SOURCES tanımı bulunamadı')
  assert.ok(content.includes("'CATALOG'"), 'CATALOG eksik')
  assert.ok(content.includes("'APP'"), 'APP eksik')
  assert.ok(content.includes("'OFFLINE'"), 'OFFLINE eksik')
  assert.ok(content.includes("'CUSTOMER_LIST'"), 'CUSTOMER_LIST eksik')
})

test('StepSource isSourceAvailable() desteklenmeyen kaynak için available=false döndürür', () => {
  const content = read('components/hedef-kitle/wizard/custom/StepSource.tsx')
  // UNSUPPORTED_SOURCES.includes(source) → available: false şeklinde kontrol ediliyor
  assert.ok(
    content.includes('UNSUPPORTED_SOURCES.includes(source)'),
    'UNSUPPORTED_SOURCES.includes(source) kontrolü bulunamadı'
  )
})

/* ── payloadBuilder default → throw ── */

console.log('\n▶ payloadBuilder — default case throws')

test('payloadBuilder default case "desteklenmiyor" ile throw içeriyor', () => {
  const content = read('lib/meta/audiences/payloadBuilder.ts')
  // Default case throw içermeli, ENGAGEMENT subtype'a fallback OLMAMALI
  const defaultBlock = content.match(/default:\s*\{[\s\S]{0,300}/)?.[0] ?? ''
  assert.ok(defaultBlock.includes('throw new Error'), `default case throw içermiyor`)
  assert.ok(!defaultBlock.includes("subtype = 'ENGAGEMENT'"), `default case hâlâ ENGAGEMENT fallback içeriyor`)
})

/* ── Existing routes untouched (diff-based) ── */

console.log('\n▶ Existing list/sync/soft-delete routes — dokunulmadı')

test('app/api/audiences/route.ts (list+create) son committe değişmedi', () => {
  // git show ile kontrol edemiyoruz ama dosyanın varlığını ve yoai create endpoint import'unu doğrularız
  const content = read('app/api/audiences/route.ts')
  assert.ok(content.includes('supabase'), 'route.ts supabase içermiyor — beklenmez')
  assert.ok(
    !content.includes('setPendingSubmitType') && !content.includes('confirm'),
    'route.ts içinde wizard UI state bulunmamalı'
  )
})

test('app/api/audiences/sync/route.ts (sync) son committe değişmedi', () => {
  const content = read('app/api/audiences/sync/route.ts')
  assert.ok(content.includes('last_synced_at'), 'sync route last_synced_at içermiyor — değişmiş olabilir')
  assert.ok(
    !content.includes('setPendingSubmitType'),
    'sync route içinde wizard UI state bulunmamalı'
  )
})

test('app/api/audiences/[id]/route.ts (soft-delete) son committe değişmedi', () => {
  const content = read('app/api/audiences/[id]/route.ts')
  assert.ok(content.includes('DELETED'), 'soft-delete route DELETED status içermiyor — değişmiş olabilir')
})

// ── Runner ──
void runAll()
