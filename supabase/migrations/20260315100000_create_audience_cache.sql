-- Audience cache: Supabase-backed storage for Google Ads audience dataset.
-- Replaces Vercel Edge Config as the write target for admin refresh.
-- Run with: supabase db push (or apply via Supabase dashboard SQL editor)

CREATE TABLE IF NOT EXISTS public.audience_cache (
  key text PRIMARY KEY,
  payload_json jsonb,
  payload_gzip_base64 text,
  version text,
  locale text,
  status text NOT NULL DEFAULT 'ready',
  raw_bytes integer,
  stored_bytes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audience_cache_status_updated_idx
  ON public.audience_cache (status, updated_at DESC)
  WHERE status = 'ready';

COMMENT ON TABLE public.audience_cache IS 'Prebuilt Google Ads audience dataset cache; admin refresh writes here instead of Edge Config';
