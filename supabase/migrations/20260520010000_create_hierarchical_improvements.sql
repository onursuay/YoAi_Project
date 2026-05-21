-- ─────────────────────────────────────────────────────────────
-- YoAlgoritma — Hiyerarşik Geliştirme Tabloları (Faz 3)
--
-- Eski düz ai_ad_improvements (Faz 2) tablosu, hesap → kampanya →
-- ad set → reklam hiyerarşisine bölünür:
--
--   account_alerts          (SEVİYE 0)  user_id
--   campaign_improvements   (SEVİYE 1)  user_id + campaign_id
--   adset_improvements      (SEVİYE 2)  → campaign_improvement_id (FK)
--   ad_improvements         (SEVİYE 3)  → adset_improvement_id   (FK)
--
-- Eski ai_ad_improvements PARALEL yaşamaya devam eder (birkaç hafta
-- sonra silinir). Bu migration ONA dokunmaz.
--
-- Status enum (7): pending | approved | applied | rejected |
--                  rejected_by_user | cancelled | superseded
--   - rejected_by_user → kullanıcı "Reddet" bastı (soft-delete)
--   - rejected         → (legacy/sistem reddi; uyumluluk için tutulur)
--
-- Tümü additive + idempotent (IF NOT EXISTS). Mevcut tablolara zarar
-- yok, repoint/split-brain riski yok. USE_AI_ENGINE=false ise yazılmaz.
-- ─────────────────────────────────────────────────────────────

