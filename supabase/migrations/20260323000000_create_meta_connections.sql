-- Meta connection persistence. Mirrors google_ads_connections pattern.
-- Replaces cookie-only storage for production-safe token storage and background jobs.
-- user_id = session_id (cookie), same as google_ads_connections.

CREATE TABLE IF NOT EXISTS meta_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  provider text NOT NULL DEFAULT 'meta',
  access_token text,
  access_expires_at timestamptz,
  token_type text DEFAULT 'unknown'
    CHECK (token_type IN ('long_lived', 'short_lived', 'unknown')),
  scopes text,
  selected_ad_account_id text,
  selected_business_id text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'error', 'expired')),
  last_error text,
  last_health_check_at timestamptz,
  last_selected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_connections_user
  ON meta_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_meta_connections_status
  ON meta_connections (status) WHERE status = 'active';

COMMENT ON TABLE meta_connections IS 'Persistent Meta/Facebook OAuth context per user (session_id). DB-first with cookie fallback for backward compatibility.';
