-- ─────────────────────────────────────────────────────────────────────────────
-- YoAlgoritma — Official Ads Knowledge Base Foundation (Faz A)
--
-- Tablolar:
--   official_ads_sources          — Resmi belge kaynak registry
--   official_ads_knowledge_items  — Platform bilgi öğeleri (objective/bidding/creative)
--   official_ads_doc_snapshots    — Ham belge anlık görüntüleri
--   official_ads_refresh_runs     — Yenileme çalışması kayıtları
--
-- Bu tablolar kullanıcıya bağlı değildir; tüm hesaplar/sektörler için ortaktır.
-- Mevcut akış bozulmaz: adCreator.ts hardcoded fallback korunur.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. official_ads_sources ───────────────────────────────────────────────────
-- Resmi platform belgelerinin kaynak registry'si.

CREATE TABLE IF NOT EXISTS official_ads_sources (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform        TEXT        NOT NULL CHECK (platform IN ('google', 'meta')),
  source_type     TEXT        NOT NULL CHECK (source_type IN (
                                'docs', 'changelog', 'release_notes',
                                'policy', 'api_reference', 'blog'
                              )),
  title           TEXT        NOT NULL,
  url             TEXT,
  fetch_strategy  TEXT        NOT NULL DEFAULT 'manual_review'
                              CHECK (fetch_strategy IN (
                                'html', 'markdown', 'rss', 'sitemap', 'manual_review'
                              )),
  last_checked_at TIMESTAMPTZ,
  last_changed_at TIMESTAMPTZ,
  content_hash    TEXT,
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN (
                                'active', 'failed', 'review_required', 'deprecated'
                              )),
  importance      TEXT        NOT NULL DEFAULT 'medium'
                              CHECK (importance IN ('critical', 'high', 'medium', 'low')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT official_ads_sources_platform_title_uq UNIQUE (platform, title)
);

-- ── 2. official_ads_knowledge_items ───────────────────────────────────────────
-- Platform başına bilgi öğeleri: objective, bidding, creative rule, vb.

CREATE TABLE IF NOT EXISTS official_ads_knowledge_items (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  platform            TEXT          NOT NULL CHECK (platform IN ('google', 'meta')),
  category            TEXT          NOT NULL CHECK (category IN (
                                      'campaign_type', 'objective', 'bidding',
                                      'optimization_goal', 'creative_rule', 'policy',
                                      'api_version', 'cta', 'destination',
                                      'asset_rule', 'compatibility_matrix'
                                    )),
  title               TEXT          NOT NULL,
  normalized_key      TEXT          NOT NULL,
  summary             TEXT,
  rules_json          JSONB,
  allowed_values      JSONB,
  forbidden_values    JSONB,
  compatibility_json  JSONB,
  source_id           UUID          REFERENCES official_ads_sources(id) ON DELETE SET NULL,
  source_url          TEXT,
  source_hash         TEXT,
  source_last_seen_at TIMESTAMPTZ,
  effective_from      DATE,
  effective_to        DATE,
  confidence          NUMERIC(3,2)  NOT NULL DEFAULT 0.70
                                    CHECK (confidence >= 0 AND confidence <= 1),
  review_status       TEXT          NOT NULL DEFAULT 'draft'
                                    CHECK (review_status IN (
                                      'approved', 'review_required', 'draft',
                                      'deprecated', 'auto_approved'
                                    )),
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,
  version             INTEGER       NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT official_ads_knowledge_items_key_version_uq UNIQUE (normalized_key, version)
);

-- ── 3. official_ads_doc_snapshots ─────────────────────────────────────────────
-- Belge çekme işlemlerinin ham içerik anlık görüntüleri.

