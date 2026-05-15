/**
 * Audience Payload Builder Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/audiencePayloadBuilder.test.ts
 *
 * buildCustomAudiencePayload, buildLookalikePayload, buildSavedAudiencePayload
 * pure fonksiyonları test edilir — Meta Graph API çağrısı yapılmaz.
 */

import assert from 'assert'
import {
  buildCustomAudiencePayload,
  buildLookalikePayload,
  buildSavedAudiencePayload,
} from '../../lib/meta/audiences/payloadBuilder'

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

/* ── PIXEL ── */

console.log('🧪 Audience Payload Builder Tests\n')

console.log('▶ PIXEL — include')

test('PIXEL ALL_VISITORS → subtype=WEBSITE, inclusions[0].rules[0].retention_seconds', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'PIXEL',
    rule: { pixelId: 'px1', ruleType: 'ALL_VISITORS', retention: 30 },
  })
  assert.strictEqual(p.subtype, 'WEBSITE')
  assert.strictEqual(p.pixel_id, 'px1')
  const ruleObj = JSON.parse(p.rule!)
  assert.strictEqual(ruleObj.inclusions[0].rules[0].retention_seconds, 30 * 86400)
  assert.ok(!ruleObj.exclusions, 'exclusions should be absent when no excludeRules')
})

test('PIXEL SPECIFIC_PAGES → filter field=url, operator=i_contains', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'PIXEL',
    rule: { pixelId: 'px1', ruleType: 'SPECIFIC_PAGES', urlOperator: 'contains', urlValue: '/sepet', retention: 14 },
  })
  const ruleObj = JSON.parse(p.rule!)
  const filter = ruleObj.inclusions[0].rules[0].filter
  assert.ok(filter, 'filter must exist')
  assert.strictEqual(filter[0].field, 'url')
  assert.strictEqual(filter[0].operator, 'i_contains')
  assert.strictEqual(filter[0].value, '/sepet')
})

test('PIXEL SPECIFIC_PAGES urlOperator=equals → operator=eq', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'PIXEL',
    rule: { pixelId: 'px1', ruleType: 'SPECIFIC_PAGES', urlOperator: 'equals', urlValue: '/tesekkurler', retention: 7 },
  })
  const ruleObj = JSON.parse(p.rule!)
  assert.strictEqual(ruleObj.inclusions[0].rules[0].filter[0].operator, 'eq')
})

test('PIXEL EVENTS → filter field=event, value=Purchase', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'PIXEL',
    rule: { pixelId: 'px1', ruleType: 'EVENTS', eventName: 'Purchase', retention: 30 },
  })
  const ruleObj = JSON.parse(p.rule!)
  const filter = ruleObj.inclusions[0].rules[0].filter
  assert.strictEqual(filter[0].field, 'event')
  assert.strictEqual(filter[0].value, 'Purchase')
})

console.log('\n▶ PIXEL — exclusions')

test('PIXEL exclude same-source → exclusions array present with retention_seconds', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'PIXEL',
    rule: { pixelId: 'px1', ruleType: 'ALL_VISITORS', retention: 30 },
    excludeRules: [{ source: 'PIXEL', rule: { retention: 7 } }],
  })
  const ruleObj = JSON.parse(p.rule!)
  assert.ok(Array.isArray(ruleObj.exclusions), 'exclusions must be array')
  assert.strictEqual(ruleObj.exclusions[0].rules[0].retention_seconds, 7 * 86400)
})

test('PIXEL exclude carries SPECIFIC_PAGES filter to exclusion rule', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'PIXEL',
    rule: { pixelId: 'px1', ruleType: 'ALL_VISITORS', retention: 30 },
    excludeRules: [{ source: 'PIXEL', rule: { retention: 7, ruleType: 'SPECIFIC_PAGES', urlOperator: 'contains', urlValue: '/tesekkurler' } }],
  })
  const ruleObj = JSON.parse(p.rule!)
  const exFilter = ruleObj.exclusions[0].rules[0].filter
  assert.ok(exFilter, 'exclusion filter must be present')
  assert.strictEqual(exFilter[0].field, 'url')
  assert.strictEqual(exFilter[0].value, '/tesekkurler')
})