-- ── 0) touch_updated_at() — paylaşılan trigger fonksiyonu ─────
-- (Faz 2 migration'ında da tanımlı; idempotent yeniden tanımlıyoruz.)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 1) account_alerts (SEVİYE 0) ──────────────────────────────
-- Hesap genel sağlık uyarıları: Pixel/CAPI/dönüşüm takibi eksikliği,
-- bütçe dağılımı, hedef için eksik kampanya türü. Üst banner besler.
CREATE TABLE IF NOT EXISTS public.account_alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL,
  source_platform     TEXT CHECK (source_platform IN ('meta','google')),  -- NULL = hesap geneli
  alert_type          TEXT NOT NULL,            -- 'pixel_missing' | 'capi_missing' | 'conversion_tracking' | 'budget_distribution' | 'missing_campaign_type' | ...
  severity            TEXT NOT NULL DEFAULT 'medium'
                        CHECK (severity IN ('critical','high','medium','info')),
  title               TEXT NOT NULL,            -- Türkçe başlık
  body                TEXT,                     -- Türkçe açıklama
  recommended_action  TEXT,                     -- Türkçe önerilen aksiyon
  alert_payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence          INTEGER CHECK (confidence BETWEEN 0 AND 100),
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','applied','rejected','rejected_by_user','cancelled','superseded')),
  model               TEXT,
  run_id              UUID,
  decided_by          TEXT,
  decision_reason     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_account_alerts_user_status
  ON public.account_alerts (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_alerts_run
  ON public.account_alerts (run_id);

-- ── 2) campaign_improvements (SEVİYE 1) ───────────────────────
-- Her kampanya için 1 kart. Kampanya türü doğrulama (type_mismatch),
-- bütçe stratejisi, dönüşüm hedefi, bidding önerileri.
CREATE TABLE IF NOT EXISTS public.campaign_improvements (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         TEXT NOT NULL,
  source_platform                 TEXT NOT NULL CHECK (source_platform IN ('meta','google')),
  campaign_id                     TEXT NOT NULL,
  campaign_name                   TEXT,
  source_campaign_status_snapshot TEXT,         -- scan anındaki status (ACTIVE/ENABLED…)
  current_objective               TEXT,         -- HAM platform enum (OUTCOME_AWARENESS…); gösterimde çevrilir
  type_mismatch                   BOOLEAN NOT NULL DEFAULT false,
  reasoning                       TEXT,         -- Türkçe gerekçe (kaynak belirtmez)
  improvement_payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
                                                -- { type_mismatch_alert?, suggestions:[...],
                                                --   current_objective_label, recommended_objective,
                                                --   recommended_objective_label, recommended_action }
  confidence                      INTEGER CHECK (confidence BETWEEN 0 AND 100),
  status                          TEXT NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','approved','applied','rejected','rejected_by_user','cancelled','superseded')),
  publish_mode                    TEXT NOT NULL DEFAULT 'manual_publish'
                                    CHECK (publish_mode IN ('auto','manual_publish')),
  model                           TEXT,
  run_id                          UUID,
  publish_audit_id                UUID,
  publish_error                   TEXT,
  publish_attempts                INTEGER NOT NULL DEFAULT 0,
  decided_by                      TEXT,
  decision_reason                 TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at                      TIMESTAMPTZ,
  applied_at                      TIMESTAMPTZ,
  cancelled_at                    TIMESTAMPTZ
);

-- Bir kampanyanın aynı anda yalnızca TEK açık kartı olabilir.
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_improvements_open_unique
  ON public.campaign_improvements (user_id, source_platform, campaign_id)
  WHERE status IN ('pending','approved');
CREATE INDEX IF NOT EXISTS idx_campaign_improvements_user_status
  ON public.campaign_improvements (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_improvements_run
  ON public.campaign_improvements (run_id);

-- ── 3) adset_improvements (SEVİYE 2) ──────────────────────────
-- O kampanyaya ait her ad set (Meta) / ad group (Google) için 1 kart.
-- Hedef kitle, lokasyon, dil, yayın yerleri, bütçe, optimization/bidding.
CREATE TABLE IF NOT EXISTS public.adset_improvements (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       TEXT NOT NULL,                -- denormalize (RLS + sorgu)
  campaign_improvement_id       UUID NOT NULL
                                  REFERENCES public.campaign_improvements(id) ON DELETE CASCADE,
  source_platform               TEXT NOT NULL CHECK (source_platform IN ('meta','google')),
  campaign_id                   TEXT,                         -- denormalize
  adset_id                      TEXT NOT NULL,                -- Meta ad set / Google ad group
  adset_name                    TEXT,
  source_adset_status_snapshot  TEXT,
  reasoning                     TEXT,
  improvement_payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
                                                -- { suggestions:[...] } hedefleme/lokasyon/dil/yayın/bütçe/optimization
  confidence                    INTEGER CHECK (confidence BETWEEN 0 AND 100),
  status                        TEXT NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','approved','applied','rejected','rejected_by_user','cancelled','superseded')),
  publish_mode                  TEXT NOT NULL DEFAULT 'manual_publish'
                                  CHECK (publish_mode IN ('auto','manual_publish')),
  model                         TEXT,
  run_id                        UUID,
  publish_audit_id              UUID,
  publish_error                 TEXT,
  publish_attempts              INTEGER NOT NULL DEFAULT 0,
  decided_by                    TEXT,
  decision_reason               TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at                    TIMESTAMPTZ,
  applied_at                    TIMESTAMPTZ,
  cancelled_at                  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_adset_improvements_parent
  ON public.adset_improvements (campaign_improvement_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_adset_improvements_open_unique
  ON public.adset_improvements (user_id, source_platform, adset_id)
  WHERE status IN ('pending','approved');
CREATE INDEX IF NOT EXISTS idx_adset_improvements_user_status
  ON public.adset_improvements (user_id, status, created_at DESC);

-- ── 4) ad_improvements (SEVİYE 3) ─────────────────────────────
-- O ad set'e ait her reklam için 1 kart. ad_spec (başlık/açıklama/CTA/
-- creative brief/asset şartları) + uygunluk notları. Onayla → wizard.
-- (ai_ad_improvements'ın hiyerarşik karşılığı + adset FK.)
CREATE TABLE IF NOT EXISTS public.ad_improvements (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     TEXT NOT NULL,                  -- denormalize (RLS + sorgu)
  adset_improvement_id        UUID NOT NULL
                                REFERENCES public.adset_improvements(id) ON DELETE CASCADE,
  source_platform             TEXT NOT NULL CHECK (source_platform IN ('meta','google')),
  campaign_id                 TEXT,                           -- denormalize
  adset_id                    TEXT,                           -- denormalize
  ad_id                       TEXT NOT NULL,
  ad_name                     TEXT,
  source_ad_status_snapshot   TEXT,                           -- scan anındaki status
  source_creative_hash        TEXT,                           -- creative değişim tespiti (refresh policy)
  reasoning                   TEXT,
  improvement_payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
                                              -- { ad_spec, reasoning, competitor_comparison,
                                              --   compliance_notes, confidence }
  confidence                  INTEGER CHECK (confidence BETWEEN 0 AND 100),
  status                      TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','approved','applied','rejected','rejected_by_user','cancelled','superseded')),
  publish_mode                TEXT NOT NULL DEFAULT 'auto'    -- meta → auto, google → manual_publish
                                CHECK (publish_mode IN ('auto','manual_publish')),
  model                       TEXT,
  run_id                      UUID,
  publish_audit_id            UUID,
  publish_error               TEXT,
  publish_attempts            INTEGER NOT NULL DEFAULT 0,
  decided_by                  TEXT,
  decision_reason             TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at                  TIMESTAMPTZ,
  applied_at                  TIMESTAMPTZ,
  cancelled_at                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ad_improvements_parent
  ON public.ad_improvements (adset_improvement_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_improvements_open_unique
  ON public.ad_improvements (user_id, source_platform, ad_id)
  WHERE status IN ('pending','approved');
CREATE INDEX IF NOT EXISTS idx_ad_improvements_user_status
  ON public.ad_improvements (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_improvements_run
  ON public.ad_improvements (run_id);

-- ── 5) updated_at trigger'ları (4 tablo) ──────────────────────
DROP TRIGGER IF EXISTS trg_account_alerts_touch ON public.account_alerts;
CREATE TRIGGER trg_account_alerts_touch
  BEFORE UPDATE ON public.account_alerts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_campaign_improvements_touch ON public.campaign_improvements;
CREATE TRIGGER trg_campaign_improvements_touch
  BEFORE UPDATE ON public.campaign_improvements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_adset_improvements_touch ON public.adset_improvements;
CREATE TRIGGER trg_adset_improvements_touch
  BEFORE UPDATE ON public.adset_improvements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_ad_improvements_touch ON public.ad_improvements;
CREATE TRIGGER trg_ad_improvements_touch
  BEFORE UPDATE ON public.ad_improvements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 6) RLS (defense-in-depth; service-role bypass'lar) ────────
ALTER TABLE public.account_alerts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_improvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adset_improvements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_improvements       ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY account_alerts_select_own ON public.account_alerts
    FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY campaign_improvements_select_own ON public.campaign_improvements
    FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY adset_improvements_select_own ON public.adset_improvements
    FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY ad_improvements_select_own ON public.ad_improvements
    FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Yazma yalnızca service role (RLS bypass) — ekstra policy gerekmez.

-- ── 7) Bilgilendirme ──────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Faz 3 hiyerarşik tablolar hazır: account_alerts, campaign_improvements, adset_improvements, ad_improvements.';
END $$;
