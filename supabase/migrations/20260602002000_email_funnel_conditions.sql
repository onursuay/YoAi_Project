-- supabase/migrations/20260602002000_email_funnel_conditions.sql
-- email_automation_steps: koşul kolonu
ALTER TABLE public.email_automation_steps
  ADD COLUMN IF NOT EXISTS condition jsonb NOT NULL DEFAULT '{"type":"always"}';

-- email_drip_queue: parent bağlantısı + send kaydı
ALTER TABLE public.email_drip_queue
  ADD COLUMN IF NOT EXISTS parent_queue_id uuid REFERENCES public.email_drip_queue(id) ON DELETE SET NULL;

ALTER TABLE public.email_drip_queue
  ADD COLUMN IF NOT EXISTS email_send_id uuid REFERENCES public.email_sends(id) ON DELETE SET NULL;

-- 'skipped' status desteği
ALTER TABLE public.email_drip_queue
  DROP CONSTRAINT IF EXISTS email_drip_queue_status_check;

ALTER TABLE public.email_drip_queue
  ADD CONSTRAINT email_drip_queue_status_check
  CHECK (status IN ('pending','sent','failed','skipped'));
