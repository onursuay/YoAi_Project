/**
 * Gözetim Merkezi → Başvurular sekmesi — kaynak seviyesi kontrol testleri.
 *
 * Çalıştırma:
 *   npx tsx src/tests/gozetimMerkeziSignupApproval.test.ts
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
const listRoute = path.join(repoRoot, 'app', 'api', 'admin', 'signups', 'route.ts')
const approveRoute = path.join(repoRoot, 'app', 'api', 'admin', 'signups', '[id]', 'approve', 'route.ts')
const rejectRoute = path.join(repoRoot, 'app', 'api', 'admin', 'signups', '[id]', 'reject', 'route.ts')
const noteRoute = path.join(repoRoot, 'app', 'api', 'admin', 'signups', '[id]', 'note', 'route.ts')
const panel = path.join(repoRoot, 'components', 'gozetim', 'SignupApprovalsPanel.tsx')
const gozetimClient = path.join(repoRoot, 'app', 'gozetim-merkezi', 'GozetimMerkeziClient.tsx')

function read(file: string): string {
  return fs.readFileSync(file, 'utf-8')
}

console.log('\n[1] Admin routes erişim kontrolü')

for (const [name, file] of [
  ['list', listRoute],
  ['approve', approveRoute],
  ['reject', rejectRoute],
  ['note', noteRoute],
] as const) {
  test(`${name} route checkAdminAccess kullanıyor`, () => {
    const src = read(file)
    assert.ok(src.includes('checkAdminAccess'), 'checkAdminAccess çağrısı yok')
    assert.ok(src.includes("status: 404"), 'yetkisiz çağrı 404 dönmüyor')
  })
}

console.log('\n[2] Approve / Reject / Note semantics')

test('approve route approval_status=approved + approved_at yazıyor', () => {
  const src = read(approveRoute)
  assert.ok(src.includes("approval_status: 'approved'"), 'approved status yazılmıyor')
  assert.ok(src.includes('approved_at'), 'approved_at güncellenmiyor')
  assert.ok(src.includes('approved_by'), 'approved_by güncellenmiyor')
})

test('reject route approval_status=rejected + rejected_at yazıyor', () => {
  const src = read(rejectRoute)
  assert.ok(src.includes("approval_status: 'rejected'"), 'rejected status yazılmıyor')
  assert.ok(src.includes('rejected_at'), 'rejected_at güncellenmiyor')
  assert.ok(src.includes('rejected_by'), 'rejected_by güncellenmiyor')
})

test('note route approval_note güncelliyor', () => {
  const src = read(noteRoute)
  assert.ok(src.includes('approval_note'), 'approval_note güncellenmiyor')
  assert.ok(src.includes("note.trim()"), 'note trim/validation yok')
})

console.log('\n[3] UI panel')

test('SignupApprovalsPanel approve/reject endpointlerini çağırıyor', () => {
  const src = read(panel)
  assert.ok(src.includes('/api/admin/signups'), 'list endpoint çağrılmıyor')
  // approve/reject template literal ile inşa ediliyor (`${id}/${action}`),
  // action değerleri "approve"/"reject" literal olarak görünmeli.
  assert.ok(/['"]approve['"]/.test(src), 'approve action sabiti yok')
  assert.ok(/['"]reject['"]/.test(src), 'reject action sabiti yok')
  assert.ok(src.includes('/note'), 'note endpoint çağrılmıyor')
})

test('SignupApprovalsPanel YASAK amber/yellow renkleri kullanmıyor', () => {
  const src = read(panel)
  assert.ok(!/bg-amber-|text-amber-|border-amber-/.test(src), 'amber sınıfı kullanılıyor')
  assert.ok(!/bg-yellow-|text-yellow-|border-yellow-/.test(src), 'yellow sınıfı kullanılıyor')
})

test('Gözetim Merkezi client SignupApprovalsPanel\'i render ediyor', () => {
  const src = read(gozetimClient)
  assert.ok(src.includes('SignupApprovalsPanel'), 'panel render edilmiyor')
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
