#!/usr/bin/env node
/**
 * YoAi — SEO site_content_briefs migration uygulayıcı.
 * Additive + idempotent. CANONICAL (omddq) projeye uygulanır.
 * Gerekli env (.env.local): DATABASE_URL (Transaction mode, port 6543).
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import pg from 'pg'

const { Client } = pg
const ROOT = process.cwd()
try {
  const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch {}

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!DATABASE_URL) {
  console.error('\n❌  DATABASE_URL bulunamadı (.env.local). omddq Transaction mode (6543) bağlantısı gerekli.')
  console.error('   Alternatif: SQL\'i Supabase Dashboard > SQL Editor (omddq) içine yapıştır.\n')
  process.exit(1)
}
const FILE = 'supabase/migrations/20260603000000_site_content_briefs.sql'
async function main() {
  console.log('\n🚀  SEO site_content_briefs migration\n')
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    const sql = readFileSync(resolve(ROOT, FILE), 'utf8')
    console.log(`▶  ${FILE}`)
    await client.query(sql)
    console.log('   ✓  Başarılı\n')
  } finally {
    await client.end()
  }
}
main().catch((err) => { console.error('\n❌  Migration başarısız:', err.message); process.exit(1) })
