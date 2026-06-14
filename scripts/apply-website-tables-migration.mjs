#!/usr/bin/env node
/**
 * YoAi — Web Site Yöneticisi temel tablolar migration uygulayıcı.
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
const FILE = 'supabase/migrations/20260614120000_create_website_tables.sql'

/**
 * connectionString parser'ı URL-encode edilmemiş özel karakterlerde (ör. şifrede `#`)
 * "Invalid URL" verir. Bu yüzden URL'i bileşenlerine ayırıp ham şifreyi pg'ye doğrudan veriyoruz.
 */
function makeClient(url) {
  const m = url.match(/^postgres(?:ql)?:\/\/([^:@/]+):([\s\S]+)@([^@/]+)\/([^?]+)(?:\?.*)?$/)
  if (!m) return new Client({ connectionString: url, ssl: { rejectUnauthorized: true } })
  const [, user, password, hostPort, database] = m
  const li = hostPort.lastIndexOf(':')
  const host = li >= 0 ? hostPort.slice(0, li) : hostPort
  const port = li >= 0 ? Number(hostPort.slice(li + 1)) : 5432
  return new Client({ host, port, user, password, database, ssl: { rejectUnauthorized: true } })
}

async function main() {
  console.log('\n🚀  Web Site Yöneticisi temel tablolar migration\n')
  const client = makeClient(DATABASE_URL)
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
main().catch((e) => { console.error('❌ ', e.message); process.exit(1) })
