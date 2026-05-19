#!/usr/bin/env node
/**
 * YoAlgoritma AI Engine — Migration Uygulayıcı
 *
 * Uygular:
 *   1. 20260519000000_create_ai_engine_tables.sql
 *      (ai_engine_runs, ai_alerts, ai_opportunities, ai_suggestions
 *       + RLS + touch trigger)
 *
 * Kullanım:
 *   node scripts/apply-ai-engine-migration.mjs
 *   # veya:  npm run db:migrate:ai-engine
 *
 * Gerekli env:
 *   DATABASE_URL — Supabase Dashboard > Project Settings > Database
 *                  > Connection string (URI) > Transaction mode (port 6543)
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
  console.error('   .env.local dosyasına şunu ekle:')
  console.error('   DATABASE_URL=postgresql://postgres.[ref]:[ŞİFRE]@aws-0-[region].pooler.supabase.com:6543/postgres\n')
  process.exit(1)
}

const MIGRATIONS = [
  {
    label: '[1/1] AI Engine tabloları (runs/alerts/opportunities/suggestions) + RLS + trigger',
    file:  'supabase/migrations/20260519000000_create_ai_engine_tables.sql',
  },
]

async function main() {
  console.log('\n🚀  YoAlgoritma AI Engine Migration Başlıyor...\n')

  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    for (const { label, file } of MIGRATIONS) {
      const path = resolve(ROOT, file)
      const sql  = readFileSync(path, 'utf8')

      console.log(`▶  ${label}`)
      console.log(`   Dosya: ${file}`)

      client.on('notice', msg => {
        if (msg.message) console.log(`   ℹ  ${msg.message}`)
      })

      await client.query(sql)
      console.log(`   ✓  Başarılı\n`)
    }

    console.log('✅  AI Engine migration tamamlandı.\n')
    console.log('   Sonraki adım: ANTHROPIC_API_KEY ve USE_AI_ENGINE=true Vercel env\'e ekle.\n')

  } finally {
    await client.end()
  }
}

main().catch(err => {
  console.error('\n❌  Migration başarısız:', err.message)
  process.exit(1)
})
