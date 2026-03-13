-- ============================================================
-- YoAi Strateji Modülü — Veritabanı Şeması
-- ============================================================

-- A) strategy_templates
CREATE TABLE IF NOT EXISTS strategy_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text,
  goal_type text,
  default_blueprint jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- B) strategy_instances
CREATE TABLE IF NOT EXISTS strategy_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id text NOT NULL,
  title text NOT NULL,
  brand text,
  goal_type text,
  time_horizon_days int DEFAULT 30,
  monthly_budget_try numeric,
  channel_meta boolean DEFAULT false,
  channel_google boolean DEFAULT false,
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','COLLECTING','ANALYZING','GENERATING_PLAN',
      'READY_FOR_REVIEW','APPLYING','RUNNING','NEEDS_ACTION','FAILED'
    )),
  current_phase int NOT NULL DEFAULT 1 CHECK (current_phase IN (1, 2, 3)),
  data_quality_score int DEFAULT 0 CHECK (data_quality_score BETWEEN 0 AND 100),
  missing_items jsonb DEFAULT '[]',
  last_error jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_si_account ON strategy_instances (ad_account_id);
CREATE INDEX IF NOT EXISTS idx_si_status ON strategy_instances (status);

-- C) strategy_inputs (Aşama 1 verileri)
CREATE TABLE IF NOT EXISTS strategy_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_instance_id uuid NOT NULL REFERENCES strategy_instances(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sinput_instance ON strategy_inputs (strategy_instance_id);

-- D) strategy_outputs (blueprint versiyonları)
CREATE TABLE IF NOT EXISTS strategy_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_instance_id uuid NOT NULL REFERENCES strategy_instances(id) ON DELETE CASCADE,
  blueprint jsonb NOT NULL DEFAULT '{}',
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soutput_instance ON strategy_outputs (strategy_instance_id);

-- E) strategy_tasks
CREATE TABLE IF NOT EXISTS strategy_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_instance_id uuid NOT NULL REFERENCES strategy_instances(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('setup','creative','audience','campaign','measurement')),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done','blocked')),
  assignee text,
  evidence_urls jsonb DEFAULT '[]',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stask_instance ON strategy_tasks (strategy_instance_id);

-- F) sync_jobs
CREATE TABLE IF NOT EXISTS sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_instance_id uuid NOT NULL REFERENCES strategy_instances(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('analyze','generate_plan','apply','pull_metrics','optimize')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','success','failed')),
  progress int NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  next_run_at timestamptz DEFAULT now(),
  result jsonb,
  last_error jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sjob_instance ON sync_jobs (strategy_instance_id);
CREATE INDEX IF NOT EXISTS idx_sjob_status ON sync_jobs (status);
CREATE INDEX IF NOT EXISTS idx_sjob_next ON sync_jobs (next_run_at) WHERE status = 'queued';

-- G) metrics_snapshots
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_instance_id uuid NOT NULL REFERENCES strategy_instances(id) ON DELETE CASCADE,
  range_days int NOT NULL,
  spend_try numeric DEFAULT 0,
  clicks int DEFAULT 0,
  impressions int DEFAULT 0,
  conversions int DEFAULT 0,
  roas numeric DEFAULT 0,
  cpa_try numeric,
  ctr numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snap_instance ON metrics_snapshots (strategy_instance_id);

-- RLS Policies (ad_account_id bazlı)
ALTER TABLE strategy_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_snapshots ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE strategy_instances IS 'Ana strateji kaydı — 3 aşamalı pipeline';
COMMENT ON TABLE sync_jobs IS 'Asenkron iş kuyruğu — analyze, generate, apply, pull, optimize';
COMMENT ON TABLE metrics_snapshots IS 'Periyodik metrik snapshot — KPI bar besler';
