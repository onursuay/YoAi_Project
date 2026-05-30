-- ─────────────────────────────────────────────────────────────
-- CRM — Faz 1: Reklam lead'leri (Meta Lead Ads → CRM)
--
-- crm_page_subscriptions : webhook page_id → user_id eşlemesi. Kullanıcı CRM'i
--   bir Facebook Page'ine bağladığında o page leadgen webhook'una abone edilir;
--   gelen webhook'lar yalnız page_id taşıdığından user'ı buradan çözeriz.
-- crm_leads : Lead Ads formlarından düşen lead'ler. UNIQUE(user_id,meta_leadgen_id)
--   webhook tekrarlarına karşı idempotency sağlar. status = new|positive|negative.
--
-- Yalnız additive; mevcut tablolara dokunmaz. Idempotent (IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.crm_page_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  page_id       text NOT NULL,
  page_name     text,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_page_subs_user ON public.crm_page_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS public.crm_leads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  source            text NOT NULL DEFAULT 'meta',
  meta_leadgen_id   text NOT NULL,
  meta_form_id      text,
  meta_page_id      text,
  form_name         text,
  ad_id             text,
  campaign_name     text,
  full_name         text,
  email             text,
  phone             text,
  raw_field_data    jsonb NOT NULL DEFAULT '[]'::jsonb,  -- ham field_data (ad/email/telefon dışı tüm alanlar)
  status            text NOT NULL DEFAULT 'new' CHECK (status IN ('new','positive','negative')),
  note              text,
  lead_created_time timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, meta_leadgen_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_user_status  ON public.crm_leads(user_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_user_created ON public.crm_leads(user_id, created_at DESC);

-- RLS — uygulama service-role ile yazar/okur; policy'ler doğrudan istemci
-- erişimine karşı kullanıcı izolasyonunu korur (mevcut tablolarla aynı desen).
ALTER TABLE public.crm_page_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_page_subs_select_own" ON public.crm_page_subscriptions;
CREATE POLICY "crm_page_subs_select_own" ON public.crm_page_subscriptions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "crm_leads_select_own" ON public.crm_leads;
CREATE POLICY "crm_leads_select_own" ON public.crm_leads
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "crm_leads_update_own" ON public.crm_leads;
CREATE POLICY "crm_leads_update_own" ON public.crm_leads
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
