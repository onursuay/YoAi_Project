-- ─────────────────────────────────────────────────────────────
-- YoAlgoritma — Competitor Insights (Faz 2)
--
-- yoai_competitor_ads üzerinden deterministik kural tabanlı üretilen
-- özet içgörülerin kalıcı kaydı (top hooks, top CTAs, value props,
-- offer patterns, vb.). AI proposal generator ileride bu özetleri
-- ek context olarak okuyabilir.
--
-- Kayıt granülaritesi: (user_id, platform, campaign_type_context,
-- query_keyword, source) bazında "en güncel snapshot" tutulur.
-- Yeni analiz geldiğinde aynı tuple güncellenir (upsert).
--
-- Tenant izolasyonu: signups(id) FK + RLS. Service role yazar.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.yoai_competitor_insights (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,

  platform                 TEXT NOT NULL,
  source                   TEXT NOT NULL,
  campaign_type_context    TEXT,
  query_keyword            TEXT,

  ads_count                INTEGER NOT NULL DEFAULT 0,
  active_advertisers_count INTEGER NOT NULL DEFAULT 0,

  top_hooks                JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_ctas                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_value_props          JSONB NOT NULL DEFAULT '[]'::jsonb,
  common_phrases           JSONB NOT NULL DEFAULT '[]'::jsonb,
  creative_patterns        JSONB NOT NULL DEFAULT '[]'::jsonb,
  offer_patterns           JSONB NOT NULL DEFAULT '[]'::jsonb,
  publisher_distribution   JSONB NOT NULL DEFAULT '{}'::jsonb,

  competitor_summary       TEXT,
  confidence               INTEGER NOT NULL DEFAULT 0,

  raw_ad_ids               JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,

  generated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at               TIMESTAMPTZ,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- "En güncel snapshot" garantisi için tuple bazlı tekillik.
-- NULL'lı kombinasyonlar PostgreSQL'de "ayrı" sayıldığı için
-- COALESCE ile normalize edilmiş expression index kullanıyoruz.
CREATE UNIQUE INDEX IF NOT EXISTS uq_yoai_competitor_insights_tuple
  ON public.yoai_competitor_insights (
    user_id,
    platform,
    source,
    COALESCE(campaign_type_context, ''),
    COALESCE(query_keyword, '')
  );

CREATE INDEX IF NOT EXISTS idx_yoai_competitor_insights_user
  ON public.yoai_competitor_insights (user_id);

CREATE INDEX IF NOT EXISTS idx_yoai_competitor_insights_user_platform_type
  ON public.yoai_competitor_insights (user_id, platform, campaign_type_context);

CREATE INDEX IF NOT EXISTS idx_yoai_competitor_insights_generated
  ON public.yoai_competitor_insights (generated_at DESC);

ALTER TABLE public.yoai_competitor_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "yoai_competitor_insights_select_own" ON public.yoai_competitor_insights;
CREATE POLICY "yoai_competitor_insights_select_own"
  ON public.yoai_competitor_insights
  FOR SELECT
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "yoai_competitor_insights_insert_own" ON public.yoai_competitor_insights;
CREATE POLICY "yoai_competitor_insights_insert_own"
  ON public.yoai_competitor_insights
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "yoai_competitor_insights_update_own" ON public.yoai_competitor_insights;
CREATE POLICY "yoai_competitor_insights_update_own"
  ON public.yoai_competitor_insights
  FOR UPDATE
  USING (user_id = auth.uid() OR auth.role() = 'service_role')
  WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "yoai_competitor_insights_delete_own" ON public.yoai_competitor_insights;
CREATE POLICY "yoai_competitor_insights_delete_own"
  ON public.yoai_competitor_insights
  FOR DELETE
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

COMMENT ON TABLE public.yoai_competitor_insights IS
  'Rakip reklam veritabanından deterministik üretilen özet içgörüler (Faz 2). AI proposal context için okunabilir.';
COMMENT ON COLUMN public.yoai_competitor_insights.confidence IS
  '0-100 arası, ads_count ve aktif reklamveren sayısına göre türetilmiş güven skoru.';
