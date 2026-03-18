#!/usr/bin/env node
/**
 * Verify VERCEL_API_TOKEN against Edge Config API.
 * Reads .env.local. Run: node scripts/verify-edge-config-api.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv(path) {
  const content = readFileSync(path, 'utf8')
  const env = {}
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m) {
      let v = m[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').trim()
      env[m[1]] = v
    }
  }
  return env
}

const env = loadEnv(resolve(process.cwd(), '.env.local'))
const token = env.VERCEL_API_TOKEN?.trim()
const teamId = env.VERCEL_TEAM_ID?.trim()
const configId = env.AUDIENCE_EDGE_CONFIG_ID?.trim()

console.log('[VERIFY] tokenPresent:', !!token, 'tokenLength:', token?.length ?? 0, 'tokenPrefix:', token ? token.slice(0, 4) + '...' : 'none')
console.log('[VERIFY] teamIdPresent:', !!teamId, 'configId:', configId || 'none')

if (!token) {
  console.error('[VERIFY] VERCEL_API_TOKEN not in .env.local. Add it temporarily to run this check.')
  process.exit(1)
}

const base = 'https://api.vercel.com/v1/edge-config'
const listUrl = teamId ? `${base}?teamId=${teamId}` : base

console.log('\n1) GET', listUrl)
const r1 = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } })
const body1 = await r1.json().catch(() => ({}))
console.log('   Status:', r1.status)
console.log('   Response:', JSON.stringify(body1, null, 2).slice(0, 800))

let existsInList = false
if (r1.ok && Array.isArray(body1)) {
  existsInList = body1.some(c => c.id === configId)
  console.log('   Config in list:', existsInList ? 'YES' : 'NO')
} else if (r1.ok && body1.edgeConfigs) {
  existsInList = (body1.edgeConfigs || []).some(c => c.id === configId)
  console.log('   Config in list:', existsInList ? 'YES' : 'NO')
}

if (configId && (r1.ok || !existsInList)) {
  console.log('\n2) GET', `${base}/${configId}${teamId ? '?teamId=' + teamId : ''}`)
  const detailUrl = teamId ? `${base}/${configId}?teamId=${teamId}` : `${base}/${configId}`
  const r2 = await fetch(detailUrl, { headers: { Authorization: `Bearer ${token}` } })
  const body2 = await r2.json().catch(() => ({}))
  console.log('   Status:', r2.status)
  console.log('   Response:', JSON.stringify(body2, null, 2).slice(0, 500))
}
