-- email_sends: 'complained' status ekleniyor
ALTER TABLE public.email_sends
  DROP CONSTRAINT IF EXISTS email_sends_status_check;

ALTER TABLE public.email_sends
  ADD CONSTRAINT email_sends_status_check
  CHECK (status IN ('queued','sent','delivered','bounced','complained','failed'));