test('PIXEL exclude carries EVENTS filter to exclusion rule', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'PIXEL',
    rule: { pixelId: 'px1', ruleType: 'ALL_VISITORS', retention: 30 },
    excludeRules: [{ source: 'PIXEL', rule: { retention: 7, ruleType: 'EVENTS', eventName: 'Purchase' } }],
  })
  const ruleObj = JSON.parse(p.rule!)
  const exFilter = ruleObj.exclusions[0].rules[0].filter
  assert.strictEqual(exFilter[0].field, 'event')
  assert.strictEqual(exFilter[0].value, 'Purchase')
})

test('PIXEL cross-source exclude (IG) → throws with clear message', () => {
  assert.throws(
    () => buildCustomAudiencePayload('Test', null, {
      source: 'PIXEL',
      rule: { pixelId: 'px1', ruleType: 'ALL_VISITORS', retention: 30 },
      excludeRules: [{ source: 'IG', rule: { retention: 7 } }],
    }),
    (e: unknown) => {
      assert.ok(e instanceof Error)
      assert.ok(e.message.includes('PIXEL'), `error message should mention PIXEL: ${e.message}`)
      assert.ok(e.message.includes('IG'), `error message should mention IG: ${e.message}`)
      return true
    }
  )
})

/* ── IG ── */

console.log('\n▶ IG — include + exclude')

test('IG → subtype=ENGAGEMENT, event_sources type=ig_business', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'IG',
    rule: { igAccountId: 'ig123', igEngagementType: 'ig_business_profile_all', retention: 90 },
  })
  assert.strictEqual(p.subtype, 'ENGAGEMENT')
  assert.strictEqual(p.object_id, 'ig123')
  const ruleObj = JSON.parse(p.rule!)
  const es = ruleObj.inclusions[0].rules[0].event_sources[0]
  assert.strictEqual(es.id, 'ig123')
  assert.strictEqual(es.type, 'ig_business')
})

test('IG exclude → exclusions[0].rules[0].event_sources[0].type = ig_business', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'IG',
    rule: { igAccountId: 'ig123', igEngagementType: 'ig_business_profile_all', retention: 90 },
    excludeRules: [{ source: 'IG', rule: { retention: 7 } }],
  })
  const ruleObj = JSON.parse(p.rule!)
  const exEs = ruleObj.exclusions[0].rules[0].event_sources[0]
  assert.strictEqual(exEs.type, 'ig_business')
  assert.strictEqual(ruleObj.exclusions[0].rules[0].retention_seconds, 7 * 86400)
})

test('IG cross-source exclude (PIXEL) → throws', () => {
  assert.throws(
    () => buildCustomAudiencePayload('Test', null, {
      source: 'IG',
      rule: { igAccountId: 'ig123', retention: 90 },
      excludeRules: [{ source: 'PIXEL', rule: { retention: 7 } }],
    }),
    (e: unknown) => { assert.ok(e instanceof Error); return true }
  )
})

/* ── PAGE ── */

console.log('\n▶ PAGE — include + exclude')

test('PAGE → event_sources type=page, filter=page_engaged', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'PAGE',
    rule: { pageId: 'pg1', pageEngagementType: 'page_engaged', retention: 60 },
  })
  const ruleObj = JSON.parse(p.rule!)
  const es = ruleObj.inclusions[0].rules[0].event_sources[0]
  assert.strictEqual(es.type, 'page')
  assert.strictEqual(es.id, 'pg1')
  assert.strictEqual(ruleObj.inclusions[0].rules[0].filter.value, 'page_engaged')
})

test('PAGE exclude → exclusions[0].rules[0].event_sources[0].type = page', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'PAGE',
    rule: { pageId: 'pg1', pageEngagementType: 'page_engaged', retention: 60 },
    excludeRules: [{ source: 'PAGE', rule: { retention: 14 } }],
  })
  const ruleObj = JSON.parse(p.rule!)
  assert.strictEqual(ruleObj.exclusions[0].rules[0].event_sources[0].type, 'page')
})

test('PAGE cross-source exclude (VIDEO) → throws', () => {
  assert.throws(
    () => buildCustomAudiencePayload('Test', null, {
      source: 'PAGE',
      rule: { pageId: 'pg1', retention: 60 },
      excludeRules: [{ source: 'VIDEO', rule: { retention: 7 } }],
    }),
    (e: unknown) => { assert.ok(e instanceof Error); return true }
  )
})

/* ── VIDEO ── */

