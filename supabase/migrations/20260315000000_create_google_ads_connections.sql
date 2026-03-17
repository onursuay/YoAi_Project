-- Google Ads connection persistence. Replaces cookie-only storage for production-safe
-- token storage, admin refresh, and background jobs. user_id = session_id (cookie).

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

COMMENT ON TABLE google_ads_connections IS 'Persistent Google Ads OAuth context per user (session_id). Used by admin refresh and background jobs when cookies unavailable.';
