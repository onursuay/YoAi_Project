#!/usr/bin/env node
/**
 * YoAi — CRM Faz 1 Migration Uygulayıcı
 *
 * Uygular:
 *   20260530000000_create_crm_tables.sql
 *     - crm_page_subscriptions (webhook page_id → user_id eşlemesi)
 *     - crm_leads (Meta Lead Ads → CRM, status: new|positive|negative)
 *
 * ⚠️  ÖNEMLİ: Bu migration CANONICAL Supabase projesine (omddq) uygulanmalı.
 *     Kod tablolar olmadan da GÜVENLİ çalışır (store'lar boş liste/null döner,
 *     webhook ingest "no subscription" ile atlar — crash YOK). Lead toplamaya
 *     başlamadan önce migration uygulanmalı + CRM'den bir Facebook sayfası
 *     bağlanmalı.
 *
 * Kullanım:
 *   node scripts/apply-crm-migration.mjs
 *
 * Gerekli env (.env.local):
 *   DATABASE_URL — Supabase Dashboard > Project Settings > Database
 *                  > Connection string (URI) > Transaction mode (port 6543)
 *                  → CANONICAL proje (omddq) bağlantısı olmalı.
 *
 * Alternatif: SQL'i doğrudan Supabase Dashboard > SQL Editor'de (omddq projesi)
 * çalıştır — migration idempotenttir (IF NOT EXISTS), tekrar çalıştırmak güvenli.
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

const FILE = 'supabase/migrations/20260530000000_create_crm_tables.sql'

async function main() {
  console.log('\n🚀  YoAi — CRM Faz 1 Migration\n')
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    const sql = readFileSync(resolve(ROOT, FILE), 'utf8')
    console.log(`▶  ${FILE}`)
    client.on('notice', msg => { if (msg.message) console.log(`   ℹ  ${msg.message}`) })
    await client.query(sql)
    console.log('   ✓  Başarılı\n')
    console.log('✅  Migration uygulandı. Doğrulama (psql/SQL Editor):')
    console.log("     SELECT to_regclass('public.crm_page_subscriptions'), to_regclass('public.crm_leads');\n")
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
