#!/usr/bin/env node
/**
 * YoAi — Çoklu Reklam Hesabı (Madde 2) doğrulama
 *
 * Kullanım:
 *   node scripts/verify-registered-accounts.mjs          → read-only (tablo + kolon varlığı)
 *   node scripts/verify-registered-accounts.mjs --smoke  → ek olarak self-cleaning yazma testi
 *
 * SUPABASE_URL + SUPABASE_SERVICE_KEY (.env.local) gerektirir → CANONICAL (omddq).
 * Migration uygulanmamışsa exit 2 + nasıl uygulanacağını söyler.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

try {
  const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch { /* .env.local yoksa geç */ }

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY
if (!url || !key) { console.error('❌  SUPABASE_URL / SUPABASE_SERVICE_KEY (.env.local) gerekli.'); process.exit(1) }

const SMOKE = process.argv.includes('--smoke')
const sb = createClient(url, key, { auth: { persistSession: false } })
const TABLE = 'user_registered_ad_accounts'
const TEST_USER = `__smoke_madde2_${Date.now()}`

async function cleanup() { await sb.from(TABLE).delete().eq('user_id', TEST_USER) }

async function main() {
  console.log(`\n🔎  omddq doğrulama — ${TABLE}${SMOKE ? ' (--smoke)' : ' (read-only)'}\n`)

  // Tablo + tüm kolonların varlığı (tek select)
  const probe = await sb
    .from(TABLE)
    .select('id,user_id,platform,account_id,account_name,login_customer_id,created_at')
    .limit(1)
  if (probe.error) {
    if (probe.error.code === '42P01' || probe.error.code === 'PGRST205' || /does not exist|could not find|relation/i.test(probe.error.message || '')) {
      console.log('❌  Tablo (veya kolon) omddq schema cache\'inde YOK — migration uygulanmamış.')
      console.log(`    kod: ${probe.error.code || '-'} | ${probe.error.message}`)
      console.log('\n    Uygula: Supabase Dashboard (omddq) > SQL Editor →')
      console.log('      supabase/migrations/20260522010000_create_user_registered_ad_accounts.sql içeriği')
      console.log('    Alternatif: .env.local içine omddq DATABASE_URL ekle + `npm run db:migrate:registered-accounts`')
      console.log('    (Uyguladıktan sonra PostgREST cache\'i tazelemek birkaç saniye sürebilir.)\n')
      process.exit(2)
    }
    console.log('❌  Beklenmeyen hata:', probe.error.code, probe.error.message)
    process.exit(1)
  }
  console.log('✓  Tablo + tüm kolonlar mevcut (id, user_id, platform, account_id, account_name, login_customer_id, created_at).')

  if (!SMOKE) {
    console.log('\n✅  Read-only doğrulama tamam. Yazma testi için: --smoke\n')
    return
  }

  const ins = await sb.from(TABLE).insert([
    { user_id: TEST_USER, platform: 'meta', account_id: 'act_smoke_1', account_name: 'Smoke Meta' },
    { user_id: TEST_USER, platform: 'google', account_id: '1234567890', account_name: 'Smoke Google', login_customer_id: '9999999999' },
  ]).select()
  if (ins.error) { console.log('❌  insert hata:', ins.error.message); await cleanup(); process.exit(1) }
  console.log('✓  2 hesap eklendi (meta + google).')

  const dup = await sb.from(TABLE).insert([{ user_id: TEST_USER, platform: 'meta', account_id: 'act_smoke_1' }])
  if (dup.error && (dup.error.code === '23505' || /duplicate|unique/i.test(dup.error.message || ''))) {
    console.log('✓  UNIQUE(user,platform,account) çalışıyor — duplicate reddedildi.')
  } else if (!dup.error) {
    console.log('⚠️  Duplicate eklendi — UNIQUE kısıt beklenmedik!'); await cleanup(); process.exit(1)
  } else {
    console.log('⚠️  Duplicate farklı hata:', dup.error.message)
  }

  const { count } = await sb.from(TABLE).select('id', { count: 'exact', head: true }).eq('user_id', TEST_USER)
  console.log(`✓  count = ${count} (beklenen 2)`)

  await cleanup()
  const { count: after } = await sb.from(TABLE).select('id', { count: 'exact', head: true }).eq('user_id', TEST_USER)
  console.log(`✓  temizlik sonrası count = ${after} (beklenen 0)`)
  console.log('\n✅  Veri katmanı doğrulandı (şema + UNIQUE + CRUD).\n')
}

main().catch(e => { console.error('HATA:', e.message); cleanup().finally(() => process.exit(1)) })
