/**
 * Manuel Signup Approval — Source-level kontrol testleri.
 *
 * Bu test paketi DB veya çalışan bir server'a değil, kaynak dosyaların
 * çağrıldığı yere bakar; aşağıdaki kontratlar bozulursa açılır:
 *   - signups tablosunda approval_status alanı var ve default 'pending'
 *   - kayıt sırasında approval_status='pending' set ediliyor
 *   - email verify approval_status'a dokunmuyor
 *   - email verify dashboard yerine /basvuru-durumu'na yönlendiriyor
 *   - login route approvalStatus + redirectTo döndürüyor
 *   - approval-status endpoint'i owner'ı approved sayıyor
 *   - guard owner / approved değilse /basvuru-durumu'na yönlendiriyor
 *
 * Çalıştırma:
 *   npx tsx src/tests/manualSignupApproval.test.ts
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
const migrationFile = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260515000000_signups_manual_approval_and_premeeting.sql',
)
const signupRoute = path.join(repoRoot, 'app', 'api', 'signup', 'route.ts')
const verifyRoute = path.join(repoRoot, 'app', 'api', 'signup', 'verify', 'route.ts')
const loginRoute = path.join(repoRoot, 'app', 'api', 'auth', 'login', 'route.ts')
const approvalStatusRoute = path.join(repoRoot, 'app', 'api', 'signup', 'approval-status', 'route.ts')
const accountApproval = path.join(repoRoot, 'lib', 'auth', 'accountApproval.ts')
const guardFile = path.join(repoRoot, 'components', 'auth', 'AccountApprovalGuard.tsx')

function read(file: string): string {
  return fs.readFileSync(file, 'utf-8')
}

console.log('\n[1] Migration')

test('approval_status sütunu eklenmiş ve default pending', () => {
  const src = read(migrationFile)
  assert.ok(src.includes('approval_status text'), 'approval_status sütunu yok')
  assert.ok(src.includes("DEFAULT 'pending'"), "default 'pending' değil")
})

test('premeeting_status sütunu eklenmiş', () => {
  const src = read(migrationFile)
  assert.ok(src.includes('premeeting_status text'), 'premeeting_status yok')
  assert.ok(src.includes('signup_premeeting_bookings'), 'premeeting tablosu yok')
})

test('notification_log tablosu var', () => {
  const src = read(migrationFile)
  assert.ok(src.includes('CREATE TABLE IF NOT EXISTS notification_log'), 'notification_log eksik')
})

console.log('\n[2] /api/signup')

test('signup sırasında approval_status pending yazılıyor', () => {
  const src = read(signupRoute)
  assert.ok(src.includes("approval_status: 'pending'"), "approval_status pending atanmıyor")
  assert.ok(src.includes('notifyOwnersOfSignupEvent'), 'owner notification çağrısı eksik')
})

test('signup endpoint kullanıcıya otomatik onay maili göndermiyor', () => {
  const src = read(signupRoute)
  // Mevcut email gönderimi sadece verification içindir; onay/approved metni
  // kullanıcıya hiçbir aşamada gitmez.
  const hasApprovedMail = /onayland[ıi]|approved/i.test(src) && /resend\.emails\.send/i.test(src)
  // Heuristic: aynı dosya içinde 'approved' metni varsa Resend send dışında
  // olmalı. Şu an dosya 'approved' kelimesi içermiyor, bu yüzden bekleriz:
  assert.ok(!hasApprovedMail || !/subject:\s*'.*?onay/i.test(src), 'kullanıcıya onaylandı maili gidiyor olabilir')
})

console.log('\n[3] /api/signup/verify')

test('email verify approval_status\'a dokunmuyor', () => {
  const src = read(verifyRoute)
  // Sadece status='active' güncellenir; approval_status bu dosyada update edilmemeli.
  const blockingPatterns = [
    /approval_status\s*:\s*'approved'/,
    /approval_status\s*:\s*"approved"/,
  ]
  for (const p of blockingPatterns) {
    assert.ok(!p.test(src), `verify route approval_status'u doğrudan approved yapıyor (${p})`)
  }
})

test('email verify /basvuru-durumu\'na yönlendiriyor', () => {
  const src = read(verifyRoute)
  assert.ok(src.includes('/basvuru-durumu'), 'verify route /basvuru-durumu yönlendirmesi içermiyor')
  assert.ok(!/redirect\(new URL\('\/dashboard'/.test(src), 'verify dashboard yönlendirmesi hâlâ var')
})

test('email verify user_id httpOnly cookie\'sini set ediyor', () => {
  const src = read(verifyRoute)
  assert.ok(/cookies\.set\('user_id'/.test(src), "user_id cookie set edilmiyor")
})

console.log('\n[4] /api/auth/login')

test('login route approvalStatus + redirectTo dönüyor', () => {
  const src = read(loginRoute)
  assert.ok(src.includes('approvalStatus'), 'approvalStatus dönülmüyor')
  assert.ok(src.includes('redirectTo'), 'redirectTo dönülmüyor')
  assert.ok(src.includes('/basvuru-durumu'), 'login basvuru-durumu yolu içermiyor')
})

test('login route owner allowlist\'i atlıyor', () => {
  const src = read(loginRoute)
  assert.ok(src.includes('isSuperAdminEmail'), 'isSuperAdminEmail bypass kontrolü yok')
})

console.log('\n[5] /api/signup/approval-status')

test('approval-status endpoint owner için approved döndürüyor', () => {
  const src = read(approvalStatusRoute)
  assert.ok(src.includes('isOwner'), 'isOwner bayrağı dönmüyor')
  assert.ok(src.includes("state.isOwner ? 'approved'"), "owner approved kısa devresi yok")
})

console.log('\n[6] AccountApprovalGuard')

test('Guard owner / approved değilse /basvuru-durumu redirect ediyor', () => {
  const src = read(guardFile)
  assert.ok(src.includes('/basvuru-durumu'), 'guard /basvuru-durumu yönlendirmesi yapmıyor')
  assert.ok(src.includes('/login'), '401 → login yönlendirmesi yok')
  assert.ok(src.includes("approvalStatus === 'approved'"), 'approved kontrolü yok')
})

test('Guard loading sırasında sidebar göstermiyor', () => {
  const src = read(guardFile)
  // Guard kendi içinde SidebarNav import etmemeli — yalnızca loading/redirect
  assert.ok(!src.includes('SidebarNav'), 'guard SidebarNav import ediyor (sidebar sızıntısı)')
})

console.log('\n[7] accountApproval helper')

test('isAccountApprovedForPanel owner true, pending false', () => {
  const src = read(accountApproval)
  assert.ok(src.includes('isAccountApprovedForPanel'), 'helper fonksiyonu yok')
  assert.ok(src.includes('isOwner') && src.includes("approvalStatus === 'approved'"), 'kurallar eksik')
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
