#!/usr/bin/env node
/**
 * Apply google_ads_connections migration to Supabase.
 * Requires: DATABASE_URL (Supabase connection string from Project Settings > Database)
 * Or run SQL manually: https://supabase.com/dashboard/project/fbqrhyxbdeejfcwsgixr/sql/new
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import pg from 'pg'

const { Client } = pg

try {
  const envPath = resolve(process.cwd(), '.env.local')
  const env = readFileSync(envPath, 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch {}

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
const MIGRATION_PATH = resolve(process.cwd(), 'supabase/migrations/20260315000000_create_google_ads_connections.sql')

async function main() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set. Add to .env.local:')
    console.error('  DATABASE_URL=postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres')
    console.error('Get it from: Supabase Dashboard > Project Settings > Database > Connection string (URI)')
    console.error('Or run SQL manually: https://supabase.com/dashboard/project/fbqrhyxbdeejfcwsgixr/sql/new')
    process.exit(1)
  }

  const sql = readFileSync(MIGRATION_PATH, 'utf8')
  const client = new Client({ connectionString: DATABASE_URL })
  try {
    await client.connect()
    await client.query(sql)
    console.log('Migration applied: google_ads_connections table created')
  } catch (e) {
    console.error('Migration failed:', e.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
