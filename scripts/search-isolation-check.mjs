#!/usr/bin/env node
/**
 * Search flow isolation check.
 * Verifies that Search create uses separate route & lib from PMax.
 * PMax changes must NOT touch Search. Run after any PMax changes.
 *
 * Routes:
 * - Search: POST /api/integrations/google-ads/campaigns/create (createFullCampaign)
 * - PMax:   POST /api/integrations/google-ads/campaigns/create-performance-max (createPerformanceMaxCampaign)
 *
 * Run: node scripts/search-isolation-check.mjs
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(process.cwd())

function read(path) {
  return readFileSync(resolve(ROOT, path), 'utf8')
}

const searchRoute = read('app/api/integrations/google-ads/campaigns/create/route.ts')
const pmaxRoute = read('app/api/integrations/google-ads/campaigns/create-performance-max/route.ts')
const createCampaign = read('lib/google-ads/create-campaign.ts')
const createPmax = read('lib/google-ads/create-performance-max-campaign.ts')

const checks = []

// Search route must use createFullCampaign, NOT createPerformanceMaxCampaign
checks.push({
  name: 'Search route uses createFullCampaign',
  ok: searchRoute.includes('createFullCampaign') && !searchRoute.includes('createPerformanceMaxCampaign'),
})

// PMax route must use createPerformanceMaxCampaign, NOT createFullCampaign
checks.push({
  name: 'PMax route uses createPerformanceMaxCampaign',
  ok: pmaxRoute.includes('createPerformanceMaxCampaign') && !pmaxRoute.includes('createFullCampaign'),
})

// Search route must NOT import create-performance-max-campaign
checks.push({
  name: 'Search route does not import PMax lib',
  ok: !searchRoute.includes('create-performance-max-campaign'),
})

// create-campaign.ts must export createFullCampaign (Search flow)
checks.push({
  name: 'create-campaign exports createFullCampaign',
  ok: createCampaign.includes('createFullCampaign') || createCampaign.includes('export async function createFullCampaign'),
})

// create-performance-max-campaign must NOT call createFullCampaign
checks.push({
  name: 'PMax lib does not call createFullCampaign',
  ok: !createPmax.includes('createFullCampaign'),
})

let failed = 0
for (const c of checks) {
  const s = c.ok ? 'OK' : 'FAIL'
  console.log(`[${s}] ${c.name}`)
  if (!c.ok) failed++
}

if (failed > 0) {
  console.log('---')
  console.error('Search isolation check FAILED')
  process.exit(1)
}

console.log('---')
console.log('Search flow isolation OK. PMax changes did not affect Search.')
