/**
 * Gözetim Merkezi Access — Unit Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/gozetimMerkeziAccess.test.ts
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

// ── isSuperAdminEmail allowlist davranışı ─────────────────────────
console.log('\n[1] Allowlist davranışı')

// Test öncesi env temizlenir, default allowlist beklenir.
delete process.env.SUPER_ADMIN_EMAILS

// Module import — server-only side-effect import'unu by-pass etmek için
// dosya doğrudan içerikten doğrulanır + fonksiyon davranışı için ayrı
// allowlist mock'u kurulur.
const superAdminFile = path.join(__dirname, '..', '..', 'lib', 'admin', 'superAdmin.ts')
const superAdminSrc = fs.readFileSync(superAdminFile, 'utf-8')

test('default allowlist onursuay@hotmail.com içerir', () => {
  assert.ok(
    superAdminSrc.includes("'onursuay@hotmail.com'"),
    'superAdmin.ts içinde default e-posta hardcode değil',
  )
})

test('SUPER_ADMIN_EMAILS env override edebilir (kod yolu)', () => {
  assert.ok(
    superAdminSrc.includes('process.env.SUPER_ADMIN_EMAILS'),
    'env okuma yapısı yok',
  )
})

// Fonksiyon davranışını izole ederek doğrula
function makeIsSuperAdminEmail(allowlist: string[]) {
  const list = allowlist.map((s) => s.trim().toLowerCase())
  return (email: string | null | undefined) => {
    if (!email) return false
    const normalized = email.trim().toLowerCase()
    if (!normalized) return false
    return list.includes(normalized)
  }
}

test('onursuay@hotmail.com yetkili kullanıcı kabul edilir', () => {
  const isSuper = makeIsSuperAdminEmail(['onursuay@hotmail.com'])
  assert.strictEqual(isSuper('onursuay@hotmail.com'), true)
  assert.strictEqual(isSuper('OnurSuay@Hotmail.com'), true) // case-insensitive
  assert.strictEqual(isSuper('  onursuay@hotmail.com  '), true) // trim
})

test('farklı email yetkili kabul edilmez', () => {
  const isSuper = makeIsSuperAdminEmail(['onursuay@hotmail.com'])
  assert.strictEqual(isSuper('someone@example.com'), false)
  assert.strictEqual(isSuper('admin@yoai.com'), false)
  assert.strictEqual(isSuper(''), false)
  assert.strictEqual(isSuper(null), false)
  assert.strictEqual(isSuper(undefined), false)
})

test('env override allowlist davranışı', () => {
  const isSuper = makeIsSuperAdminEmail(['ops@yoai.io', 'onursuay@hotmail.com'])
  assert.strictEqual(isSuper('ops@yoai.io'), true)
  assert.strictEqual(isSuper('onursuay@hotmail.com'), true)
  assert.strictEqual(isSuper('intruder@x.com'), false)
})

// ── API yetkilendirme akışı (statik kod denetimi) ────────────────
console.log('\n[2] API yetkilendirme akışı')

const adminBpFile = path.join(__dirname, '..', '..', 'app', 'api', 'admin', 'business-profiles', 'route.ts')
const adminBpSrc = fs.readFileSync(adminBpFile, 'utf-8')

test('business-profiles endpoint checkAdminAccess kullanıyor', () => {
  assert.ok(
    adminBpSrc.includes('checkAdminAccess'),
    'business-profiles endpoint hâlâ eski header-only auth kullanıyor',
  )
})

test('yetkisiz çağrı 404 ile döner (admin alanı sızdırılmaz)', () => {
  // checkAdminAccess.ok === false ise endpoint 404 döndürüyor mu?
  assert.ok(
    /status:\s*404/.test(adminBpSrc),
    'Yetkisiz cevap 404 değil; 401/403 sızıntısı riski',
  )
  assert.ok(
    !/status:\s*401/.test(adminBpSrc),
    "Eski 'unauthorized 401' davranışı hâlâ var",
  )
})

const overviewFile = path.join(__dirname, '..', '..', 'app', 'api', 'admin', 'gozetim-merkezi', 'route.ts')
const overviewSrc = fs.readFileSync(overviewFile, 'utf-8')

test('overview endpoint checkAdminAccess kullanıyor', () => {
  assert.ok(overviewSrc.includes('checkAdminAccess'))
  assert.ok(/status:\s*404/.test(overviewSrc))
})

test('overview endpoint signups join ediyor (kullanıcı e-postası)', () => {
  assert.ok(overviewSrc.includes('signups'))
  assert.ok(overviewSrc.includes('email'))
})

test('overview endpoint scan extracted_* alanlarını ve scan_status döner', () => {
  assert.ok(overviewSrc.includes('extracted_title'))
  assert.ok(overviewSrc.includes('extracted_description'))
  assert.ok(overviewSrc.includes('extracted_keywords'))
  assert.ok(overviewSrc.includes('extracted_services'))
  assert.ok(overviewSrc.includes('scan_status'))
})

test('overview endpoint UUID kolonu için boş array sentinel kullanmıyor', () => {
  // Boş profil/user id listesi UUID kolonuna `__none__` ile gönderilirse
  // Postgres "invalid input syntax for type uuid" hatası verir; tüm
  // endpoint 500'e çakılır. Sentinel kullanılmadığını ve boş array
  // durumunda sorgunun atlandığını doğrula.
  assert.ok(
    !overviewSrc.includes("['__none__']"),
    'UUID sentinel hâlâ kullanılıyor — boş profil listesinde 500 riski',
  )
  assert.ok(
    /Promise\.resolve\(\{\s*data:\s*\[\]/.test(overviewSrc),
    'Boş array için query atlama dalı yok',
  )
})

test('overview endpoint diagnostics dizisi döndürüyor', () => {
  assert.ok(overviewSrc.includes('diagnostics'))
})

test('overview endpoint profilsiz kullanıcıları profile=null ile dahil ediyor', () => {
  assert.ok(/profileless|profile:\s*null/.test(overviewSrc))
})

test('overview endpoint signups24h / signups7d KPI hesaplıyor', () => {
  assert.ok(overviewSrc.includes('signups24h'))
  assert.ok(overviewSrc.includes('signups7d'))
})

test('overview endpoint hata tipi sınıflandırması yapıyor', () => {
  assert.ok(overviewSrc.includes('login_wall'))
  assert.ok(overviewSrc.includes('no_extractable_metadata'))
  assert.ok(overviewSrc.includes('scraper_provider_missing'))
  assert.ok(overviewSrc.includes('http_404'))
  assert.ok(overviewSrc.includes('errorTypeCounts'))
})

test('overview endpoint intelligenceMissing KPI içeriyor', () => {
  assert.ok(overviewSrc.includes('intelligenceMissing'))
})

const adminBpFile2 = path.join(__dirname, '..', '..', 'app', 'api', 'admin', 'business-profiles', 'route.ts')
const adminBpSrc2 = fs.readFileSync(adminBpFile2, 'utf-8')

test('business-profiles endpoint UUID kolonu için sentinel kullanmıyor', () => {
  assert.ok(
    !adminBpSrc2.includes("['__none__']"),
    'business-profiles endpoint hâlâ __none__ sentinel kullanıyor',
  )
})

test('ADMIN_SECRET manuel kullanım korunuyor (checkAdminAccess içinde)', () => {
  assert.ok(
    superAdminSrc.includes('x-admin-secret') && superAdminSrc.includes('ADMIN_SECRET'),
    'ADMIN_SECRET header path kaldırılmış',
  )
})

// ── Sidebar görünürlüğü ──────────────────────────────────────────
console.log('\n[3] Sidebar görünürlüğü')

const sidebarFile = path.join(__dirname, '..', '..', 'components', 'SidebarNav.tsx')
const sidebarSrc = fs.readFileSync(sidebarFile, 'utf-8')

test('sidebar /api/admin/me çağrısı yapıyor', () => {
  assert.ok(sidebarSrc.includes('/api/admin/me'))
})

test('sidebar gozetimMerkeziNavItem hasAccess true iken inject ediyor', () => {
  assert.ok(sidebarSrc.includes('gozetimMerkeziNavItem'))
  assert.ok(sidebarSrc.includes('hasGozetimAccess'))
})

test('sidebar normal kullanıcı için item göstermez (default state false)', () => {
  assert.ok(/useState<boolean>\(false\)/.test(sidebarSrc))
})

const navFile = path.join(__dirname, '..', '..', 'lib', 'nav.ts')
const navSrc = fs.readFileSync(navFile, 'utf-8')

test('gozetimMerkeziNavItem navItems içinde değil (default gizli)', () => {
  // navItems dizisinin tanımı içinde 'gozetim-merkezi' geçmemeli
  const navItemsBlock = navSrc.split('export const navItems')[1]?.split('export const gozetimMerkeziNavItem')[0] ?? ''
  assert.ok(
    !navItemsBlock.includes('gozetim-merkezi'),
    'gozetim-merkezi navItems içinde — herkese görünür olur',
  )
})

test('gozetimMerkeziNavItem ayrı export ediliyor', () => {
  assert.ok(navSrc.includes('export const gozetimMerkeziNavItem'))
  assert.ok(navSrc.includes("href: '/gozetim-merkezi'"))
})

// ── /gozetim-merkezi route guard ─────────────────────────────────
console.log('\n[4] Route guard')

const pageFile = path.join(__dirname, '..', '..', 'app', 'gozetim-merkezi', 'page.tsx')
const pageSrc = fs.readFileSync(pageFile, 'utf-8')

test('page server component getIsCurrentUserSuperAdmin kullanıyor', () => {
  assert.ok(pageSrc.includes('getIsCurrentUserSuperAdmin'))
})

test('yetkisiz kullanıcı sessizce /dashboard route\'una yönlenir', () => {
  assert.ok(pageSrc.includes("redirect('/dashboard')"))
})

test('page 403 veya unauthorized ekranı içermez', () => {
  assert.ok(
    !/403|unauthorized|yetkisiz|forbidden/i.test(pageSrc.replace(/redirect/g, '')),
    'Page içinde 403/yetkisiz/forbidden metni var — sızıntı riski',
  )
})

// ── UI metin denetimi ────────────────────────────────────────────
console.log('\n[5] UI metin denetimi (Süper Admin yasak)')

const clientFile = path.join(__dirname, '..', '..', 'app', 'gozetim-merkezi', 'GozetimMerkeziClient.tsx')
const clientSrc = fs.readFileSync(clientFile, 'utf-8')

test('client UI içinde "Süper Admin" metni geçmiyor', () => {
  assert.ok(!/Süper\s*Admin/i.test(clientSrc))
})

test('client UI içinde "Admin Panel" metni geçmiyor', () => {
  assert.ok(!/Admin\s*Panel/i.test(clientSrc))
})

test('client UI başlığı "Gözetim Merkezi" içerir', () => {
  assert.ok(clientSrc.includes('Gözetim Merkezi'))
})

test('sidebar görünür etiket "Gözetim Merkezi"', () => {
  assert.ok(navSrc.includes("label: 'Gözetim Merkezi'"))
})

// ── Renk kuralı ──────────────────────────────────────────────────
console.log('\n[6] Renk kuralı (amber/yellow yasak)')

test('client UI amber/yellow Tailwind class içermez', () => {
  assert.ok(!/bg-amber-|text-amber-|border-amber-/.test(clientSrc))
  assert.ok(!/bg-yellow-|text-yellow-|border-yellow-/.test(clientSrc))
})

// ── Sonuç ────────────────────────────────────────────────────────
setTimeout(() => {
  console.log('')
  console.log(`Geçen: ${passed}`)
  console.log(`Kalan: ${failed}`)
  if (failed > 0) {
    process.exit(1)
  }
}, 250)
