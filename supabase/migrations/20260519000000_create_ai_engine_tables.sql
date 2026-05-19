-- ─────────────────────────────────────────────────────────────
-- YoAlgoritma — AI Engine Tables (Faz 2)
--
-- Claude API + tool use + agentic loop ile üretilen sonuçların
-- persiste edildiği tablolar. Eski rule-engine sonuçları
-- yoai_daily_runs.command_center_data içinde yaşamaya devam eder;
-- bu tablolar yeni AI engine'in queryable çıktısıdır.
--
-- Yapı:
--   ai_engine_runs       — her (user, platform, account, day) için 1 parent satır
--                          (token kullanımı, model, süre, hata)
--   ai_alerts            — kritik uyarılar (severity, target_entity, evidence)
--   ai_opportunities     — iyileştirme fırsatları (category, expected_impact)
--   ai_suggestions       — önerilen aksiyonlar (priority, action_type, reasoning,
--                          payload — onay akışı + execute path için)
--
-- USE_AI_ENGINE feature flag false ise bu tablolar yazılmaz; sistem
-- eski rule-engine flow'una düşer (rollback güvenliği).
-- ─────────────────────────────────────────────────────────────

-- ── 1) Parent: AI Engine Runs ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_engine_runs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  TEXT NOT NULL,
  platform                 TEXT NOT NULL CHECK (platform IN ('Meta', 'Google')),
  account_id               TEXT NOT NULL,
  run_date                 DATE NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  model                    TEXT,
  input_tokens             INTEGER,
  output_tokens            INTEGER,
  cache_read_tokens        INTEGER,
  cache_creation_tokens    INTEGER,
  tool_calls_count         INTEGER NOT NULL DEFAULT 0,
  iterations               INTEGER NOT NULL DEFAULT 0,
  duration_ms              INTEGER,
  error_message            TEXT,
  trace                    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_engine_runs_unique
  ON public.ai_engine_runs (user_id, platform, account_id, run_date);

CREATE INDEX IF NOT EXISTS idx_ai_engine_runs_user_recent
  ON public.ai_engine_runs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_engine_runs_status
  ON public.ai_engine_runs (status, updated_at DESC);

-- ── 2) AI Alerts (Kritik Uyarılar) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_alerts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                   UUID NOT NULL REFERENCES public.ai_engine_runs(id) ON DELETE CASCADE,
  user_id                  TEXT NOT NULL,
  platform                 TEXT NOT NULL CHECK (platform IN ('Meta', 'Google')),
  account_id               TEXT NOT NULL,
  severity                 TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium')),
  title                    TEXT NOT NULL,
  reason                   TEXT NOT NULL,
  suggested_action         TEXT,
  confidence               INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  target_entity_type       TEXT CHECK (target_entity_type IN ('account', 'campaign', 'adset', 'ad', 'ad_group')),
  target_entity_id         TEXT,
  target_entity_name       TEXT,
  evidence                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                   TEXT NOT NULL DEFAULT 'open'
                             CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_alerts_run        ON public.ai_alerts (run_id);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_user_open  ON public.ai_alerts (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_user_recent ON public.ai_alerts (user_id, created_at DESC);

-- ── 3) AI Opportunities (İyileştirme Fırsatları) ──────────────
CREATE TABLE IF NOT EXISTS public.ai_opportunities (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                   UUID NOT NULL REFERENCES public.ai_engine_runs(id) ON DELETE CASCADE,
  user_id                  TEXT NOT NULL,
  platform                 TEXT NOT NULL CHECK (platform IN ('Meta', 'Google')),
  account_id               TEXT NOT NULL,
  category                 TEXT NOT NULL,
  title                    TEXT NOT NULL,
  expected_impact          TEXT,
  action_description       TEXT,
  confidence               INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  target_entity_type       TEXT CHECK (target_entity_type IN ('account', 'campaign', 'adset', 'ad', 'ad_group')),
  target_entity_id         TEXT,
  target_entity_name       TEXT,
  evidence                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                   TEXT NOT NULL DEFAULT 'open'
                             CHECK (status IN ('open', 'in_progress', 'completed', 'dismissed')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_opportunities_run         ON public.ai_opportunities (run_id);
CREATE INDEX IF NOT EXISTS idx_ai_opportunities_user_open   ON public.ai_opportunities (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_opportunities_user_recent ON public.ai_opportunities (user_id, created_at DESC);

-- ── 4) AI Suggestions (Önerilen Aksiyonlar) ───────────────────
CREATE TABLE IF NOT EXISTS public.ai_suggestions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                   UUID NOT NULL REFERENCES public.ai_engine_runs(id) ON DELETE CASCADE,
  user_id                  TEXT NOT NULL,
  platform                 TEXT NOT NULL CHECK (platform IN ('Meta', 'Google')),
  account_id               TEXT NOT NULL,
  priority                 TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  action_type              TEXT NOT NULL,
  title                    TEXT NOT NULL,
  reasoning                TEXT NOT NULL,
  expected_impact          TEXT,
  confidence               INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  target_entity_type       TEXT NOT NULL CHECK (target_entity_type IN ('account', 'campaign', 'adset', 'ad', 'ad_group')),
  target_entity_id         TEXT NOT NULL,
  target_entity_name       TEXT,
  payload                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'executed', 'dismissed')),
  approval_id              UUID,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_run            ON public.ai_suggestions (run_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_user_pending   ON public.ai_suggestions (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_user_recent    ON public.ai_suggestions (user_id, created_at DESC);

-- ── 5) Touch updated_at trigger function (shared) ─────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_engine_runs_touch ON public.ai_engine_runs;
CREATE TRIGGER trg_ai_engine_runs_touch
  BEFORE UPDATE ON public.ai_engine_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_ai_alerts_touch ON public.ai_alerts;
CREATE TRIGGER trg_ai_alerts_touch
  BEFORE UPDATE ON public.ai_alerts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_ai_opportunities_touch ON public.ai_opportunities;
CREATE TRIGGER trg_ai_opportunities_touch
  BEFORE UPDATE ON public.ai_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_ai_suggestions_touch ON public.ai_suggestions;
CREATE TRIGGER trg_ai_suggestions_touch
  BEFORE UPDATE ON public.ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 6) RLS (defense-in-depth; service-role bypass'lar) ────────
ALTER TABLE public.ai_engine_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_alerts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_suggestions   ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own rows (user_id eşleşmesi)
DO $$ BEGIN
  CREATE POLICY ai_engine_runs_select_own ON public.ai_engine_runs
    FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY ai_alerts_select_own ON public.ai_alerts
    FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY ai_opportunities_select_own ON public.ai_opportunities
    FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY ai_suggestions_select_own ON public.ai_suggestions
    FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Write policies — sadece service role (default deny for authenticated)
-- Service role key zaten RLS bypass eder, ekstra policy gerekmez.

-- ── 7) Bilgilendirme ──────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'AI Engine tables (ai_engine_runs, ai_alerts, ai_opportunities, ai_suggestions) hazır.';
END $$;
