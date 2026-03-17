# Google Ads DB Persistence – Production Setup

## 1. Apply migration (one-time)

Run the migration SQL in your Supabase project:

1. Open **Supabase Dashboard** → **SQL Editor** → **New query**
2. Paste and run the contents of `supabase/migrations/20260315000000_create_google_ads_connections.sql`:

```sql
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_google_ads_connections_user ON google_ads_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_connections_status ON google_ads_connections (status) WHERE status = 'active';
COMMENT ON TABLE google_ads_connections IS 'Persistent Google Ads OAuth context per user (session_id). Used by admin refresh and background jobs when cookies unavailable.';
```

3. Click **Run**

## 2. Production env vars (Vercel / hosting)

Add these to your production environment:

| Variable | Required | Notes |
|----------|----------|-------|
| `ADMIN_SECRET` | Yes | Random 32+ char secret for admin endpoints. Generate: `openssl rand -hex 32` |
| `EDGE_CONFIG` | Yes | Already in .env.local – Edge Config connection for reads |
| `AUDIENCE_EDGE_CONFIG_ID` | Yes | Edge Config ID (e.g. `ecfg_xxx`) for admin write |
| `VERCEL_API_TOKEN` | Yes | Vercel API token for writing to Edge Config |
| `GOOGLE_ADS_REFRESH_TOKEN` | Optional | Env override for admin refresh (avoids DB) |
| `GOOGLE_ADS_CUSTOMER_ID` | Optional | With above, for admin refresh |
| `DATABASE_URL` | Optional | For `npm run db:migrate:google-ads` – migration can also be run via Supabase SQL Editor |

## 3. Connect flow (creates DB row)

1. Go to **Entegrasyon** (integrations)
2. Click **Google Ads'i Bağla**
3. Complete OAuth and choose an account
4. This will create an active row in `google_ads_connections`

## 4. Run admin refresh

```bash
curl -X POST https://yoai.yodijital.com/api/admin/google-audiences/refresh \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json"
```

## 5. Verify

```bash
npm run verify:google-ads
```

Or set `VERIFY_BASE_URL` to test against a specific URL.
