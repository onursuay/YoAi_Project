-- ─────────────────────────────────────────────────────────────
-- SEO — site_content_briefs (Hedef site içerik kimliği brief'i)
--
-- Her site_connection için Claude'un siteyi tarayıp sentezlediği
-- siteye-özgü kimlik. SEO konu seçimi bu brief'ten beslenir →
-- çoklu işletme/site doğru çalışır.
--
-- + article_schedules'e kategori hedefleme ve esnek takvim kolonları
--   (tümü additive, NULLABLE/DEFAULT → geriye dönük uyumlu).
--
-- Idempotent: tekrar çalıştırılabilir.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.site_content_briefs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  site_connection_id   uuid NOT NULL REFERENCES public.site_connections(id) ON DELETE CASCADE,
  scan_status          text NOT NULL DEFAULT 'pending'
                         CHECK (scan_status IN ('pending','running','completed','partial','failed')),
  company_name         text,
  sector               text,
  brand_tone           text,
  target_audience      text,
  products_or_services text[] NOT NULL DEFAULT '{}',
  categories           text[] NOT NULL DEFAULT '{}',
  keyword_themes       text[] NOT NULL DEFAULT '{}',
  content_angles       text[] NOT NULL DEFAULT '{}',
  audience_pains       text[] NOT NULL DEFAULT '{}',
  summary_text         text,
  last_error           text,
  scanned_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_content_briefs_conn
  ON public.site_content_briefs(site_connection_id);
CREATE INDEX IF NOT EXISTS idx_site_content_briefs_user
  ON public.site_content_briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_site_content_briefs_scanned
  ON public.site_content_briefs(scanned_at);

ALTER TABLE public.site_content_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_content_briefs_select_own" ON public.site_content_briefs;
CREATE POLICY "site_content_briefs_select_own"
  ON public.site_content_briefs FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "site_content_briefs_insert_own" ON public.site_content_briefs;
CREATE POLICY "site_content_briefs_insert_own"
  ON public.site_content_briefs FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "site_content_briefs_update_own" ON public.site_content_briefs;
CREATE POLICY "site_content_briefs_update_own"
  ON public.site_content_briefs FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "site_content_briefs_delete_own" ON public.site_content_briefs;
CREATE POLICY "site_content_briefs_delete_own"
  ON public.site_content_briefs FOR DELETE USING (user_id = auth.uid());

-- article_schedules — kategori hedefleme + esnek takvim (additive)
ALTER TABLE public.article_schedules
  ADD COLUMN IF NOT EXISTS target_categories text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.article_schedules
  ADD COLUMN IF NOT EXISTS schedule_mode text
    CHECK (schedule_mode IS NULL OR schedule_mode IN ('daily','weekly_days','monthly_days'));
ALTER TABLE public.article_schedules
  ADD COLUMN IF NOT EXISTS days_of_week int[] NOT NULL DEFAULT '{}';
ALTER TABLE public.article_schedules
  ADD COLUMN IF NOT EXISTS days_of_month int[] NOT NULL DEFAULT '{}';
