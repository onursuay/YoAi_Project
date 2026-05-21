#!/usr/bin/env node
/**
 * YoAlgoritma — Hiyerarşik Geliştirme Tabloları Migration Uygulayıcı (Faz 3)
 *
 * Uygular:
 *   1. 20260520010000_create_hierarchical_improvements.sql
 *      (account_alerts, campaign_improvements, adset_improvements,
 *       ad_improvements + RLS + touch trigger'ları)
 *
 * Kullanım:
 *   node scripts/apply-hierarchical-improvements-migration.mjs
 *   # veya:  npm run db:migrate:hierarchical
 *
 * Gerekli env (.env.local):
 *   DATABASE_URL — Supabase Dashboard > Project Settings > Database
 *                  > Connection string (URI) > Transaction mode (port 6543)
 *                  ⚠️ CANONICAL PROJE = omddqhcvhxvzrizehnzw (fbqr ÖLÜ — kullanma).
 *
 * Tümü additive + idempotent — tekrar çalıştırmak güvenlidir.
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
  console.error('   .env.local dosyasına CANONICAL (omddq) projenin bağlantı dizisini ekle:')
  console.error('   DATABASE_URL=postgresql://postgres.omddqhcvhxvzrizehnzw:[ŞİFRE]@aws-0-[region].pooler.supabase.com:6543/postgres\n')
  process.exit(1)
}

// Güvenlik kontrolü: ölü fbqr projesine yanlışlıkla uygulama
if (DATABASE_URL.includes('fbqrhyxbdeejfcwsgixr')) {
  console.error('\n❌  DATABASE_URL ÖLÜ fbqr projesine işaret ediyor. omddq kullan.\n')
  process.exit(1)
}

const MIGRATIONS = [
  {
    label: '[1/1] account_alerts + campaign_improvements + adset_improvements + ad_improvements',
    file:  'supabase/migrations/20260520010000_create_hierarchical_improvements.sql',
  },
]

async function main() {
  console.log('\n🚀  Hiyerarşik Geliştirme Tabloları Migration Başlıyor...\n')

  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  client.on('notice', msg => {
    if (msg.message) console.log(`   ℹ  ${msg.message}`)
  })

  try {
    for (const { label, file } of MIGRATIONS) {
      const path = resolve(ROOT, file)
      const sql  = readFileSync(path, 'utf8')
      console.log(`▶  ${label}`)
      console.log(`   Dosya: ${file}`)
      await client.query(sql)
      console.log(`   ✓  Başarılı\n`)
    }

    // Doğrulama: 4 tablo gerçekten oluştu mu?
    const { rows } = await client.query(
      `SELECT
         to_regclass('public.account_alerts')        AS account_alerts,
         to_regclass('public.campaign_improvements')  AS campaign_improvements,
         to_regclass('public.adset_improvements')     AS adset_improvements,
         to_regclass('public.ad_improvements')        AS ad_improvements`,
    )
    const r = rows[0] || {}
    console.log('   Doğrulama:')
    console.log(`     account_alerts        = ${r.account_alerts ?? 'YOK'}`)
    console.log(`     campaign_improvements = ${r.campaign_improvements ?? 'YOK'}`)
    console.log(`     adset_improvements    = ${r.adset_improvements ?? 'YOK'}`)
    console.log(`     ad_improvements       = ${r.ad_improvements ?? 'YOK'}\n`)

    const allOk = r.account_alerts && r.campaign_improvements && r.adset_improvements && r.ad_improvements
    if (!allOk) {
      console.error('❌  Bazı tablolar oluşmadı — yukarıya bak.\n')
      process.exit(1)
    }

    console.log('✅  Migration tamamlandı.\n')
  } finally {
    await client.end()
  }
}

main().catch(err => {
  console.error('\n❌  Migration başarısız:', err.message)
  process.exit(1)
})