CREATE TABLE IF NOT EXISTS official_ads_doc_snapshots (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id           UUID        NOT NULL REFERENCES official_ads_sources(id) ON DELETE CASCADE,
  fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  content_hash        TEXT,
  raw_text            TEXT,
  normalized_text     TEXT,
  diff_summary        TEXT,
  parser_status       TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (parser_status IN (
                                    'pending', 'success', 'failed', 'skipped'
                                  )),
  parser_error        TEXT,
  created_items_count INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. official_ads_refresh_runs ──────────────────────────────────────────────
-- Bilgi tabanı yenileme çalışmalarının kayıtları.

CREATE TABLE IF NOT EXISTS official_ads_refresh_runs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  status                TEXT        NOT NULL DEFAULT 'running'
                                    CHECK (status IN ('running', 'success', 'partial', 'failed')),
  checked_sources       INTEGER     NOT NULL DEFAULT 0,
  changed_sources       INTEGER     NOT NULL DEFAULT 0,
  failed_sources        INTEGER     NOT NULL DEFAULT 0,
  review_required_count INTEGER     NOT NULL DEFAULT 0,
  summary_json          JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS official_ads_knowledge_items_platform_cat_status_idx
  ON official_ads_knowledge_items(platform, category, review_status);

CREATE INDEX IF NOT EXISTS official_ads_sources_platform_type_status_idx
  ON official_ads_sources(platform, source_type, status);

CREATE INDEX IF NOT EXISTS official_ads_doc_snapshots_source_id_idx
  ON official_ads_doc_snapshots(source_id);

-- ── updated_at trigger for official_ads_sources ───────────────────────────────

CREATE OR REPLACE FUNCTION update_official_ads_sources_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS official_ads_sources_updated_at_trigger ON official_ads_sources;
CREATE TRIGGER official_ads_sources_updated_at_trigger
  BEFORE UPDATE ON official_ads_sources
  FOR EACH ROW EXECUTE FUNCTION update_official_ads_sources_updated_at();

-- ── Seed: official_ads_sources — Google ───────────────────────────────────────

INSERT INTO official_ads_sources
  (platform, source_type, title, url, fetch_strategy, status, importance, notes)
VALUES
  ('google', 'api_reference',
   'Google Ads API Documentation',
   'https://developers.google.com/google-ads/api/docs',
   'html', 'active', 'critical',
   'Google Ads API ana referans dökümantasyonu'),

  ('google', 'release_notes',
   'Google Ads API Release Notes',
   'https://developers.google.com/google-ads/api/docs/release-notes',
   'html', 'active', 'high',
   'Google Ads API surüm notları ve degisiklikler'),

  ('google', 'policy',
   'Google Ads Policies',
   'https://support.google.com/adspolicy/',
   'html', 'active', 'critical',
   'Google Ads reklam politikalari'),

  ('google', 'docs',
   'Google Ads Campaign Types',
   'https://support.google.com/google-ads/answer/2453998',
   'html', 'active', 'high',
   'Google Ads kampanya turleri genel bakis'),

  ('google', 'docs',
   'Google Ads Responsive Search Ads',
   'https://support.google.com/google-ads/answer/7684791',
   'html', 'active', 'high',
   'Responsive Search Ads (RSA) olusturma ve yonetim')

ON CONFLICT (platform, title) DO NOTHING;

-- ── Seed: official_ads_sources — Meta ────────────────────────────────────────

INSERT INTO official_ads_sources
  (platform, source_type, title, url, fetch_strategy, status, importance, notes)
VALUES
  ('meta', 'api_reference',
   'Meta Marketing API Documentation',
   'https://developers.facebook.com/docs/marketing-apis',
   'html', 'active', 'critical',
   'Meta Marketing API ana referans dokumantasyonu'),

  ('meta', 'changelog',
   'Meta Marketing API Changelog',
   'https://developers.facebook.com/docs/graph-api/changelog',
   'html', 'active', 'high',
   'Meta Graph API ve Marketing API degisiklik gunlugu'),

  ('meta', 'docs',
   'Meta Ads Campaign Objectives',
   'https://www.facebook.com/business/help/1438417609341171',
   'html', 'review_required', 'high',
   'Meta Ads kampanya amacları — URL dogrulama gerekli'),

  ('meta', 'docs',
   'Meta Ad Creative Reference',
   'https://developers.facebook.com/docs/marketing-api/reference/ad-creative',
   'html', 'active', 'medium',
   'Meta reklam yaratici varliklari ve CTA referansi'),

  ('meta', 'policy',
   'Meta Advertising Policies',
   'https://www.facebook.com/policies/ads/',
   'html', 'active', 'critical',
   'Meta Ads reklam politikalari')

ON CONFLICT (platform, title) DO NOTHING;

-- ── Seed: official_ads_knowledge_items — Meta Objectives ─────────────────────
-- adCreator.ts META_OBJECTIVE_KNOWLEDGE'dan türetilmistir.
-- source_url='internal:seed:adCreator.ts' — resmi kaynak degil, ic seed.

INSERT INTO official_ads_knowledge_items
  (platform, category, title, normalized_key, summary,
   rules_json, allowed_values, compatibility_json,
   source_url, confidence, review_status, approved_by, approved_at, version)
VALUES

  ('meta', 'objective',
   'OUTCOME_TRAFFIC — Trafik',
   'meta.objective.outcome_traffic',
   'Web sitesine veya uygulamaya trafik cekme kampanyasi. Min butce 35 TL. CTR benchmark %1.5.',
   '{"label":"Trafik","purpose":"Web sitesine veya uygulamaya trafik cekmek","minBudget":35,"ctrBenchmark":1.5,"keyMetrics":["CTR","CPC","Landing Page Views"]}',
   '["LANDING_PAGE_VIEWS","LINK_CLICKS"]',
   '{"bestDestinations":["WEBSITE","APP"],"idealCTAs":["LEARN_MORE","SHOP_NOW"]}',
   'internal:seed:adCreator.ts', 0.75, 'approved', 'system:seed', NOW(), 1),

  ('meta', 'objective',
   'OUTCOME_AWARENESS — Bilinirlik',
   'meta.objective.outcome_awareness',
   'Marka bilinirligini artirma kampanyasi. Min butce 100 TL. CTR benchmark %0.5.',
   '{"label":"Bilinirlik","purpose":"Markanizin bilinirligini artirmak","minBudget":100,"ctrBenchmark":0.5,"keyMetrics":["Reach","Frequency","CPM","Ad Recall Lift"]}',
   '["REACH","IMPRESSIONS","AD_RECALL_LIFT"]',
   '{"bestDestinations":["WEBSITE"],"idealCTAs":["LEARN_MORE"]}',
   'internal:seed:adCreator.ts', 0.75, 'approved', 'system:seed', NOW(), 1),

  ('meta', 'objective',
   'OUTCOME_ENGAGEMENT — Etkilesim',
   'meta.objective.outcome_engagement',
   'Begeni, yorum, paylasim veya mesaj etkilesimi. Min butce 35 TL. CTR benchmark %1.0.',
   '{"label":"Etkilesim","purpose":"Begeni, yorum, paylasim veya mesaj etkilesimi","minBudget":35,"ctrBenchmark":1.0,"keyMetrics":["Engagement","Conversations","Replies","CTR"]}',
   '["POST_ENGAGEMENT","CONVERSATIONS","REPLIES","THRUPLAY"]',
   '{"bestDestinations":["ON_PAGE","WEBSITE"],"idealCTAs":["SEND_MESSAGE","LEARN_MORE"]}',
   'internal:seed:adCreator.ts', 0.75, 'approved', 'system:seed', NOW(), 1),

  ('meta', 'objective',
   'OUTCOME_LEADS — Potansiyel Musteri',
   'meta.objective.outcome_leads',
   'Lead form veya mesaj ile potansiyel musteri toplama. Min butce 50 TL. CTR benchmark %1.0.',
   '{"label":"Potansiyel Musteri","purpose":"Lead form veya mesaj ile potansiyel musteri toplamak","minBudget":50,"ctrBenchmark":1.0,"keyMetrics":["Leads","CPL","Conversion Rate"]}',
   '["LEAD_GENERATION","OFFSITE_CONVERSIONS","REPLIES"]',
   '{"bestDestinations":["ON_AD","WHATSAPP","WEBSITE"],"idealCTAs":["SIGN_UP","GET_OFFER","CONTACT_US","SEND_MESSAGE"]}',
   'internal:seed:adCreator.ts', 0.75, 'approved', 'system:seed', NOW(), 1),

  ('meta', 'objective',
   'OUTCOME_SALES — Satis',
   'meta.objective.outcome_sales',
   'Online satis ve donusum optimize etme. Min butce 75 TL. CTR benchmark %1.0.',
   '{"label":"Satis","purpose":"Online satis ve donusum optimize etmek","minBudget":75,"ctrBenchmark":1.0,"keyMetrics":["ROAS","Purchases","CPA","Conversion Value"]}',
   '["OFFSITE_CONVERSIONS","VALUE"]',
   '{"bestDestinations":["WEBSITE","CATALOG"],"idealCTAs":["SHOP_NOW","GET_OFFER","BOOK_NOW"]}',
   'internal:seed:adCreator.ts', 0.75, 'approved', 'system:seed', NOW(), 1),

  ('meta', 'objective',
   'OUTCOME_APP_PROMOTION — Uygulama Tanitimi',
   'meta.objective.outcome_app_promotion',
   'Uygulama yukleme ve etkilesim kampanyasi. Min butce 50 TL. CTR benchmark %1.0.',
   '{"label":"Uygulama Tanitimi","purpose":"Uygulama yukleme ve etkilesim","minBudget":50,"ctrBenchmark":1.0,"keyMetrics":["Installs","CPI","App Events"]}',
   '["APP_INSTALLS","OFFSITE_CONVERSIONS"]',
   '{"bestDestinations":["APP"],"idealCTAs":["INSTALL_MOBILE_APP","USE_APP"]}',
   'internal:seed:adCreator.ts', 0.75, 'approved', 'system:seed', NOW(), 1)

ON CONFLICT (normalized_key, version) DO NOTHING;

-- ── Seed: official_ads_knowledge_items — Google Campaign Types ────────────────
-- adCreator.ts GOOGLE_TYPE_KNOWLEDGE'dan türetilmistir.

INSERT INTO official_ads_knowledge_items
  (platform, category, title, normalized_key, summary,
   rules_json, allowed_values, compatibility_json,
   source_url, confidence, review_status, approved_by, approved_at, version)
VALUES

  ('google', 'campaign_type',
   'SEARCH — Arama',
   'google.campaign_type.search',
   'Google aramalarinda metin reklamlari ile aktif niyetli kullanicilara ulasma. Min butce 50 TL. CTR benchmark %3.0.',
   '{"label":"Arama","purpose":"Google aramalarinda metin reklamlari ile aktif niyetli kullanicilara ulasmak","minBudget":50,"ctrBenchmark":3.0,"biddingUpgradePath":"MAXIMIZE_CLICKS to MAXIMIZE_CONVERSIONS (15+ donusum) to TARGET_CPA (30+ donusum)","keyMetrics":["CTR","CPC","Quality Score","Impression Share","Conversions"]}',
   '["MAXIMIZE_CLICKS","MAXIMIZE_CONVERSIONS","TARGET_CPA"]',
   NULL,
   'internal:seed:adCreator.ts', 0.75, 'approved', 'system:seed', NOW(), 1),

  ('google', 'campaign_type',
   'DISPLAY — Goruntulu Reklam',
   'google.campaign_type.display',
   'Web sitelerinde gorsel reklamlar ile genis kitleye ulasma veya retargeting. Min butce 30 TL. CTR benchmark %0.5.',
   '{"label":"Goruntulu Reklam","purpose":"Web sitelerinde gorsel reklamlar ile genis kitleye ulasmak veya retargeting","minBudget":30,"ctrBenchmark":0.5,"biddingUpgradePath":"MAXIMIZE_CLICKS to MAXIMIZE_CONVERSIONS to TARGET_CPA","keyMetrics":["Impressions","CTR","Conversions","View-through Conversions"]}',
   '["MAXIMIZE_CLICKS","MAXIMIZE_CONVERSIONS","TARGET_CPA"]',
   NULL,
   'internal:seed:adCreator.ts', 0.75, 'approved', 'system:seed', NOW(), 1),

  ('google', 'campaign_type',
   'VIDEO — Video',
   'google.campaign_type.video',
   'YouTube video reklamlari ile marka bilinirlik ve etkilesim. Min butce 30 TL. CTR benchmark %0.5.',
   '{"label":"Video","purpose":"YouTube video reklamlari ile marka bilinirlik ve etkilesim","minBudget":30,"ctrBenchmark":0.5,"biddingUpgradePath":"TARGET_CPM (bilinirlik) to MAXIMIZE_CONVERSIONS (performans)","keyMetrics":["Views","View Rate","CPV","Watch Time"]}',
   '["MAXIMIZE_CLICKS","TARGET_CPM"]',
   NULL,
   'internal:seed:adCreator.ts', 0.75, 'approved', 'system:seed', NOW(), 1),

  ('google', 'campaign_type',
   'PERFORMANCE_MAX — Maksimum Performans',
   'google.campaign_type.performance_max',
   'Tum Google kanallarinda otomatik optimizasyon. Min butce 75 TL. CTR benchmark %1.0.',
   '{"label":"Maksimum Performans","purpose":"Tum Google kanallarinda (Arama, Display, YouTube, Gmail, Maps) otomatik optimizasyon","minBudget":75,"ctrBenchmark":1.0,"biddingUpgradePath":"MAXIMIZE_CONVERSIONS to TARGET_ROAS (50+ donusum)","keyMetrics":["Conversions","ROAS","Conversion Value","CPA"]}',
   '["MAXIMIZE_CONVERSIONS","MAXIMIZE_CONVERSION_VALUE","TARGET_ROAS"]',
   NULL,
   'internal:seed:adCreator.ts', 0.75, 'approved', 'system:seed', NOW(), 1),

  ('google', 'campaign_type',
   'SHOPPING — Alisveris',
   'google.campaign_type.shopping',
   'Urun listeleme reklamlari ile e-ticaret satislari. Min butce 50 TL. CTR benchmark %1.0.',
   '{"label":"Alisveris","purpose":"Urun listeleme reklamlari ile e-ticaret satislari","minBudget":50,"ctrBenchmark":1.0,"biddingUpgradePath":"MAXIMIZE_CLICKS to TARGET_ROAS","keyMetrics":["ROAS","Clicks","Conversions","Impression Share"]}',
   '["MAXIMIZE_CLICKS","TARGET_ROAS"]',
   NULL,
   'internal:seed:adCreator.ts', 0.75, 'approved', 'system:seed', NOW(), 1),

  ('google', 'campaign_type',
   'DEMAND_GEN — Talep Olusturma',
   'google.campaign_type.demand_gen',
   'YouTube, Gmail ve Discover uzerinden talep olusturma. Min butce 50 TL. CTR benchmark %0.5.',
   '{"label":"Talep Olusturma","purpose":"YouTube, Gmail ve Discover uzerinden talep olusturma","minBudget":50,"ctrBenchmark":0.5,"biddingUpgradePath":"MAXIMIZE_CLICKS to MAXIMIZE_CONVERSIONS","keyMetrics":["Clicks","Conversions","CTR","Engagement"]}',
   '["MAXIMIZE_CLICKS","MAXIMIZE_CONVERSIONS"]',
   NULL,
   'internal:seed:adCreator.ts', 0.75, 'approved', 'system:seed', NOW(), 1)

ON CONFLICT (normalized_key, version) DO NOTHING;
