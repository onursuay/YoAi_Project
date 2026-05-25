-- ─────────────────────────────────────────────────────────────
-- YoAi — audiences tablosu EKSİK KOLON tamamlama
--
-- Tespit: omddq'da audiences tablosu repo migration'ından (20260304_create_audiences)
-- EKSİK uygulanmış. Var olan: id, type, source, name, status, user_id, created_at,
-- updated_at (+ ad_account_id sonradan eklendi). EKSİK olan 7 kolon, kitle
-- oluşturma/gönderme insert/update'ini bozuyordu ("Could not find the 'X' column
-- of 'audiences' in the schema cache"):
--   • yoai_spec_json    — INSERT'te zorunlu (kitle spec'i) → en kritik
--   • meta_audience_id  — Meta'ya gönderince yazılır
--   • description, meta_payload_json, error_code, error_message, last_synced_at
--
-- Hepsi additive + IF NOT EXISTS → idempotent, mevcut satırları bozmaz (tablo zaten boş).
-- Bu kolonlar eklenince hem manuel kitle oluşturma (POST /api/audiences) hem
-- Strateji'nin AI persona → kitle üretimi (job-runner) hem de Meta'ya gönderme çalışır.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.audiences
  ADD COLUMN IF NOT EXISTS description       TEXT,
  ADD COLUMN IF NOT EXISTS yoai_spec_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS meta_payload_json JSONB,
  ADD COLUMN IF NOT EXISTS meta_audience_id  TEXT,
  ADD COLUMN IF NOT EXISTS error_code        TEXT,
  ADD COLUMN IF NOT EXISTS error_message     TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at    TIMESTAMPTZ;

DO $$
BEGIN
  RAISE NOTICE 'audiences eksik kolonlar tamamlandı: description, yoai_spec_json, meta_payload_json, meta_audience_id, error_code, error_message, last_synced_at.';
END $$;
