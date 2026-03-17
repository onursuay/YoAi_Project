#!/usr/bin/env node
/**
 * Production readiness verification for Google Ads DB persistence + audience refresh.
 * Run: node scripts/verify-google-ads-prod.mjs
 * Requires: .env.local with SUPABASE_*, ADMIN_SECRET, optionally GOOGLE_ADS_*
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

try {
  const envPath = resolve(process.cwd(), '.env.local')
  const env = readFileSync(envPath, 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch {}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_SECRET = process.env.ADMIN_SECRET
const BASE_URL = process.env.VERIFY_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const results = {
  migrationApplied: null,
  tableExists: null,
  adminSecretPresent: null,
  activeDbConnection: null,
  adminRefresh: null,
  audienceBrowse: null,
  audienceSearch: null,
  blocker: null,
}

async function checkMigration() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    results.migrationApplied = 'no'
    results.blocker = 'SUPABASE_URL or SUPABASE_SERVICE_KEY missing'
    return
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data, error } = await supabase
    .from('google_ads_connections')
    .select('id')
    .limit(1)
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      results.migrationApplied = 'no'
      results.tableExists = 'no'
      results.blocker = 'Table google_ads_connections does not exist. Run: Supabase Dashboard > SQL Editor > paste supabase/migrations/20260315000000_create_google_ads_connections.sql'
    } else {
      results.migrationApplied = 'unknown'
      results.tableExists = 'unknown'
      results.blocker = `DB error: ${error.message}`
    }
    return
  }
  results.migrationApplied = 'yes'
  results.tableExists = 'yes'
}

async function checkActiveConnection() {
  if (results.migrationApplied !== 'yes') return
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data, error } = await supabase
    .from('google_ads_connections')
    .select('id, user_id, status')
    .eq('status', 'active')
    .not('google_ads_refresh_token', 'is', null)
    .not('google_ads_customer_id', 'is', null)
    .limit(1)
  if (error) {
    results.activeDbConnection = 'no'
    results.blocker = results.blocker || `DB query failed: ${error.message}`
    return
  }
  results.activeDbConnection = data?.length > 0 ? 'yes' : 'no'
}

async function checkAdminRefresh() {
  if (!ADMIN_SECRET) {
    results.adminRefresh = { ok: false, error: 'ADMIN_SECRET not set' }
    return
  }
  try {
    const res = await fetch(`${BASE_URL}/api/admin/google-audiences/refresh`, {
      method: 'POST',
      headers: { 'x-admin-secret': ADMIN_SECRET, 'Content-Type': 'application/json' },
    })
    const body = await res.json().catch(() => ({}))
    results.adminRefresh = {
      status: res.status,
      ok: body.ok === true,
      code: body.code,
      error: body.error,
    }
  } catch (e) {
    results.adminRefresh = { ok: false, error: e.message }
    if (!results.blocker) results.blocker = `Admin refresh unreachable: ${e.message}`
  }
}

async function checkAudienceBrowse() {
  try {
    const res = await fetch(`${BASE_URL}/api/integrations/google-ads/tools/audience-segments?mode=browse`)
    const body = await res.json().catch(() => ({}))
    const hasData = body.affinity?.length > 0 || body.inMarket?.length > 0 || body.data_not_ready === false
    results.audienceBrowse = {
      status: res.status,
      dataNotReady: body.data_not_ready === true,
      hasData: !!hasData,
    }
  } catch (e) {
    results.audienceBrowse = { error: e.message }
  }
}

async function checkAudienceSearch() {
  try {
    const res = await fetch(`${BASE_URL}/api/integrations/google-ads/tools/audience-segments?mode=search&q=teknoloji`)
    const body = await res.json().catch(() => ({}))
    results.audienceSearch = {
      status: res.status,
      dataNotReady: body.data_not_ready === true,
      resultsCount: Array.isArray(body.results) ? body.results.length : 0,
    }
  } catch (e) {
    results.audienceSearch = { error: e.message }
  }
}

async function main() {
  results.adminSecretPresent = !!ADMIN_SECRET?.trim() ? 'yes' : 'no'
  await checkMigration()
  await checkActiveConnection()
  await checkAdminRefresh()
  await checkAudienceBrowse()
  await checkAudienceSearch()
  // Output format per QA spec
  console.log('--- VERIFICATION OUTPUT ---')
  console.log('migration applied:', results.migrationApplied ?? 'no')
  console.log('table exists:', results.tableExists ?? 'no')
  console.log('admin_secret present:', results.adminSecretPresent)
  console.log('active DB connection exists:', results.activeDbConnection ?? 'no')
  console.log('admin refresh result:', JSON.stringify(results.adminRefresh))
  console.log('audience browse result:', JSON.stringify(results.audienceBrowse))
  console.log('audience search result:', JSON.stringify(results.audienceSearch))
  console.log('final blocker:', results.blocker ?? 'none')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
