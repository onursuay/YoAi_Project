-- ─────────────────────────────────────────────────────────────
-- SEO — article_schedules (Otomatik günlük makale yayın zamanlaması)
--
-- Kullanıcı her gün belirttiği saatte otomatik SEO makale üretimi +
-- yayını için zamanlama tanımlar. Saatlik cron (0 * * * *) timezone
-- eşleştirmesiyle due olan zamanlamaları Inngest'e fan-out eder.
--
-- publish_time + timezone : kullanıcının YEREL saati (HH:MM 24h) +
--   IANA timezone. Cron, Intl ile UTC'yi yerele çevirip eşleştirir.
-- last_run_date : aynı yerel günde tekrar tetiklemeyi engeller (idempotency).
--
-- Idempotent: tekrar çalıştırılabilir.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.article_schedules (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  site_connection_id uuid REFERENCES public.site_connections(id) ON DELETE SET NULL,
  enabled            boolean NOT NULL DEFAULT true,
  frequency          text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekdays','weekly')),
  publish_time       text NOT NULL DEFAULT '09:00',
  timezone           text NOT NULL DEFAULT 'Europe/Istanbul',
  weekday            int,                      -- frequency='weekly' için 0=Pazar..6=Cumartesi
  tone               text NOT NULL DEFAULT 'Samimi',
  word_count         int  NOT NULL DEFAULT 500,
  keyword_pool       text[] NOT NULL DEFAULT '{}',  -- opsiyonel override havuzu (boşsa AI konu seçer)
  auto_publish       boolean NOT NULL DEFAULT true,  -- false = taslak bırak
  generate_image     boolean NOT NULL DEFAULT true,
  last_run_at        timestamptz,
  last_run_date      date,
  next_run_at        timestamptz,
  last_status        text,   -- 'success' | 'skipped_credits' | 'skipped_no_site' | 'error'
  last_error         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_article_schedules_user ON public.article_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_article_schedules_enabled
  ON public.article_schedules(enabled) WHERE enabled;

ALTER TABLE public.article_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "article_schedules_select_own" ON public.article_schedules;
CREATE POLICY "article_schedules_select_own"
  ON public.article_schedules FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "article_schedules_insert_own" ON public.article_schedules;
CREATE POLICY "article_schedules_insert_own"
  ON public.article_schedules FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "article_schedules_update_own" ON public.article_schedules;
CREATE POLICY "article_schedules_update_own"
  ON public.article_schedules FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "article_schedules_delete_own" ON public.article_schedules;
CREATE POLICY "article_schedules_delete_own"
  ON public.article_schedules FOR DELETE
  USING (user_id = auth.uid());
