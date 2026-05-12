/**
 * Daily Active Campaign Intelligence — Unit Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/dailyActiveCampaignIntelligence.test.ts
 *
 * Test framework gerektirmez; Node assert modülü kullanır.
 */

import assert from 'assert'
import {
  runDailyActiveCampaignIntelligence,
} from '../../lib/yoai/dailyActiveCampaignIntelligence'
import type { DeepCampaignInsight } from '../../lib/yoai/analysisTypes'
import type { PendingApprovalRecord } from '../../lib/yoai/approvalStore'

// ── Test helpers ──────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function test(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓  ${name}`)
    passed++
  } catch (err) {
    const msg = err instanceof assert.AssertionError ? err.message : String(err)
    console.error(`  ✗  ${name}`)
    console.error(`     ${msg}`)
    failed++
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCampaign(overrides: Partial<DeepCampaignInsight> = {}): DeepCampaignInsight {
  return {
    id: 'camp_1',
    platform: 'Meta',
    campaignName: 'Test Kampanya',
    status: 'ACTIVE',
    objective: 'OUTCOME_TRAFFIC',
    metrics: { spend: 100, impressions: 1000, clicks: 50, ctr: 5, cpc: 2, conversions: 5, roas: 1.5 },
    problemTags: [],
    score: 70,
    riskLevel: 'low',
    adsets: [],
    dailyBudget: 50,
    lifetimeBudget: null,
    currency: 'TRY',
    ...overrides,
  }
}

function makeApproval(overrides: Partial<PendingApprovalRecord> = {}): PendingApprovalRecord {
  return {
    id: 'approval_1',
    user_id: 'user_1',
    proposal_id: 'prop_1',
    source_run_id: null,
    platform: 'Meta',
    source_campaign_id: 'camp_1',
    campaign_type: 'optimization',
    proposal_snapshot: {
      campaignObjective: 'OUTCOME_TRAFFIC',
      campaignName: 'Test Kampanya',
      finalUrl: 'https://example.com/sayfa',
    },
    status: 'pending',
    status_reason: null,
    rejection_reason: null,
    hold_reason: null,
    edited_payload: null,
    approved_at: null,
    rejected_at: null,
    held_at: null,
    published_at: null,
    failed_at: null,
    publish_audit_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {},
    ...overrides,
  }
}

// ── Test 1: Aktif kampanya tarama planı oluşur ─────────────────────────────

test('Test 1: Aktif kampanya, geçerli öneri → keep_existing', () => {
  const campaigns = [makeCampaign()]
  const approvals = [makeApproval()]
  const result = runDailyActiveCampaignIntelligence(campaigns, approvals)

  assert.strictEqual(result.summary.scannedProposals, 1, 'Öneri taranmış olmalı')
  assert.strictEqual(result.proposalsToKeep.length, 1, 'Öneri geçerli tutulmalı')
  assert.strictEqual(result.proposalsToMarkStale.length, 0, 'Stale olmamalı')
  assert.strictEqual(result.evaluations[0].decision, 'keep_existing')
})

// ── Test 2: Pasif kampanya → stale ────────────────────────────────────────

test('Test 2: DELETED kampanya → öneri stale olur', () => {
  const campaigns = [makeCampaign({ status: 'DELETED' })]
  const approvals = [makeApproval()]
  const result = runDailyActiveCampaignIntelligence(campaigns, approvals)

  assert.strictEqual(result.proposalsToMarkStale.length, 1, 'Öneri stale yapılmalı')
  assert.strictEqual(result.proposalsToMarkStale[0].staleReason, 'campaign_inactive')
  assert.strictEqual(result.evaluations[0].decision, 'mark_stale')
})

// ── Test 3: Silinmiş kampanya (listede yok) → stale ───────────────────────

test('Test 3: Kampanya aktif listede yok → öneri stale (campaign_deleted)', () => {
  const campaigns: DeepCampaignInsight[] = [] // hiç aktif kampanya yok
  const approvals = [makeApproval({ source_campaign_id: 'camp_gone' })]
  const result = runDailyActiveCampaignIntelligence(campaigns, approvals)

  assert.strictEqual(result.proposalsToMarkStale.length, 1)
  assert.strictEqual(result.proposalsToMarkStale[0].staleReason, 'campaign_deleted')
})

// ── Test 4: Landing URL değişirse → update_recommendation + stale ─────────

test('Test 4: Landing URL değişmiş → update_recommendation ve stale', () => {
  const campaigns = [
    makeCampaign({
      adsets: [{
        id: 'adset_1',
        name: 'Adset',
        status: 'ACTIVE',
        platform: 'Meta',
        dailyBudget: 20,
        lifetimeBudget: null,
        metrics: { spend: 50, impressions: 500, clicks: 25, ctr: 5, cpc: 2, conversions: 2, roas: 1 },
        ads: [{
          id: 'ad_1',
          name: 'Ad',
          status: 'ACTIVE',
          platform: 'Meta',
          metrics: { spend: 50, impressions: 500, clicks: 25, ctr: 5, cpc: 2, conversions: 2, roas: 1 },
          linkUrl: 'https://example.com/yeni-sayfa',
        }],
      }],
    }),
  ]
  const approvals = [
    makeApproval({
      proposal_snapshot: {
        campaignObjective: 'OUTCOME_TRAFFIC',
        finalUrl: 'https://example.com/eski-sayfa',
      },
    }),
  ]
  const result = runDailyActiveCampaignIntelligence(campaigns, approvals)

  assert.strictEqual(result.evaluations[0].decision, 'update_recommendation')
  assert.strictEqual(result.proposalsToMarkStale[0].staleReason, 'landing_url_changed')
  assert.ok(result.campaignsNeedingUpdate.includes('camp_1'))
})

// ── Test 5: Objective değiştiyse → stale ──────────────────────────────────

test('Test 5: Kampanya hedefi değiştiyse → mark_stale (objective_changed)', () => {
  const campaigns = [makeCampaign({ objective: 'OUTCOME_LEADS' })]
  const approvals = [
    makeApproval({
      proposal_snapshot: {
        campaignObjective: 'OUTCOME_TRAFFIC', // farklı
        campaignName: 'Test Kampanya',
      },
    }),
  ]
  const result = runDailyActiveCampaignIntelligence(campaigns, approvals)

  assert.strictEqual(result.proposalsToMarkStale.length, 1)
  assert.strictEqual(result.proposalsToMarkStale[0].staleReason, 'objective_changed')
})

// ── Test 6: Çok eski öneri → stale ────────────────────────────────────────

test('Test 6: 31 gün önce oluşturulmuş öneri → proposal_too_old', () => {
  const oldDate = new Date()
  oldDate.setDate(oldDate.getDate() - 31)

  const campaigns = [makeCampaign()]
  const approvals = [makeApproval({ created_at: oldDate.toISOString() })]
  const result = runDailyActiveCampaignIntelligence(campaigns, approvals)

  assert.strictEqual(result.proposalsToMarkStale.length, 1)
  assert.strictEqual(result.proposalsToMarkStale[0].staleReason, 'proposal_too_old')
})

// ── Test 7: PAUSED kampanya → needs_review (stale değil) ──────────────────

test('Test 7: PAUSED kampanya → needs_review', () => {
  const campaigns = [makeCampaign({ status: 'PAUSED' })]
  const approvals = [makeApproval()]
  const result = runDailyActiveCampaignIntelligence(campaigns, approvals)

  assert.strictEqual(result.evaluations[0].decision, 'needs_review')
  assert.strictEqual(result.proposalsToMarkStale.length, 0, 'PAUSED stale yapılmamalı')
  assert.strictEqual(result.proposalsToMarkNeedsReview.length, 1)
})

// ── Test 8: Terminal statüdeki öneri taranmaz ─────────────────────────────

test('Test 8: published/rejected/approved öneriler taranmaz', () => {
  const campaigns = [makeCampaign()]
  const terminalStatuses = ['published', 'rejected', 'approved', 'expired'] as const
  for (const status of terminalStatuses) {
    const approvals = [makeApproval({ status: status as any })]
    const result = runDailyActiveCampaignIntelligence(campaigns, approvals)
    assert.strictEqual(
      result.summary.scannedProposals, 0,
      `'${status}' statüsündeki öneri taranmamalı`,
    )
  }
})

// ── Test 9: Google ve Meta ayrı değerlendirilir ───────────────────────────

test('Test 9: Google ve Meta önerileri ayrı platform bilgisi taşır', () => {
  const metaCampaign = makeCampaign({ id: 'meta_1', platform: 'Meta' })
  const googleCampaign = makeCampaign({ id: 'google_1', platform: 'Google', objective: 'SEARCH' })
  const metaApproval = makeApproval({ id: 'a1', proposal_id: 'p1', platform: 'Meta', source_campaign_id: 'meta_1' })
  const googleApproval = makeApproval({ id: 'a2', proposal_id: 'p2', platform: 'Google', source_campaign_id: 'google_1', proposal_snapshot: { campaignObjective: 'SEARCH', campaignName: 'G' } })

  const result = runDailyActiveCampaignIntelligence([metaCampaign, googleCampaign], [metaApproval, googleApproval])

  assert.ok(result.summary.byPlatform['Meta'], 'Meta istatistiği olmalı')
  assert.ok(result.summary.byPlatform['Google'], 'Google istatistiği olmalı')
  assert.strictEqual(result.summary.byPlatform['Meta'].scanned, 1)
  assert.strictEqual(result.summary.byPlatform['Google'].scanned, 1)
})

// ── Test 10: daily-run summary alanları doğru hesaplanır ──────────────────

test('Test 10: Summary alanları tutarlı', () => {
  const campaigns = [makeCampaign({ id: 'c1' }), makeCampaign({ id: 'c2', status: 'DELETED' })]
  const approvals = [
    makeApproval({ id: 'a1', proposal_id: 'p1', source_campaign_id: 'c1' }),
    makeApproval({ id: 'a2', proposal_id: 'p2', source_campaign_id: 'c2' }),
  ]
  const result = runDailyActiveCampaignIntelligence(campaigns, approvals)

  assert.strictEqual(result.summary.scannedProposals, 2)
  assert.strictEqual(result.summary.markedStale, 1)
  assert.strictEqual(result.summary.kept, 1)
  // scannedProposals = markedStale + kept + needsReview + toUpdate (eğer stale sayılıyorsa)
  assert.strictEqual(
    result.summary.markedStale + result.summary.kept + result.summary.needsReview,
    result.summary.scannedProposals,
    'Toplam sayılar tutarlı olmalı',
  )
})

// ── Test 11: Kampanya bağımsız öneri (source_campaign_id yok) → geçerli ───

test('Test 11: sourceCampaignId olmayan öneri → keep_existing', () => {
  const campaigns = [makeCampaign()]
  const approvals = [makeApproval({ source_campaign_id: null })]
  const result = runDailyActiveCampaignIntelligence(campaigns, approvals)

  assert.strictEqual(result.evaluations[0].decision, 'keep_existing', 'Genel öneri geçerli tutulmalı')
})

// ── Test 12: Birden fazla stale öneri birlikte işlenir ────────────────────

test('Test 12: Birden fazla stale öneri doğru sayılır', () => {
  const campaigns: DeepCampaignInsight[] = [] // hiç aktif kampanya yok
  const approvals = [
    makeApproval({ id: 'a1', proposal_id: 'p1', source_campaign_id: 'gone_1' }),
    makeApproval({ id: 'a2', proposal_id: 'p2', source_campaign_id: 'gone_2' }),
    makeApproval({ id: 'a3', proposal_id: 'p3', source_campaign_id: 'gone_3' }),
  ]
  const result = runDailyActiveCampaignIntelligence(campaigns, approvals)

  assert.strictEqual(result.proposalsToMarkStale.length, 3)
  assert.strictEqual(result.summary.markedStale, 3)
  assert.strictEqual(result.proposalsToKeep.length, 0)
})

// ── Sonuç ─────────────────────────────────────────────────────────────────────

console.log('\n── Daily Active Campaign Intelligence Tests ──')
console.log(`  ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
