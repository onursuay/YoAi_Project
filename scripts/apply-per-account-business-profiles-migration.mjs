#!/usr/bin/env node
/**
 * YoAi — Çoklu İşletme (Per-Account Business Profiles) Migration Uygulayıcı — Faz 0
 *
 * Uygular:
 *   20260524000000_per_account_business_profiles.sql
 *     - user_business_profiles: business_key / meta_account_id / google_customer_id (NULLABLE)
 *     - user_business_intelligence: business_key (NULLABLE)
 *     - account_alerts: account_id / business_key (NULLABLE)
 *     + lookup indeksleri
 *
 * ⚠️  CANONICAL Supabase projesine (omddq) uygulanmalı.
 *     Tümü additive (ADD COLUMN IF NOT EXISTS) → idempotent, geriye dönük
 *     uyumlu. UNIQUE(user_id) DEĞİŞTİRİLMEZ. Uygulanmadan da sistem çalışır
 *     (Faz 1 kodu kolonları yalnız YOAI_PER_ACCOUNT_SCOPE flag'i açıkken kullanır).
 *
 * Kullanım:
 *   node scripts/apply-per-account-business-profiles-migration.mjs
 *
 * Gerekli env (.env.local):
 *   DATABASE_URL — Supabase Dashboard > Project Settings > Database
 *                  > Connection string (URI) > Transaction mode (port 6543)
 *                  → CANONICAL proje (omddq) bağlantısı olmalı.
 *
 * Alternatif: SQL'i doğrudan Supabase Dashboard > SQL Editor'de (omddq projesi)
 * çalıştır — migration idempotenttir, tekrar çalıştırmak güvenlidir.
 */

import { readFileSync } from 'fs'
import { resolve }      from 'path'
import pg               from 'pg'

const { Client } = pg
const ROOT = process.cwd()

try {
  const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch { /* .env.local yoksa geç */ }

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL

if (!DATABASE_URL) {
  console.error('\n❌  DATABASE_URL bulunamadı.\n')
  console.error('   .env.local dosyasına CANONICAL (omddq) bağlantı stringini ekle:')
  console.error('   DATABASE_URL=postgresql://postgres.[ref]:[ŞİFRE]@aws-0-[region].pooler.supabase.com:6543/postgres\n')
  console.error('   Alternatif: SQL\'i Supabase Dashboard > SQL Editor (omddq) içine yapıştırıp çalıştır.\n')
  process.exit(1)
}

const FILE = 'supabase/migrations/20260524000000_per_account_business_profiles.sql'

async function main() {
  console.log('\n🚀  YoAi — Çoklu İşletme (Faz 0) Migration\n')
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    const sql = readFileSync(resolve(ROOT, FILE), 'utf8')
    console.log(`▶  ${FILE}`)
    client.on('notice', msg => { if (msg.message) console.log(`   ℹ  ${msg.message}`) })
    await client.query(sql)
    console.log('   ✓  Başarılı\n')
    console.log('✅  Migration uygulandı. Doğrulama (SQL Editor):')
    console.log("     SELECT column_name FROM information_schema.columns")
    console.log("     WHERE table_name='account_alerts' AND column_name IN ('account_id','business_key');\n")
  } catch (err) {
    console.error(`   ✗  Başarısız: ${err.message}\n`)
    throw err
  } finally {
    await client.end()
  }
}

main().catch(err => {
  console.error('\n❌  Migration başarısız:', err.message)
  process.exit(1)
})
