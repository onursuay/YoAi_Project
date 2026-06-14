-- Web Site Yöneticisi — Faz 1a temel tablolar (additive + idempotent). CANONICAL (omddq).
-- websites = site kaydı + tema; website_pages = sayfa modeli (JSON bölümler); website_versions = sürüm/rollback.

CREATE TABLE IF NOT EXISTS public.websites (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              TEXT NOT NULL,
  label                TEXT NOT NULL,
  subdomain            TEXT NOT NULL,
  site_type            TEXT NOT NULL DEFAULT 'multipage' CHECK (site_type IN ('landing','multipage')),
  default_locale       TEXT NOT NULL DEFAULT 'tr',
  locales              TEXT[] NOT NULL DEFAULT '{tr}',
  category             TEXT,
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','unpublished')),
  theme                JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_version_id UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_websites_subdomain ON public.websites (subdomain);
CREATE INDEX IF NOT EXISTS idx_websites_user_created ON public.websites (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.website_pages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id   UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  locale       TEXT NOT NULL,
  slug         TEXT NOT NULL,
  page_role    TEXT NOT NULL,
  sections     JSONB NOT NULL DEFAULT '[]'::jsonb,
  seo          JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_website_pages_unique ON public.website_pages (website_id, locale, slug);
CREATE INDEX IF NOT EXISTS idx_website_pages_website ON public.website_pages (website_id);

CREATE TABLE IF NOT EXISTS public.website_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id     UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  snapshot       JSONB NOT NULL,
  reason         TEXT NOT NULL CHECK (reason IN ('initial','revision','rollback')),
  credit_charged INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_versions_website ON public.website_versions (website_id, created_at DESC);

-- RLS (service-role bypass + app-katmanı user_id filtresi; mevcut desenle aynı).
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "websites_own" ON public.websites;
CREATE POLICY "websites_own" ON public.websites
  USING (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)))
  WITH CHECK (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)));

DROP POLICY IF EXISTS "website_pages_own" ON public.website_pages;
CREATE POLICY "website_pages_own" ON public.website_pages
  USING (EXISTS (SELECT 1 FROM public.websites w WHERE w.id = website_id
    AND w.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))));

DROP POLICY IF EXISTS "website_versions_own" ON public.website_versions;
CREATE POLICY "website_versions_own" ON public.website_versions
  USING (EXISTS (SELECT 1 FROM public.websites w WHERE w.id = website_id
    AND w.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))));

COMMENT ON TABLE public.websites IS 'Web Site Yöneticisi Faz 1 — site kaydı + tema. RLS bypass via service role (app-layer scope).';
