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
  // Locked state başlığı: `{area} kilitli` (commit 7f08247'de redesign — eski
  // `kilidi açık değil` metni kaldırıldı). Lock ikonu + CTA korunur.
  assert.ok(
    /\{area\}\s+kilitli/.test(guardSrc),
    "Guard başlığı '{area} kilitli' formatında değil",
  )
  assert.ok(
    /<Lock\s/.test(guardSrc),
    'Guard incomplete state Lock ikonu içermiyor',
  )
  assert.ok(
    guardSrc.includes('İşletme Profilini Tamamla'),
    "Guard CTA 'İşletme Profilini Tamamla' butonu eksik",
  )
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

console.log('\n[3] Rakipler adımı validasyon sözleşmesi')

test('Rakipler adımı shared isValidCompetitorReference helper kullanıyor', () => {
  assert.ok(onboardingSrc.includes('isValidCompetitorReference'))
  assert.ok(onboardingSrc.includes('validCompetitorCount'))
  assert.ok(onboardingSrc.includes('MIN_COMPETITORS_REQUIRED'))
})

test('Rakip payload standard field adlarıyla filtreleniyor', () => {
  assert.ok(onboardingSrc.includes('competitors.filter(isValidCompetitorReference)'))
  assert.ok(!onboardingSrc.includes('competitor_website_url'))
})

test('Rakipler adımı tüm standart rakip kaynak alanlarını render ediyor', () => {
  for (const field of [
    'competitor_name',
    'website_url',
    'instagram_url',
    'facebook_url',
    'linkedin_url',
    'youtube_url',
    'tiktok_url',
    'google_business_url',
    'extra_url',
  ]) {
    assert.ok(onboardingSrc.includes(field), `${field} eksik`)
  }
})

test('Rakipler adımı net 3 rakip hata mesajını içeriyor', () => {
  assert.ok(onboardingSrc.includes('Devam etmek için en az'))
  assert.ok(onboardingSrc.includes('Her rakip için firma adı, web sitesi veya sosyal medya hesabından en az birini girmeniz yeterlidir.'))
})

console.log('\n[4] Business Profile dropdown sözleşmesi')

test('BusinessProfileOnboarding native select / option render etmiyor', () => {
  assert.ok(!/<select\b/.test(onboardingSrc), 'native <select> kalmış')
  assert.ok(!/<option\b/.test(onboardingSrc), 'native <option> kalmış')
})

test('Tüm Business Profile dropdown alanları custom BusinessProfileSelect kullanıyor', () => {
  const usages = onboardingSrc.match(/<BusinessProfileSelect\b/g) || []
  assert.ok(usages.length >= 5, `beklenen en az 5 custom dropdown, bulunan ${usages.length}`)
  assert.ok(onboardingSrc.includes('function BusinessProfileSelect'))
})

test('Custom dropdown native OS menüsü yerine listbox paneli kullanıyor', () => {
  assert.ok(onboardingSrc.includes('aria-haspopup="listbox"'))
  assert.ok(onboardingSrc.includes('role="listbox"'))
  assert.ok(onboardingSrc.includes('role="option"'))
  assert.ok(onboardingSrc.includes('z-[80]'))
  assert.ok(onboardingSrc.includes('max-h-64 overflow-y-auto'))
})

setTimeout(() => {
  console.log('')
  console.log(`Geçen: ${passed}`)
  console.log(`Kalan: ${failed}`)
  if (failed > 0) process.exit(1)
}, 250)
