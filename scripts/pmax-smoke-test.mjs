#!/usr/bin/env node
/**
 * PMax create smoke test.
 * Requires: .env.local with SUPABASE_*, ADMIN_SECRET, GOOGLE_ADS_* (or active DB connection)
 * Run: node scripts/pmax-smoke-test.mjs
 * Prerequisites: npm run dev (server running) for real create; or use --dry-run to validate payload only.
 *
 * Minimal valid images (aspect ratios):
 * - Marketing: 1.91:1 landscape (e.g. 1200x628)
 * - Logo: 1:1 square (e.g. 1200x1200)
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

try {
  const envPath = resolve(process.cwd(), '.env.local')
  const env = readFileSync(envPath, 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch {}

const BASE_URL = process.env.PMAX_SMOKE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const ADMIN_SECRET = process.env.ADMIN_SECRET
const DRY_RUN = process.argv.includes('--dry-run')
const DO_VERIFY = process.argv.includes('--verify')

/** Minimal valid PMax payload. Uses placehold.co for exact aspect ratios. */
const MINIMAL_PAYLOAD = {
  advertisingChannelType: 'PERFORMANCE_MAX',
  campaignName: `PMax Smoke Test ${Date.now()}`,
  dailyBudgetMicros: 1_000_000,
  biddingStrategy: 'MAXIMIZE_CONVERSIONS',
  locationTargetingMode: 'PRESENCE_OR_INTEREST',
  containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
  finalUrl: 'https://example.com',
  finalUrlExpansionEnabled: false,
  assetGroup: {
    name: 'Smoke Asset Group',
    businessName: 'Smoke Business',
    headlines: ['H1', 'H2', 'H3'],
    longHeadlines: ['Long headline for PMax'],
    descriptions: ['Desc 1', 'Desc 2'],
    images: [{ url: 'https://placehold.co/1200x628/png', name: 'Marketing' }],
    logos: [{ url: 'https://placehold.co/1200x1200/png', name: 'Logo' }],
    videos: [],
  },
  signals: {
    searchThemes: [{ text: 'test' }],
    selectedAudienceSegments: [],
    audienceMode: 'OBSERVATION',
  },
}

async function runSmokeTest() {
  console.log('PMax smoke test')
  console.log('---')
  if (DRY_RUN) {
    console.log('Mode: dry-run (no API call)')
    console.log('Payload:', JSON.stringify(MINIMAL_PAYLOAD, null, 2))
    console.log('OK: minimal payload valid')
    return
  }

  if (!ADMIN_SECRET) {
    console.error('ADMIN_SECRET missing in .env.local. Cannot run real smoke test.')
    console.error('Use --dry-run to validate payload only.')
    process.exit(1)
  }

  const url = `${BASE_URL}/api/integrations/google-ads/campaigns/create-performance-max`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Smoke-Test': ADMIN_SECRET,
    },
    body: JSON.stringify(MINIMAL_PAYLOAD),
  })

  const data = await res.json()

  if (!res.ok) {
    console.error('FAIL: API returned', res.status, data)
    process.exit(1)
  }

  if (!data.campaignResourceName || !data.assetGroupResourceName) {
    console.error('FAIL: Missing campaignResourceName or assetGroupResourceName', data)
    process.exit(1)
  }

  console.log('OK: campaignResourceName:', data.campaignResourceName)
  console.log('OK: assetGroupResourceName:', data.assetGroupResourceName)
  if (data.conversionGoalsWarning) {
    console.log('WARN:', data.conversionGoalsWarning)
  }

  if (DO_VERIFY) {
    const verifyUrl =
      `${BASE_URL}/api/admin/pmax-verify` +
      `?campaignResourceName=${encodeURIComponent(data.campaignResourceName)}` +
      `&assetGroupResourceName=${encodeURIComponent(data.assetGroupResourceName)}`
    const vRes = await fetch(verifyUrl, {
      headers: { 'x-admin-secret': ADMIN_SECRET },
    })
    const vData = await vRes.json()
    if (!vRes.ok) {
      console.error('Verify FAIL:', vData)
      process.exit(1)
    }
    console.log('Post-create parity:', vData)
    if (!vData.campaignExists || !vData.assetGroupExists || !vData.assetGroupLinked) {
      console.error('FAIL: parity check failed')
      process.exit(1)
    }
  }

  console.log('---')
  console.log('PMax smoke test passed.')
}

runSmokeTest().catch((e) => {
  console.error('Smoke test error:', e.message)
  process.exit(1)
})
