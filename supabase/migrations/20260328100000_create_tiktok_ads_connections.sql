-- TikTok Ads OAuth connections (mirrors google_ads_connections / meta_connections pattern)
CREATE TABLE IF NOT EXISTS tiktok_ads_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  provider text NOT NULL DEFAULT 'tiktok_ads',
  access_token text,
  access_expires_at timestamptz,
  advertiser_id text,
  advertiser_name text,
  token_scope text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'error', 'expired')),
  last_error text,
  last_health_check_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tiktok_ads_connections_user
  ON tiktok_ads_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_ads_connections_status
  ON tiktok_ads_connections (status) WHERE status = 'active';
