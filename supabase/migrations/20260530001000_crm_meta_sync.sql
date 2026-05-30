-- ─────────────────────────────────────────────────────────────
-- CRM — Faz 2: Meta senkron izleme sütunları (crm_leads)
--
-- Olumlu/olumsuz işaretlenen lead Meta'ya senkronlanır (CUSTOMER_LIST custom
-- audience + opsiyonel CAPI QualifiedLead). Bu sütunlar senkron durumunu izler:
--   meta_synced_at  : son başarılı senkron zamanı (UI rozeti)
--   meta_capi_sent  : CAPI QualifiedLead olayı gönderildi mi (tekrar göndermeyi engeller)
--   meta_sync_error : son senkron hatası (varsa)
--
-- Yalnız additive; mevcut crm_leads tablosuna sütun ekler. Idempotent.
-- ÖNEMLİ: 20260530000000_create_crm_tables.sql'den SONRA uygulanmalı.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS meta_synced_at  timestamptz,
  ADD COLUMN IF NOT EXISTS meta_capi_sent  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meta_sync_error text;
