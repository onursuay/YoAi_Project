/**
 * One-time migration: creates google_ads_connections table.
 * Protected by x-admin-secret. Requires DATABASE_URL in env.
 */

import { NextRequest, NextResponse } from 'next/server'
import pg from 'pg'

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS google_ads_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  provider text NOT NULL DEFAULT 'google_ads',
  google_ads_refresh_token text,
  google_ads_customer_id text,
  google_ads_login_customer_id text,
  token_scope text,
  connected_email text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_connected_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_ads_connections_user
  ON google_ads_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_connections_status
  ON google_ads_connections (status) WHERE status = 'active';

COMMENT ON TABLE google_ads_connections IS 'Persistent Google Ads OAuth context per user (session_id).';
`.trim()

export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret?.trim()) {
    return NextResponse.json({ ok: false, error: 'ADMIN_SECRET not configured' }, { status: 503 })
  }
  const headerSecret = req.headers.get('x-admin-secret')
  if (headerSecret !== adminSecret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (!databaseUrl) {
    return NextResponse.json(
      { ok: false, error: 'DATABASE_URL or SUPABASE_DB_URL required. Get from Supabase Dashboard > Project Settings > Database.' },
      { status: 503 }
    )
  }

  const client = new pg.Client({ connectionString: databaseUrl })
  try {
    await client.connect()
    await client.query(MIGRATION_SQL)
    return NextResponse.json({ ok: true, message: 'google_ads_connections table created' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[ADMIN_APPLY_MIGRATION_FAIL]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  } finally {
    await client.end().catch(() => {})
  }
}
