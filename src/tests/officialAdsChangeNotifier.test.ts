/**
 * Official Ads Change Notifier — Unit Tests
 * Çalıştırma: npx tsx src/tests/officialAdsChangeNotifier.test.ts
 */
import assert from 'assert'
import {
  buildOfficialAdsChangeEmail,
  notifyOwnerOfficialAdsChanges,
} from '../../lib/yoai/officialAdsChangeNotifier'
import type { RefreshResult } from '../../lib/yoai/officialAdsDocsRefresh'

let passed = 0
let failed = 0
const queue: Array<() => Promise<void>> = []
function test(name: string, fn: () => void | Promise<void>): void {
  queue.push(async () => {
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

function result(over: Partial<RefreshResult> = {}): RefreshResult {
  return {
    checkedSources: 5,
    changedSources: 2,
    failedSources: 0,
    reviewRequiredCount: 1,
    createdDrafts: 3,
    changed: [
      { sourceId: 's1', platform: 'meta', title: 'Objectives', url: 'u', oldHash: 'a', newHash: 'b', status: 'review_required', diffSummary: 'Kelime: 100 → 110' },
    ],
    failed: [],
    ...over,
  }
}

test('buildEmail: konu ve gövde sayıları içerir', () => {
  const { subject, html } = buildOfficialAdsChangeEmail(result())
  assert.ok(subject.includes('2 değişiklik'), 'değişiklik sayısı konuda')
  assert.ok(subject.includes('3 onay bekliyor'), 'taslak sayısı konuda')
  assert.ok(html.includes('Objectives'), 'değişen kaynak gövdede')
  assert.ok(html.includes('Gözetim Merkezi'), 'panel yönlendirmesi gövdede')
})

test('değişiklik yoksa gönderilmez', async () => {
  const r = await notifyOwnerOfficialAdsChanges(result({ changedSources: 0, createdDrafts: 0 }), { send: async () => {} })
  assert.strictEqual(r.sent, false)
  assert.strictEqual(r.reason, 'no_changes')
})

test('SMTP yapılandırılmamışsa best-effort atlar (job patlamaz)', async () => {
  const r = await notifyOwnerOfficialAdsChanges(result(), { recipients: ['owner@x.com'], smtpEnv: {} })
  assert.strictEqual(r.sent, false)
  assert.strictEqual(r.reason, 'smtp_not_configured')
})

test('enjekte send ile gönderir, doğru alıcı + konu', async () => {
  const calls: Array<{ to: string; subject: string }> = []
  const r = await notifyOwnerOfficialAdsChanges(result(), {
    recipients: ['owner@x.com'],
    send: async (to, subject) => { calls.push({ to, subject }) },
  })
  assert.strictEqual(r.sent, true)
  assert.strictEqual(calls.length, 1)
  assert.strictEqual(calls[0].to, 'owner@x.com')
  assert.ok(calls[0].subject.includes('Resmi reklam dökümanı'))
})

;(async () => {
  for (const t of queue) await t()
  console.log(`\n${passed + failed} test: ${passed} geçti, ${failed} başarısız`)
  if (failed > 0) process.exit(1)
})()
