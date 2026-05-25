-- ─────────────────────────────────────────────────────────────
-- SEO — site_connections (Kullanıcının kendi web sitesi bağlantıları)
--
-- Kullanıcı kendi sitesini bağlar (WordPress / İdeaSoft / Shopify /
-- generic-webhook). Makaleler bu bağlantılar üzerinden yayınlanır.
--
-- Güvenlik:
--   - credentials_enc : AES-256-GCM ile ŞİFRELİ saklanır (lib/seo/crypto.ts).
--                       Düz metin gizli bilgi tutulmaz.
--   - user_id         : uuid → signups(id) ON DELETE CASCADE
--                       (yoai_articles ile tutarlı tenant izolasyonu).
--   - RLS aktiftir (savunma derinliği). Uygulama service-role ile
--     çalışır ve user_id cookie filtresiyle izolasyonu sağlar.
--
-- Idempotent: tekrar çalıştırılabilir.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.site_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  platform        text NOT NULL CHECK (platform IN ('wordpress','ideasoft','shopify','generic')),
  label           text,
  base_url        text NOT NULL,
  -- Tüm gizli alanlar (kullanıcı adı/şifre, app password, token, secret)
  -- tek JSON içinde AES-256-GCM ile şifrelenip "iv:tag:cipher" (base64) saklanır.
  credentials_enc text,
  shop_blog_id    text,   -- Shopify hedef blog id (gizli değil)
  webhook_url     text,   -- generic hedef URL (gizli değil; secret credentials_enc içinde)
  is_default      boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','error','revoked')),
  last_error      text,
  last_checked_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_connections_user ON public.site_connections(user_id);

-- Kullanıcı başına yalnızca tek varsayılan bağlantı.
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_connections_one_default
  ON public.site_connections(user_id) WHERE is_default;

ALTER TABLE public.site_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_connections_select_own" ON public.site_connections;
CREATE POLICY "site_connections_select_own"
  ON public.site_connections FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "site_connections_insert_own" ON public.site_connections;
CREATE POLICY "site_connections_insert_own"
  ON public.site_connections FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "site_connections_update_own" ON public.site_connections;
CREATE POLICY "site_connections_update_own"
  ON public.site_connections FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "site_connections_delete_own" ON public.site_connections;
CREATE POLICY "site_connections_delete_own"
  ON public.site_connections FOR DELETE
  USING (user_id = auth.uid());
