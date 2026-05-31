-- ─────────────────────────────────────────────────────────────
-- Email Marketing — Faz 3 (CRM + CSV/Excel + Google Sheets → kampanya)
--
-- email_contacts      : birleşik kişi havuzu (kaynak: crm|csv|sheets|manual),
--                       opt_out (KVKK) burada. UNIQUE(user_id,email) tekilleştirir.
-- email_lists/_members: kişileri listelere/segmentlere ayırma.
-- email_campaigns     : kampanya (konu+içerik+segment+durum+istatistik).
-- email_sends         : her kişiye gönderim (Resend mesaj id, durum).
-- email_events        : Resend webhook olayları (delivered/opened/clicked/...).
-- email_automations   : aşama tetikli otomatik mailler.
-- email_domains       : doğrulanmış gönderim domaini (Resend).
--
-- Yalnız additive; RLS açık (uygulama service-role yazar). Idempotent.
-- ─────────────────────────────────────────────────────────────

-- CRM lead'i abonelikten çıkarsa ona bir daha mail gönderilmez (kaynak CRM olsa
-- da email_contacts'a aktarılmamış olsa da opt-out burada da izlenir).
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS email_opt_out boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.email_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text,
  phone       text,
  source      text NOT NULL DEFAULT 'manual',  -- crm | csv | sheets | manual
  crm_lead_id uuid,                              -- CRM'den geldiyse
  custom      jsonb NOT NULL DEFAULT '{}'::jsonb,
  opt_out     boolean NOT NULL DEFAULT false,
  opt_out_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);
CREATE INDEX IF NOT EXISTS idx_email_contacts_user ON public.email_contacts(user_id);

CREATE TABLE IF NOT EXISTS public.email_lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_lists_user ON public.email_lists(user_id);

CREATE TABLE IF NOT EXISTS public.email_list_members (
  list_id    uuid NOT NULL REFERENCES public.email_lists(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.email_contacts(id) ON DELETE CASCADE,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, contact_id)
);

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  name         text NOT NULL,
  subject      text NOT NULL DEFAULT '',
  from_name    text,
  from_email   text,
  html         text NOT NULL DEFAULT '',
  segment      jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {type:'crm_stage'|'list'|'all', ...}
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  scheduled_at timestamptz,
  sent_at      timestamptz,
  stats        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_user ON public.email_campaigns(user_id);

CREATE TABLE IF NOT EXISTS public.email_sends (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  contact_id  uuid REFERENCES public.email_contacts(id) ON DELETE SET NULL,
  email       text NOT NULL,
  resend_id   text,
  status      text NOT NULL DEFAULT 'queued',  -- queued|sent|delivered|bounced|failed
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, email)
);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign ON public.email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_resend ON public.email_sends(resend_id);

CREATE TABLE IF NOT EXISTS public.email_events (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id   uuid REFERENCES public.email_sends(id) ON DELETE CASCADE,
  user_id   uuid REFERENCES public.signups(id) ON DELETE CASCADE,
  type      text NOT NULL,  -- delivered|opened|clicked|bounced|complained|unsubscribed
  meta      jsonb NOT NULL DEFAULT '{}'::jsonb,
  at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_events_send ON public.email_events(send_id);

CREATE TABLE IF NOT EXISTS public.email_automations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  name       text NOT NULL,
  trigger    jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {type:'crm_stage_enter', stage:'uygun'}
  subject    text NOT NULL DEFAULT '',
  html       text NOT NULL DEFAULT '',
  enabled    boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_automations_user ON public.email_automations(user_id);

CREATE TABLE IF NOT EXISTS public.email_domains (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  domain           text NOT NULL,
  resend_domain_id text,
  status           text NOT NULL DEFAULT 'pending',  -- pending|verified|failed
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain)
);

-- RLS — uygulama service-role ile yazar/okur; policy'ler kullanıcı izolasyonu.
ALTER TABLE public.email_contacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_lists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sends       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_domains     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_contacts_own" ON public.email_contacts;
CREATE POLICY "email_contacts_own" ON public.email_contacts FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "email_lists_own" ON public.email_lists;
CREATE POLICY "email_lists_own" ON public.email_lists FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "email_campaigns_own" ON public.email_campaigns;
CREATE POLICY "email_campaigns_own" ON public.email_campaigns FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "email_sends_own" ON public.email_sends;
CREATE POLICY "email_sends_own" ON public.email_sends FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "email_automations_own" ON public.email_automations;
CREATE POLICY "email_automations_own" ON public.email_automations FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "email_domains_own" ON public.email_domains;
CREATE POLICY "email_domains_own" ON public.email_domains FOR SELECT USING (user_id = auth.uid());
