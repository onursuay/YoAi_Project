-- YoAi Business Profile Tables
-- user_business_profiles, user_business_competitors,
-- user_business_source_scans, user_business_intelligence

-- ── 1. user_business_profiles ────────────────────────────────
create table if not exists public.user_business_profiles (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     text not null unique,
  company_name                text not null default '',
  sector_main                 text,
  sector_sub                  text,
  specialization              text,
  business_description        text,
  main_conversion_goal        text,
  target_locations            text[]  not null default '{}',
  target_audience             text,
  website_url                 text,
  instagram_url               text,
  facebook_url                text,
  linkedin_url                text,
  youtube_url                 text,
  tiktok_url                  text,
  google_business_profile_url text,
  marketplace_url             text,
  keywords                    text[]  not null default '{}',
  products_or_services        text[]  not null default '{}',
  most_profitable_services    text[]  not null default '{}',
  monthly_ad_budget_range     text,
  brand_tone                  text,
  forbidden_claims            text[]  not null default '{}',
  compliance_notes            text,
  extra_notes                 text,
  onboarding_completed        boolean not null default false,
  profile_confidence          integer not null default 0,
  scan_status                 text    not null default 'pending',
  intelligence_status         text    not null default 'pending',
  last_scan_started_at        timestamptz,
  last_scan_completed_at      timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- ── 2. user_business_competitors ─────────────────────────────
create table if not exists public.user_business_competitors (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null,
  profile_id       uuid not null references public.user_business_profiles(id) on delete cascade,
  competitor_name  text not null default '',
  website_url      text,
  instagram_url    text,
  facebook_url     text,
  linkedin_url     text,
  youtube_url      text,
  tiktok_url       text,
  google_business_url text,
  extra_url        text,
  scan_status      text    not null default 'pending',
  scan_error       text,
  confidence       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_user_business_competitors_profile_id
  on public.user_business_competitors(profile_id);

-- ── 3. user_business_source_scans ────────────────────────────
create table if not exists public.user_business_source_scans (
  id                    uuid primary key default gen_random_uuid(),
  user_id               text not null,
  profile_id            uuid not null references public.user_business_profiles(id) on delete cascade,
  competitor_id         uuid references public.user_business_competitors(id) on delete set null,
  source_owner_type     text not null,
  source_type           text not null,
  source_url            text,
  scan_status           text not null default 'pending',
  raw_excerpt           text,
  extracted_title       text,
  extracted_description text,
  extracted_services    text[] not null default '{}',
  extracted_products    text[] not null default '{}',
  extracted_keywords    text[] not null default '{}',
  extracted_audience    text,
  extracted_locations   text[] not null default '{}',
  extracted_ctas        text[] not null default '{}',
  extracted_brand_tone  text,
  extracted_offers      text[] not null default '{}',
  extracted_social_proof text,
  confidence            integer not null default 0,
  error_message         text,
  scanned_at            timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists idx_user_business_source_scans_profile_id
  on public.user_business_source_scans(profile_id);

-- ── 4. user_business_intelligence ────────────────────────────
create table if not exists public.user_business_intelligence (
  id                                  uuid primary key default gen_random_uuid(),
  user_id                             text not null unique,
  profile_id                          uuid not null references public.user_business_profiles(id) on delete cascade,
  company_summary                     text,
  business_model                      text,
  sector_summary                      text,
  local_market_summary                text,
  services_summary                    text,
  products_summary                    text,
  target_audience_summary             text,
  conversion_goal_summary             text,
  competitor_summary                  text,
  competitor_positioning_summary      text,
  keyword_themes                      text[] not null default '{}',
  recommended_google_campaign_types   text[] not null default '{}',
  recommended_meta_objectives         text[] not null default '{}',
  recommended_content_angles          text[] not null default '{}',
  recommended_offer_angles            text[] not null default '{}',
  risk_claims                         text[] not null default '{}',
  forbidden_claims                    text[] not null default '{}',
  brand_positioning                   text,
  audience_pains                      text[] not null default '{}',
  audience_motivations                text[] not null default '{}',
  location_insights                   text,
  source_coverage                     jsonb,
  confidence                          integer not null default 0,
  missing_data                        text[] not null default '{}',
  last_generated_at                   timestamptz,
  created_at                          timestamptz not null default now(),
  updated_at                          timestamptz not null default now()
);
