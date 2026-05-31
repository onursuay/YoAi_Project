-- ─────────────────────────────────────────────────────────────
-- Email Marketing — Gönderim hesabı: 'platform' (alt mail) tipi + reply_to
--
-- platform : Kurulum gerektirmeyen "alt mail" — platformun doğrulanmış
--   domaininden, kullanıcının seçtiği gönderen adıyla, yanıt adresi (reply_to)
--   kullanıcının kendi e-postası olacak şekilde gönderir.
-- reply_to : Yanıtların gideceği adres (özellikle platform/domain için).
--
-- Additive + idempotent.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.email_sending_accounts DROP CONSTRAINT IF EXISTS email_sending_accounts_type_check;
ALTER TABLE public.email_sending_accounts ADD CONSTRAINT email_sending_accounts_type_check
  CHECK (type IN ('smtp', 'domain', 'gmail', 'outlook', 'platform'));

ALTER TABLE public.email_sending_accounts ADD COLUMN IF NOT EXISTS reply_to text;
