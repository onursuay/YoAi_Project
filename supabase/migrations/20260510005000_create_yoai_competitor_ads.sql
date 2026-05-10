-- ─────────────────────────────────────────────────────────────
-- YoAlgoritma — Competitor Ads (Faz 2)
--
-- Rakip reklam istihbaratının kalıcı kaydı. Meta Ad Library'den
-- (ileride Google Ads Transparency / TikTok Creative Center vb.)
-- dönen reklamlar normalize edilip burada saklanır. Aynı reklam
-- tekrar görüldüğünde duplicate kayıt yaratılmaz; first_seen
-- korunur, last_seen güncellenir, seen_count artırılır.
--
-- Tenant izolasyonu: signups(id) UUID FK + RLS.
-- Service role yazar; authenticated kullanıcı sadece kendi
-- kayıtlarını okuyup yazabilir.
--
-- Migration uygulanmazsa lib/yoai/competitorAdStore.ts içindeki
-- table-missing branch tetiklenir; çağıran flow (analyze /
-- meta-ad-library) kırılmaz, sadece persistence kaybolur.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.yoai_competitor_ads (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,

  platform                 TEXT NOT NULL,                  -- meta, google, tiktok, ...
  source                   TEXT NOT NULL,                  -- meta_ad_library, google_ads_transparency, ...
  source_ad_id             TEXT,                           -- platform-native ad id (ör. Meta archive id)
  source_page_id           TEXT,
  ad_fingerprint           TEXT NOT NULL,                  -- deterministik dedupe anahtarı

  advertiser_name          TEXT,
  advertiser_page_name     TEXT,
  advertiser_domain        TEXT,

  query_keyword            TEXT,                           -- aramayı tetikleyen keyword
  industry_keyword         TEXT,
  campaign_type_context    TEXT,                           -- meta_traffic, meta_engagement, google_search, ...

  ad_body                  TEXT,
  ad_title                 TEXT,
  ad_description           TEXT,
  call_to_action           TEXT,
  destination_url          TEXT,

  publisher_platforms      JSONB NOT NULL DEFAULT '[]'::jsonb,
  ad_delivery_start_time   TIMESTAMPTZ,
  ad_delivery_stop_time    TIMESTAMPTZ,

  creative_assets          JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_payload              JSONB,
  extracted_signals        JSONB NOT NULL DEFAULT '{}'::jsonb,

  first_seen               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_count               INTEGER NOT NULL DEFAULT 1,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dedupe: aynı user + platform + source + fingerprint tek kayıt.
CREATE UNIQUE INDEX IF NOT EXISTS uq_yoai_competitor_ads_user_platform_source_fingerprint
  ON public.yoai_competitor_ads (user_id, platform, source, ad_fingerprint);

CREATE INDEX IF NOT EXISTS idx_yoai_competitor_ads_user
  ON public.yoai_competitor_ads (user_id);

CREATE INDEX IF NOT EXISTS idx_yoai_competitor_ads_platform
  ON public.yoai_competitor_ads (platform);

CREATE INDEX IF NOT EXISTS idx_yoai_competitor_ads_source
  ON public.yoai_competitor_ads (source);

CREATE INDEX IF NOT EXISTS idx_yoai_competitor_ads_query_keyword
  ON public.yoai_competitor_ads (query_keyword)
  WHERE query_keyword IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_yoai_competitor_ads_campaign_type_context
  ON public.yoai_competitor_ads (campaign_type_context)
  WHERE campaign_type_context IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_yoai_competitor_ads_advertiser_domain
  ON public.yoai_competitor_ads (advertiser_domain)
  WHERE advertiser_domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_yoai_competitor_ads_last_seen
  ON public.yoai_competitor_ads (last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_yoai_competitor_ads_user_platform_type_lastseen
  ON public.yoai_competitor_ads (user_id, platform, campaign_type_context, last_seen DESC);

-- RLS
ALTER TABLE public.yoai_competitor_ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "yoai_competitor_ads_select_own" ON public.yoai_competitor_ads;
CREATE POLICY "yoai_competitor_ads_select_own"
  ON public.yoai_competitor_ads
  FOR SELECT
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "yoai_competitor_ads_insert_own" ON public.yoai_competitor_ads;
CREATE POLICY "yoai_competitor_ads_insert_own"
  ON public.yoai_competitor_ads
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "yoai_competitor_ads_update_own" ON public.yoai_competitor_ads;
CREATE POLICY "yoai_competitor_ads_update_own"
  ON public.yoai_competitor_ads
  FOR UPDATE
  USING (user_id = auth.uid() OR auth.role() = 'service_role')
  WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "yoai_competitor_ads_delete_own" ON public.yoai_competitor_ads;
CREATE POLICY "yoai_competitor_ads_delete_own"
  ON public.yoai_competitor_ads
  FOR DELETE
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

COMMENT ON TABLE public.yoai_competitor_ads IS
  'Rakip reklam kayıtlarının kalıcı, dedupe edilmiş kütüphanesi (Faz 2). Meta Ad Library + ileride diğer kaynaklar.';
COMMENT ON COLUMN public.yoai_competitor_ads.ad_fingerprint IS
  'Deterministik dedupe anahtarı. source_ad_id varsa onun normalize hali, yoksa advertiser+body hash.';
COMMENT ON COLUMN public.yoai_competitor_ads.raw_payload IS
  'Sanitize edilmiş orijinal Ad Library response (token/secret içermez, kısaltılmış).';
COMMENT ON COLUMN public.yoai_competitor_ads.extracted_signals IS
  'hooks, value_props, offers, urgency, social_proof, cta_type vb. deterministik sinyaller.';
