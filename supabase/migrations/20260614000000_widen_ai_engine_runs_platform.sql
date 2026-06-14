-- ──────────────────────────────────────────────────────────
-- ai_engine_runs.platform CHECK genişletme
--
-- SORUN: 20260519000000 ile gelen constraint platform'u yalnız ('Meta','Google')
-- ile sınırlıyordu. YoAlgoritma hiyerarşik akış (writeHierRunStatus) koşu-durumunu
-- platform='yoalgoritma_hier' satırıyla yazar → CHECK 23514 ile REDDEDİYORDU.
-- Sonuç: tüm hiyerarşik run-status yazımları SESSİZCE başarısız (try/catch yutuyordu),
-- Sağlık Merkezi + Gözetim Merkezi hiçbir failed/stale koşu göremiyordu (gözlemlenebilirlik kör).
--
-- ÇÖZÜM: CHECK'i 'yoalgoritma_hier' içerecek şekilde GENİŞLET. Additive/güvenli —
-- mevcut satırlar ('Meta'/'Google') yeni constraint'i zaten sağlar, çalışan akış bozulmaz.
-- ──────────────────────────────────────────────────────────

ALTER TABLE ai_engine_runs DROP CONSTRAINT IF EXISTS ai_engine_runs_platform_check;

ALTER TABLE ai_engine_runs ADD CONSTRAINT ai_engine_runs_platform_check
  CHECK (platform IN ('Meta', 'Google', 'yoalgoritma_hier'));
