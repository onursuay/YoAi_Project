-- Audiences table: stores Custom / Lookalike / Saved audiences linked to Meta
-- Run with: supabase db push (or apply via Supabase dashboard SQL editor)

CREATE TABLE IF NOT EXISTS audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id text NOT NULL,
  type text NOT NULL CHECK (type IN ('CUSTOM', 'LOOKALIKE', 'SAVED')),
  source text CHECK (source IN ('PIXEL', 'IG', 'PAGE', 'VIDEO', 'LEADFORM', 'CATALOG', 'APP', 'OFFLINE', 'CUSTOMER_LIST')),
  name text NOT NULL,
  description text,
  yoai_spec_json jsonb NOT NULL DEFAULT '{}',
  meta_payload_json jsonb,
  meta_audience_id text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CREATING', 'POPULATING', 'READY', 'ERROR', 'DELETED')),
  error_code text,
  error_message text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audiences_ad_account ON audiences (ad_account_id);
CREATE INDEX IF NOT EXISTS idx_audiences_status ON audiences (status);
CREATE INDEX IF NOT EXISTS idx_audiences_type ON audiences (type);
CREATE INDEX IF NOT EXISTS idx_audiences_meta_id ON audiences (meta_audience_id) WHERE meta_audience_id IS NOT NULL;

COMMENT ON TABLE audiences IS 'YoAi audience records linked to Meta Custom/Lookalike/Saved audiences';
