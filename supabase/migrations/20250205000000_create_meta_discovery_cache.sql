-- Meta Discovery cache: 24h TTL per key (objective|conversionGroup|destinationType|optimizationGoal|messagingDestinations)
-- Run with: supabase db push (or apply via Supabase dashboard SQL editor)

CREATE TABLE IF NOT EXISTS meta_discovery_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  spec_patch jsonb NOT NULL DEFAULT '{}',
  cached_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS meta_discovery_cache_cache_key_key ON meta_discovery_cache (cache_key);
CREATE INDEX IF NOT EXISTS meta_discovery_cache_cached_at_idx ON meta_discovery_cache (cached_at);

COMMENT ON TABLE meta_discovery_cache IS 'Cache for Meta API discovery/validation results; 24h TTL per cache_key';
