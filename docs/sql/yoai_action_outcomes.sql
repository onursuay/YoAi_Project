-- ─────────────────────────────────────────────────────────────
-- YoAlgoritma — Learning Layer v1 (veri biriktirme tablosu)
--
-- Supabase üzerinde aşağıdaki şemayı oluşturun.
-- Bu tablo YoAlgoritma'nın önerileri ve kullanıcının uyguladığı
-- aksiyonları izler. v1'de sadece kayıt tutulur;
-- outcome analizi v2'de eklenecek.
--
-- Kullanıcı bu tabloyu oluşturmazsa lib/yoai/learningStore
-- sessizce no-op'a düşer (endpoint'ler patlamaz).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.yoai_action_outcomes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  campaign_id      TEXT NOT NULL,
  campaign_name    TEXT,
  root_cause       TEXT,        -- RootCauseId (hook_problem, landing_page_problem, …)
  action_type      TEXT NOT NULL, -- monitor | tweak | revise | recreate | change_objective
  suggestion_payload JSONB NOT NULL,
  applied          BOOLEAN NOT NULL DEFAULT false,
  applied_at       TIMESTAMPTZ,
  outcome_summary  TEXT,
  metrics_before   JSONB,
  metrics_after    JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yoai_action_outcomes_user_created
  ON public.yoai_action_outcomes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_yoai_action_outcomes_campaign
  ON public.yoai_action_outcomes (user_id, campaign_id, created_at DESC);

-- RLS (Supabase'te kullanıcı bazlı erişim kontrolü)
ALTER TABLE public.yoai_action_outcomes ENABLE ROW LEVEL SECURITY;

-- Kullanıcı yalnızca kendi kayıtlarını okur
DROP POLICY IF EXISTS "yoai_action_outcomes_select_own" ON public.yoai_action_outcomes;
CREATE POLICY "yoai_action_outcomes_select_own"
  ON public.yoai_action_outcomes
  FOR SELECT
  USING (user_id = current_setting('request.jwt.claim.sub', true));

-- Kullanıcı yalnızca kendi adına kayıt ekler
DROP POLICY IF EXISTS "yoai_action_outcomes_insert_own" ON public.yoai_action_outcomes;
CREATE POLICY "yoai_action_outcomes_insert_own"
  ON public.yoai_action_outcomes
  FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

-- NOT: Eğer session_id cookie tabanlı ve JWT değilse RLS policy'leri
-- kapatılabilir. O zaman erişim kontrolü API katmanında yapılır
-- (zaten cookie'den userId alıp WHERE ile filtreliyoruz).