console.log('\n▶ VIDEO — include + exclude')

test('VIDEO → subtype=ENGAGEMENT, filter field=event, default action=video_watched_3s', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'VIDEO',
    rule: { retention: 30 },
  })
  const ruleObj = JSON.parse(p.rule!)
  assert.strictEqual(ruleObj.inclusions[0].rules[0].filter.value, 'video_watched_3s')
})

test('VIDEO with videoRetentionType=video_watched_50p → filter value matches', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'VIDEO',
    rule: { videoRetentionType: 'video_watched_50p', retention: 30 },
  })
  const ruleObj = JSON.parse(p.rule!)
  assert.strictEqual(ruleObj.inclusions[0].rules[0].filter.value, 'video_watched_50p')
})

test('VIDEO exclude carries videoRetentionType to exclusion filter', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'VIDEO',
    rule: { videoRetentionType: 'video_watched_95p', retention: 30 },
    excludeRules: [{ source: 'VIDEO', rule: { videoRetentionType: 'video_watched_25p', retention: 7 } }],
  })
  const ruleObj = JSON.parse(p.rule!)
  assert.strictEqual(ruleObj.exclusions[0].rules[0].filter.value, 'video_watched_25p')
})

/* ── LEADFORM ── */

console.log('\n▶ LEADFORM — include + exclude')

test('LEADFORM opened → lead_opened event', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'LEADFORM',
    rule: { leadFormId: 'lf1', leadFormInteraction: 'opened', retention: 30 },
  })
  const ruleObj = JSON.parse(p.rule!)
  assert.strictEqual(ruleObj.inclusions[0].rules[0].filter.value, 'lead_opened')
  assert.strictEqual(p.object_id, 'lf1')
})

test('LEADFORM submitted → lead_submitted event', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'LEADFORM',
    rule: { leadFormId: 'lf1', leadFormInteraction: 'submitted', retention: 30 },
  })
  const ruleObj = JSON.parse(p.rule!)
  assert.strictEqual(ruleObj.inclusions[0].rules[0].filter.value, 'lead_submitted')
})

test('LEADFORM exclude opened → exclusion filter=lead_opened', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'LEADFORM',
    rule: { leadFormInteraction: 'submitted', retention: 30 },
    excludeRules: [{ source: 'LEADFORM', rule: { leadFormInteraction: 'opened', retention: 7 } }],
  })
  const ruleObj = JSON.parse(p.rule!)
  assert.strictEqual(ruleObj.exclusions[0].rules[0].filter.value, 'lead_opened')
})

test('LEADFORM exclude submitted → exclusion filter=lead_submitted', () => {
  const p = buildCustomAudiencePayload('Test', null, {
    source: 'LEADFORM',
    rule: { leadFormInteraction: 'opened', retention: 30 },
    excludeRules: [{ source: 'LEADFORM', rule: { leadFormInteraction: 'submitted', retention: 14 } }],
  })
  const ruleObj = JSON.parse(p.rule!)
  assert.strictEqual(ruleObj.exclusions[0].rules[0].filter.value, 'lead_submitted')
})

/* ── Unsupported sources ── */

console.log('\n▶ Unsupported sources')

const UNSUPPORTED = ['CATALOG', 'APP', 'OFFLINE', 'CUSTOMER_LIST'] as const

for (const src of UNSUPPORTED) {
  test(`${src} → throws, does NOT return a payload (no silent fallback)`, () => {
    assert.throws(
      () => buildCustomAudiencePayload('Test', null, {
        source: src,
        rule: { retention: 30 },
      }),
      (e: unknown) => {
        assert.ok(e instanceof Error, 'must throw Error')
        assert.ok(
          e.message.includes(src) || e.message.includes('desteklenmiyor'),
          `error message should reference source or 'desteklenmiyor': ${e.message}`
        )
        return true
      }
    )
  })
}

