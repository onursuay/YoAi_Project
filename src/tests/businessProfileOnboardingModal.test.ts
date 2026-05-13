/**
 * BusinessProfileOnboarding modal + Guard davranışı — statik kod testleri.
 *
 * Çalıştırma:
 *   npx tsx src/tests/businessProfileOnboardingModal.test.ts
 *
 * Bu test runtime DOM kurmaz; modal/guard sözleşmesini kaynak dosyalardan
 * doğrular. Yine de "popup kapanabilir mi", "onClose verildiğinde X butonu
 * görünür mü", "Guard kapatma sonrası kilit ekranı bırakıyor mu" gibi
 * regresyon noktalarını yakalar.
 */

import assert from 'assert'
import fs from 'node:fs'
import path from 'node:path'

let passed = 0
let failed = 0

function test(name: string, fn: () => void | Promise<void>): void {
  try {
    const r = fn()
    if (r instanceof Promise) {
      r.then(() => { console.log(`  ✓ ${name}`); passed++ }).catch((e) => {
        console.error(`  ✗ ${name}`)
        console.error(`    ${e instanceof Error ? e.message : e}`)
        failed++
      })
    } else {
      console.log(`  ✓ ${name}`)
      passed++
    }
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e instanceof Error ? e.message : e}`)
    failed++
  }
}

const onboardingFile = path.join(
  __dirname, '..', '..', 'components', 'yoai', 'BusinessProfileOnboarding.tsx'
)
const guardFile = path.join(
  __dirname, '..', '..', 'components', 'yoai', 'BusinessProfileGuard.tsx'
)
const onboardingSrc = fs.readFileSync(onboardingFile, 'utf-8')
const guardSrc = fs.readFileSync(guardFile, 'utf-8')

console.log('\n[1] Modal görsel sözleşmesi (radius / overflow / kapatma)')

test('modal container overflow-hidden uyguluyor (radius taşması engellendi)', () => {
  // Container <div className="bg-white w-full max-w-3xl rounded-..."> içinde
  // overflow-hidden geçmeli; aksi halde footer arka rengi köşelerden taşar.
  const containerLine = onboardingSrc
    .split('\n')
    .find((l) => l.includes('rounded-t-3xl') && l.includes('rounded-3xl'))
  assert.ok(containerLine, 'modal container satırı bulunamadı')
  assert.ok(
    (containerLine || '').includes('overflow-hidden'),
    'modal container overflow-hidden içermiyor — radius taşma riski',
  )
})

test('X butonu sadece isEditMode değil, onClose verildiğinde her zaman görünür', () => {
  // Eski davranış: {isEditMode && onClose && (...)} — bu kullanıcının modal'ı
  // kapatmasını engelliyordu. Yeni davranış: onClose verildiğinde X her zaman
  // görünür; onboarding tamamlanmasa bile modal kapatılabilir.
  assert.ok(
    !/isEditMode\s*&&\s*onClose\s*&&/.test(onboardingSrc),
    "eski 'isEditMode && onClose' koşulu hâlâ aktif",
  )
  assert.ok(
    /\{onClose\s*&&\s*\(/.test(onboardingSrc),
    'onClose tabanlı X buton koşulu eklenmemiş',
  )
})

test('ESC tuşu onClose verildiğinde modal\'ı kapatır', () => {
  assert.ok(onboardingSrc.includes("'Escape'"))
  assert.ok(onboardingSrc.includes('keydown'))
})

console.log('\n[2] Guard kapatma sonrası kilit davranışı')

test('Guard incomplete state\'inde kilit kart + buton render ediyor', () => {
  assert.ok(guardSrc.includes('kilidi açık değil'))
  assert.ok(guardSrc.includes('İşletme Profilini Tamamla'))
})

test('Guard kapatma için onClose her zaman geçiyor (silent dışı senaryolar dahil)', () => {
  // Eski: onClose={silent ? () => setShowOnboarding(false) : undefined}
  // Yeni: onClose={() => setShowOnboarding(false)}
  assert.ok(
    !/silent\s*\?\s*\(\)\s*=>\s*setShowOnboarding\(false\)\s*:\s*undefined/.test(guardSrc),
    "eski silent-bağlı onClose hâlâ var — kullanıcı modal'ı kapatamıyor",
  )
  assert.ok(
    /onClose=\{\(\)\s*=>\s*setShowOnboarding\(false\)\}/.test(guardSrc),
    'Guard onClose handler eklenmemiş',
  )
})

test('Guard onComplete dışında state \'completed\' set etmiyor (kilit by-pass yok)', () => {
  // setState('completed') sadece onComplete dalı içinde olmalı; kapatma X
  // veya silent dalı state\'i değiştirmemeli.
  const completeMatches = guardSrc.match(/setState\('completed'\)/g) || []
  // Sayfa load akışında bir tane var (refresh içinde) + onComplete'te bir tane.
  // Asıl önemli olan: onClose handler'ı içinde setState('completed') yok.
  const onCloseBlock = guardSrc.split('onClose={() => ')[1]?.split('}')[0] ?? ''
  assert.ok(
    !onCloseBlock.includes("setState('completed')"),
    'kapatma handler\'ı yanlışlıkla onboarding\'i tamamlanmış sayıyor',
  )
  assert.ok(completeMatches.length >= 1)
})

test('Modal ve Guard amber/yellow Tailwind class içermiyor', () => {
  for (const src of [onboardingSrc, guardSrc]) {
    assert.ok(!/bg-amber-|text-amber-|border-amber-/.test(src))
    assert.ok(!/bg-yellow-|text-yellow-|border-yellow-/.test(src))
  }
})

setTimeout(() => {
  console.log('')
  console.log(`Geçen: ${passed}`)
  console.log(`Kalan: ${failed}`)
  if (failed > 0) process.exit(1)
}, 250)
