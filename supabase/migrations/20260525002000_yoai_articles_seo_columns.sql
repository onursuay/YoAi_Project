-- ─────────────────────────────────────────────────────────────
-- SEO — yoai_articles için SEO/yayın kolonları (additive)
--
-- Mevcut yoai_articles tablosuna öne çıkan görsel, meta açıklama,
-- slug, zamanlama/site referansı ve kaynak (manuel/otomatik) ekler.
--
-- Tüm kolonlar nullable/default → mevcut insert/select akışı kırılmaz.
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.yoai_articles
  ADD COLUMN IF NOT EXISTS featured_image_url  text,
  ADD COLUMN IF NOT EXISTS featured_image_alt  text,
  ADD COLUMN IF NOT EXISTS meta_description     text,
  ADD COLUMN IF NOT EXISTS slug                 text,
  ADD COLUMN IF NOT EXISTS schedule_id          uuid REFERENCES public.article_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_connection_id   uuid REFERENCES public.site_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at         timestamptz,
  ADD COLUMN IF NOT EXISTS source               text NOT NULL DEFAULT 'manual';

-- source CHECK kısıtını (varsa) yeniden oluştur — idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public' AND table_name = 'yoai_articles'
      AND constraint_name = 'yoai_articles_source_check'
  ) THEN
    ALTER TABLE public.yoai_articles
      ADD CONSTRAINT yoai_articles_source_check CHECK (source IN ('manual','auto'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_yoai_articles_schedule ON public.yoai_articles(schedule_id);
CREATE INDEX IF NOT EXISTS idx_yoai_articles_site ON public.yoai_articles(site_connection_id);
