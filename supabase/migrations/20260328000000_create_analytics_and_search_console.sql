-- Google Analytics connections (mirrors google_ads_connections pattern)
CREATE TABLE IF NOT EXISTS google_analytics_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google_analytics',
  refresh_token TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  token_scope TEXT,
  connected_email TEXT,
  selected_property_id TEXT,
  selected_property_name TEXT,
  account_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'error')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ga_connections_user_id ON google_analytics_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_ga_connections_status ON google_analytics_connections(status) WHERE status = 'active';

-- Google Search Console connections
CREATE TABLE IF NOT EXISTS google_search_console_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google_search_console',
  refresh_token TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  token_scope TEXT,
  connected_email TEXT,
  selected_site_url TEXT,
  selected_site_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'error')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gsc_connections_user_id ON google_search_console_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_gsc_connections_status ON google_search_console_connections(status) WHERE status = 'active';

-- Report cache (shared across all providers)
CREATE TABLE IF NOT EXISTS report_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'summary',
  date_from DATE,
  date_to DATE,
  payload JSONB NOT NULL DEFAULT '{}',
  fetched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_cache_lookup ON report_cache(user_id, provider, report_type, date_from, date_to);
CREATE INDEX IF NOT EXISTS idx_report_cache_freshness ON report_cache(fetched_at);
