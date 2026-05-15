/**
 * Pre-meeting scheduling — kaynak seviyesi kontrol testleri.
 *
 * Çalıştırma:
 *   npx tsx src/tests/preMeetingScheduling.test.ts
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
const availabilityRoute = path.join(
  repoRoot,
  'app',
  'api',
  'signup',
  'premeeting',
  'availability',
  'route.ts',
)
const scheduleRoute = path.join(repoRoot, 'app', 'api', 'signup', 'premeeting', 'schedule', 'route.ts')
const declineRoute = path.join(repoRoot, 'app', 'api', 'signup', 'premeeting', 'decline', 'route.ts')
const approvalModal = path.join(repoRoot, 'components', 'signup', 'PreMeetingApprovalModal.tsx')
const scheduleModal = path.join(repoRoot, 'components', 'signup', 'PreMeetingScheduleModal.tsx')
const ownerNotifier = path.join(repoRoot, 'lib', 'notifications', 'ownerNotifier.ts')

function read(file: string): string {
  return fs.readFileSync(file, 'utf-8')
}

console.log('\n[1] Pre-meeting bookings tablosu')

test('signup_premeeting_bookings tablosu var + unique scheduled_at index', () => {
  const src = read(migrationFile)
  assert.ok(src.includes('signup_premeeting_bookings'), 'tablo yok')
  assert.ok(
    /CREATE UNIQUE INDEX[^;]+scheduled_at[^;]+WHERE status = 'scheduled'/.test(src),
    'unique slot index yok',
  )
})

console.log('\n[2] Availability')

test('availability route hafta sonu slotlarını filtreliyor', () => {
  const src = read(availabilityRoute)
  assert.ok(src.includes('dow === 0 || dow === 6'), 'hafta sonu filtresi yok')
  assert.ok(src.includes('Europe/Istanbul'), 'timezone sabiti yok')
  assert.ok(src.includes('SLOT_START_HOUR = 10') || src.includes('10 //'), 'başlangıç saati 10 değil')
})

test('availability route dolu slotları DB\'den okuyor', () => {
  const src = read(availabilityRoute)
  assert.ok(src.includes('signup_premeeting_bookings'), 'DB lookup yok')
  assert.ok(src.includes("status = 'scheduled'") || /'scheduled'/.test(src), 'scheduled filtre yok')
})

console.log('\n[3] Schedule')

test('schedule route slot çakışmasını engelliyor', () => {
  const src = read(scheduleRoute)
  assert.ok(src.includes('slot_taken'), 'slot_taken hatası yok')
  assert.ok(src.includes('duplicate'), 'unique-index ihlali kontrolü yok')
})

test('schedule route signups\'ı call_scheduled + scheduled_at güncelliyor', () => {
  const src = read(scheduleRoute)
  assert.ok(src.includes("approval_status: 'call_scheduled'"), 'approval_status güncellenmiyor')
  assert.ok(src.includes('premeeting_scheduled_at'), 'premeeting_scheduled_at yazılmıyor')
})

test('schedule route owner notification gönderiyor', () => {
  const src = read(scheduleRoute)
  assert.ok(src.includes("notifyOwnersOfSignupEvent('premeeting_scheduled'"), 'owner notify çağrısı yok')
})

console.log('\n[4] Decline')

test('decline route premeeting_status=declined + approval_status=call_declined yazıyor', () => {
  const src = read(declineRoute)
  assert.ok(src.includes("premeeting_status: 'declined'"), 'declined status yazılmıyor')
  assert.ok(src.includes("approval_status: 'call_declined'"), 'call_declined yazılmıyor')
})

test('decline route owner notification gönderiyor', () => {
  const src = read(declineRoute)
  assert.ok(src.includes("notifyOwnersOfSignupEvent('premeeting_declined'"), 'owner notify çağrısı yok')
})

console.log('\n[5] UI modals')

test('PreMeetingApprovalModal kapatılamıyor (X yok, ESC yutuluyor, dış tıklama yutuluyor)', () => {
  const src = read(approvalModal)
  assert.ok(src.includes("e.key === 'Escape'"), 'ESC handler yok')
  assert.ok(src.includes('preventDefault()') && src.includes('stopPropagation()'), 'dış tıklama yutulmuyor')
  assert.ok(/Görüşme Planla/.test(src), 'Görüşme Planla butonu yok')
  assert.ok(/Şimdilik Planlamak İstemiyorum/.test(src), 'Şimdilik Planlamak İstemiyorum butonu yok')
  assert.ok(!/aria-label="Kapat"/.test(src), 'X butonu var (kapatılabilir)')
})

test('PreMeetingApprovalModal mesajı sözleşmedeki başlık + açıklamayı içeriyor', () => {
  const src = read(approvalModal)
  assert.ok(src.includes('Başvurunuz Alındı'), 'başlık eksik')
  assert.ok(src.includes('30 dakikalık'), '30 dakika ifadesi eksik')
})

test('PreMeetingScheduleModal availability endpoint\'i çağırıyor', () => {
  const src = read(scheduleModal)
  assert.ok(src.includes('/api/signup/premeeting/availability'), 'availability endpoint çağrılmıyor')
  assert.ok(src.includes('/api/signup/premeeting/schedule'), 'schedule endpoint çağrılmıyor')
  assert.ok(src.includes('slot_taken'), 'slot_taken handling yok')
})

console.log('\n[6] Owner notifier')

test('Owner notifier iki sabit alıcıya gönderiyor', () => {
  const src = read(ownerNotifier)
  assert.ok(src.includes('onursuay@hotmail.com'), 'onursuay@hotmail.com yok')
  assert.ok(src.includes('cnursuay@gmail.com'), 'cnursuay@gmail.com yok')
})

test('Owner notifier notification_log\'a yazıyor', () => {
  const src = read(ownerNotifier)
  assert.ok(src.includes("from('notification_log')"), 'notification_log insert yok')
  assert.ok(src.includes("status: 'failed'") || src.includes("status: 'sent'"), 'log statusu yazılmıyor')
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
