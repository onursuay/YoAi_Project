-- ─────────────────────────────────────────────────────────────
-- YoAlgoritma — Recommendation Results (Faz 7)
--
-- Öneri sonuçlarını takip eden tablo.
-- Before snapshot (öneri anındaki metrikler) +
-- After snapshot  (uygulama sonrası metrikler) +
-- Delta + deterministic outcome summary.
--
-- Sahte veri eklenmez; UI sadece gerçek kayıtları gösterir.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS yoai_recommendation_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,

  -- Kaynak öneri / approval bağlantısı
  proposal_id         TEXT NOT NULL,
  approval_id         UUID REFERENCES yoai_pending_approvals(id) ON DELETE SET NULL,
  source_campaign_id  TEXT,
  platform            TEXT NOT NULL DEFAULT 'meta',

  -- Öneri tipi ve içeriği
  recommendation_type TEXT NOT NULL DEFAULT 'optimization',  -- optimization | new_campaign | creative_refresh
  campaign_type       TEXT,
  proposal_snapshot   JSONB,                                 -- FullAdProposal özeti

  -- Before snapshot — öneri oluşturulduğu andaki metrikler
  before_snapshot     JSONB,                                 -- { ctr, cpc, spend, impressions, clicks, roas, ... }
  before_recorded_at  TIMESTAMPTZ,

  -- After snapshot  — uygulama sonrası metrikler (7/14/30 gün)
  after_snapshot      JSONB,                                 -- { ctr, cpc, spend, impressions, clicks, roas, ... }
  after_recorded_at   TIMESTAMPTZ,
  after_window_days   INTEGER DEFAULT 14,                    -- 7 | 14 | 30

  -- Delta & Outcome
  metric_delta        JSONB,                                 -- { ctr_delta, cpc_delta, roas_delta, ... }
  outcome             TEXT CHECK (outcome IN (
                        'pending',      -- after henüz yok
                        'improved',     -- metrikler iyileşti
                        'no_change',    -- önemli değişim yok
                        'declined',     -- metrikler kötüleşti
                        'insufficient_data'  -- veri yetersiz
                      )) DEFAULT 'pending',
  outcome_summary     TEXT,                                  -- insan okunabilir açıklama

  -- Durum
  status              TEXT NOT NULL DEFAULT 'before_recorded'
                      CHECK (status IN ('before_recorded', 'applied', 'after_recorded', 'skipped')),
  applied_at          TIMESTAMPTZ,
  skipped_reason      TEXT,

  metadata            JSONB DEFAULT '{}'::JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS yoai_recommendation_results_user_id_idx
  ON yoai_recommendation_results(user_id);

CREATE INDEX IF NOT EXISTS yoai_recommendation_results_proposal_id_idx
  ON yoai_recommendation_results(proposal_id);

CREATE INDEX IF NOT EXISTS yoai_recommendation_results_source_campaign_id_idx
  ON yoai_recommendation_results(source_campaign_id)
  WHERE source_campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS yoai_recommendation_results_outcome_idx
  ON yoai_recommendation_results(outcome)
  WHERE outcome IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_yoai_recommendation_results_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS yoai_recommendation_results_updated_at_trigger
  ON yoai_recommendation_results;

CREATE TRIGGER yoai_recommendation_results_updated_at_trigger
  BEFORE UPDATE ON yoai_recommendation_results
  FOR EACH ROW
  EXECUTE FUNCTION update_yoai_recommendation_results_updated_at();

-- RLS
ALTER TABLE yoai_recommendation_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "yoai_recommendation_results_select_own" ON yoai_recommendation_results;
CREATE POLICY "yoai_recommendation_results_select_own"
  ON yoai_recommendation_results FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "yoai_recommendation_results_insert_own" ON yoai_recommendation_results;
CREATE POLICY "yoai_recommendation_results_insert_own"
  ON yoai_recommendation_results FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "yoai_recommendation_results_update_own" ON yoai_recommendation_results;
CREATE POLICY "yoai_recommendation_results_update_own"
  ON yoai_recommendation_results FOR UPDATE
  USING (user_id = auth.uid());