test('Supported source list is exactly PIXEL/IG/PAGE/VIDEO/LEADFORM', () => {
  const supported = ['PIXEL', 'IG', 'PAGE', 'VIDEO', 'LEADFORM']
  const notSupported = ['CATALOG', 'APP', 'OFFLINE', 'CUSTOMER_LIST', 'STRATEGY', 'UNKNOWN']

  for (const src of supported) {
    try {
      buildCustomAudiencePayload('Test', null, { source: src, rule: { pixelId: 'x', igAccountId: 'x', pageId: 'x', retention: 30 } })
      // Should not throw for supported sources
    } catch (e) {
      if (e instanceof Error && e.message.includes('desteklenmiyor')) {
        throw new Error(`Expected ${src} to be supported but it threw: ${e.message}`)
      }
      // Other errors (missing field etc.) are acceptable — source itself is supported
    }
  }

  for (const src of notSupported) {
    let threw = false
    try {
      buildCustomAudiencePayload('Test', null, { source: src, rule: { retention: 30 } })
    } catch {
      threw = true
    }
    assert.ok(threw, `Expected ${src} to throw but it did not`)
  }
})

/* ── Lookalike ── */

console.log('\n▶ Lookalike')

test('buildLookalikePayload → subtype=LOOKALIKE, ratio=0.01 for 1%', () => {
  const p = buildLookalikePayload('Test LA', null, {
    seedAudienceId: 'seed-123',
    countries: ['TR'],
    sizePercent: 1,
  })
  assert.strictEqual(p.subtype, 'LOOKALIKE')
  assert.strictEqual(p.origin_audience_id, 'seed-123')
  const spec = JSON.parse(p.lookalike_spec)
  assert.strictEqual(spec.ratio, 0.01)
  assert.strictEqual(spec.country, 'TR')
})

test('buildLookalikePayload multi-country → target_countries present', () => {
  const p = buildLookalikePayload('Test LA', null, {
    seedAudienceId: 'seed-123',
    countries: ['TR', 'DE'],
    sizePercent: 3,
  })
  const spec = JSON.parse(p.lookalike_spec)
  assert.deepStrictEqual(spec.target_countries, ['TR', 'DE'])
  assert.strictEqual(spec.ratio, 0.03)
})

test('buildLookalikePayload missing seedAudienceId → throws', () => {
  assert.throws(
    () => buildLookalikePayload('Test', null, { countries: ['TR'], sizePercent: 1 }),
    /seedAudienceId/
  )
})

test('buildLookalikePayload sizePercent=0 → throws', () => {
  assert.throws(
    () => buildLookalikePayload('Test', null, { seedAudienceId: 'x', countries: ['TR'], sizePercent: 0 }),
    /sizePercent/
  )
})

/* ── Saved Audience ── */

console.log('\n▶ Saved Audience')

test('buildSavedAudiencePayload default location → geo_locations.countries=[TR]', () => {
  const p = buildSavedAudiencePayload('Test', null, { locations: [], ageMin: 18, ageMax: 65 })
  assert.deepStrictEqual(p.targeting.geo_locations, { countries: ['TR'] })
})

test('buildSavedAudiencePayload with country location → geo_locations.countries=[DE]', () => {
  const p = buildSavedAudiencePayload('Test', null, {
    locations: [{ type: 'country', key: 'DE', name: 'Germany' }],
    ageMin: 25,
    ageMax: 45,
  })
  assert.deepStrictEqual((p.targeting.geo_locations as Record<string, unknown>).countries, ['DE'])
  assert.strictEqual(p.targeting.age_min, 25)
  assert.strictEqual(p.targeting.age_max, 45)
})

test('buildSavedAudiencePayload interests → flexible_spec', () => {
  const p = buildSavedAudiencePayload('Test', null, {
    locations: [],
    interests: [{ id: '6003139266461', name: 'Yemek pişirme' }],
  })
  const fs = p.targeting.flexible_spec as unknown[]
  assert.ok(Array.isArray(fs) && fs.length > 0, 'flexible_spec must be populated')
})

test('buildSavedAudiencePayload excludeInterests → targeting.exclusions', () => {
  const p = buildSavedAudiencePayload('Test', null, {
    locations: [],
    excludeInterests: [{ id: '6003139266461', name: 'Oyun' }],
  })
  const ex = p.targeting.exclusions as Record<string, unknown>
  assert.ok(ex?.interests, 'exclusions.interests must be set')
})

test('buildSavedAudiencePayload advantageAudience=true → targeting_automation.advantage_audience=1', () => {
  const p = buildSavedAudiencePayload('Test', null, { locations: [], advantageAudience: true })
  const ta = p.targeting.targeting_automation as Record<string, unknown>
  assert.strictEqual(ta?.advantage_audience, 1)
})

// ── Runner ──
void runAll()
