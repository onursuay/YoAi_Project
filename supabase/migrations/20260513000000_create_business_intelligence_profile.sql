-- ─────────────────────────────────────────────────────────────────────────────
-- YoAi — Business Intelligence Profile
--
-- YoAi'nin gizli firma/marka hafızası. Onboarding popup'ında toplanır,
-- multi-source scanner ile zenginleştirilir, YoAlgoritma / Strateji /
-- Hedef Kitle / Competitor Query Expander / Campaign Intent Engine
-- üretim motorlarına ortak referans olarak girer.
--
-- Tablolar:
--   1. user_business_profiles        — temel firma bilgisi + onboarding durumu
--   2. user_business_competitors     — kullanıcının girdiği rakipler (min 3)
--   3. user_business_source_scans    — marka + rakip kaynak tarama kayıtları
--   4. user_business_intelligence    — sentezlenmiş gizli iş zekası özeti
--
-- Bu tablolar YOKSA sistem kırılmaz — store helper'ları null fallback
-- döndürür, üretim motorları "missing_business_context" diagnostic
-- yazar ama crash etmez.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. user_business_profiles ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_business_profiles (
  id                              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         TEXT         NOT NULL UNIQUE,

  -- Temel firma bilgisi
  company_name                    TEXT         NOT NULL,
  sector_main                     TEXT,
  sector_sub                      TEXT,
  specialization                  TEXT,
  business_description            TEXT,
  main_conversion_goal            TEXT,
  target_locations                TEXT[]       NOT NULL DEFAULT '{}',
  target_audience                 TEXT,

  -- Marka kaynakları (en az 1 zorunlu — uygulama tarafında valide edilir)
  website_url                     TEXT,
  instagram_url                   TEXT,
  facebook_url                    TEXT,
  linkedin_url                    TEXT,
  youtube_url                     TEXT,
  tiktok_url                      TEXT,
  google_business_profile_url     TEXT,
  marketplace_url                 TEXT,

  -- Pazarlama bağlamı
  keywords                        TEXT[]       NOT NULL DEFAULT '{}',
  products_or_services            TEXT[]       NOT NULL DEFAULT '{}',
  most_profitable_services        TEXT[]       NOT NULL DEFAULT '{}',
  monthly_ad_budget_range         TEXT,
  brand_tone                      TEXT,
  forbidden_claims                TEXT[]       NOT NULL DEFAULT '{}',
  compliance_notes                TEXT,
  extra_notes                     TEXT,

  -- Onboarding & scan durumu
  onboarding_completed            BOOLEAN      NOT NULL DEFAULT FALSE,
  profile_confidence              INTEGER      NOT NULL DEFAULT 0
                                              CHECK (profile_confidence >= 0 AND profile_confidence <= 100),
  scan_status                     TEXT         NOT NULL DEFAULT 'pending'
                                              CHECK (scan_status IN ('pending','running','completed','failed','partial')),
  intelligence_status             TEXT         NOT NULL DEFAULT 'pending'
                                              CHECK (intelligence_status IN ('pending','running','completed','failed','stale')),
  last_scan_started_at            TIMESTAMPTZ,
  last_scan_completed_at          TIMESTAMPTZ,

  created_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_business_profiles_user_idx ON user_business_profiles(user_id);
CREATE INDEX IF NOT EXISTS user_business_profiles_sector_idx ON user_business_profiles(sector_main, sector_sub);
CREATE INDEX IF NOT EXISTS user_business_profiles_intelligence_idx ON user_business_profiles(intelligence_status);


-- ── 2. user_business_competitors ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_business_competitors (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT          NOT NULL,
  profile_id          UUID          NOT NULL
                                    REFERENCES user_business_profiles(id) ON DELETE CASCADE,

  competitor_name     TEXT          NOT NULL,
  website_url         TEXT,
  instagram_url       TEXT,
  facebook_url        TEXT,
  linkedin_url        TEXT,
  youtube_url         TEXT,
  tiktok_url          TEXT,
  google_business_url TEXT,
  extra_url           TEXT,

  scan_status         TEXT          NOT NULL DEFAULT 'pending'
                                    CHECK (scan_status IN ('pending','running','completed','failed','skipped')),
  scan_error          TEXT,
  confidence          INTEGER       NOT NULL DEFAULT 0
                                    CHECK (confidence >= 0 AND confidence <= 100),

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_business_competitors_user_idx ON user_business_competitors(user_id);
CREATE INDEX IF NOT EXISTS user_business_competitors_profile_idx ON user_business_competitors(profile_id);


-- ── 3. user_business_source_scans ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_business_source_scans (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  TEXT          NOT NULL,
  profile_id               UUID          NOT NULL
                                         REFERENCES user_business_profiles(id) ON DELETE CASCADE,
  competitor_id            UUID          REFERENCES user_business_competitors(id) ON DELETE CASCADE,

  source_owner_type        TEXT          NOT NULL
                                         CHECK (source_owner_type IN ('own_brand','competitor')),
  source_type              TEXT          NOT NULL
                                         CHECK (source_type IN (
                                           'website','instagram','facebook','linkedin',
                                           'youtube','tiktok','google_business','marketplace','extra'
                                         )),
  source_url               TEXT,

  scan_status              TEXT          NOT NULL DEFAULT 'pending'
                                         CHECK (scan_status IN ('pending','running','completed','failed','skipped')),

  -- Tarama çıktısı (kullanıcıya gösterilmez — gizli)
  raw_excerpt              TEXT,
  extracted_title          TEXT,
  extracted_description    TEXT,
  extracted_services       TEXT[]        NOT NULL DEFAULT '{}',
  extracted_products       TEXT[]        NOT NULL DEFAULT '{}',
  extracted_keywords       TEXT[]        NOT NULL DEFAULT '{}',
  extracted_audience       TEXT,
  extracted_locations      TEXT[]        NOT NULL DEFAULT '{}',
  extracted_ctas           TEXT[]        NOT NULL DEFAULT '{}',
  extracted_brand_tone     TEXT,
  extracted_offers         TEXT[]        NOT NULL DEFAULT '{}',
  extracted_social_proof   TEXT,

  confidence               INTEGER       NOT NULL DEFAULT 0
                                         CHECK (confidence >= 0 AND confidence <= 100),
  error_message            TEXT,
  scanned_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_business_source_scans_user_idx ON user_business_source_scans(user_id);
CREATE INDEX IF NOT EXISTS user_business_source_scans_profile_idx ON user_business_source_scans(profile_id);
CREATE INDEX IF NOT EXISTS user_business_source_scans_competitor_idx ON user_business_source_scans(competitor_id);
CREATE INDEX IF NOT EXISTS user_business_source_scans_status_idx ON user_business_source_scans(scan_status);


-- ── 4. user_business_intelligence ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_business_intelligence (
  id                                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                            TEXT          NOT NULL UNIQUE,
  profile_id                         UUID          NOT NULL
                                                  REFERENCES user_business_profiles(id) ON DELETE CASCADE,

  -- Sentezlenmiş alanlar (YoAi gizli iş hafızası — kullanıcıya direkt gösterilmez)
  company_summary                    TEXT,
  business_model                     TEXT,
  sector_summary                     TEXT,
  local_market_summary               TEXT,
  services_summary                   TEXT,
  products_summary                   TEXT,
  target_audience_summary            TEXT,
  conversion_goal_summary            TEXT,
  competitor_summary                 TEXT,
  competitor_positioning_summary     TEXT,

  keyword_themes                     TEXT[]        NOT NULL DEFAULT '{}',
  recommended_google_campaign_types  TEXT[]        NOT NULL DEFAULT '{}',
  recommended_meta_objectives        TEXT[]        NOT NULL DEFAULT '{}',
  recommended_content_angles         TEXT[]        NOT NULL DEFAULT '{}',
  recommended_offer_angles           TEXT[]        NOT NULL DEFAULT '{}',
  risk_claims                        TEXT[]        NOT NULL DEFAULT '{}',
  forbidden_claims                   TEXT[]        NOT NULL DEFAULT '{}',
  brand_positioning                  TEXT,
  audience_pains                     TEXT[]        NOT NULL DEFAULT '{}',
  audience_motivations               TEXT[]        NOT NULL DEFAULT '{}',
  location_insights                  TEXT,
  source_coverage                    JSONB,

  confidence                         INTEGER       NOT NULL DEFAULT 0
                                                  CHECK (confidence >= 0 AND confidence <= 100),
  missing_data                       TEXT[]        NOT NULL DEFAULT '{}',
  last_generated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  created_at                         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_business_intelligence_user_idx ON user_business_intelligence(user_id);
CREATE INDEX IF NOT EXISTS user_business_intelligence_confidence_idx ON user_business_intelligence(confidence);


-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_business_intel_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_business_profiles_updated_at_trigger
  ON user_business_profiles;
CREATE TRIGGER user_business_profiles_updated_at_trigger
  BEFORE UPDATE ON user_business_profiles
  FOR EACH ROW EXECUTE FUNCTION update_business_intel_updated_at();

DROP TRIGGER IF EXISTS user_business_competitors_updated_at_trigger
  ON user_business_competitors;
CREATE TRIGGER user_business_competitors_updated_at_trigger
  BEFORE UPDATE ON user_business_competitors
  FOR EACH ROW EXECUTE FUNCTION update_business_intel_updated_at();

DROP TRIGGER IF EXISTS user_business_intelligence_updated_at_trigger
  ON user_business_intelligence;
CREATE TRIGGER user_business_intelligence_updated_at_trigger
  BEFORE UPDATE ON user_business_intelligence
  FOR EACH ROW EXECUTE FUNCTION update_business_intel_updated_at();


-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Kullanıcı sadece kendi profilini okuyup yazabilir.
-- Service role (server-side analiz) tüm satıra erişir.

ALTER TABLE user_business_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_business_competitors   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_business_source_scans  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_business_intelligence  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON user_business_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON user_business_competitors
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON user_business_source_scans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON user_business_intelligence
  FOR ALL TO service_role USING (true) WITH CHECK (true);
