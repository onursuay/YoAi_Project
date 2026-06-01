-- Otomasyon gönderimlerini email_sends'e yazabilmek için:
-- 1) automation_id kolonu (nullable, FK)
-- 2) campaign_id NOT NULL kısıtını kaldır (otomasyon gönderiminde campaign_id NULL olur)
-- Her ikisi de geriye dönük güvenli: kısıt gevşetme + nullable kolon, mevcut satır/sorguları bozmaz.

ALTER TABLE public.email_sends
  ADD COLUMN IF NOT EXISTS automation_id uuid REFERENCES public.email_automations(id) ON DELETE SET NULL;

ALTER TABLE public.email_sends
  ALTER COLUMN campaign_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_sends_automation ON public.email_sends(automation_id);
