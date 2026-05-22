-- YoAlgoritma per-account (Madde 2 — Faz 3.3b)
-- yoai_daily_runs artık hangi (Meta + Google) seçim için üretildiyse onun imzasını
-- taşır (account_scope). command-center, aktif seçimle eşleşmeyen çalışmayı
-- GÖSTERMEZ → kullanıcı başka hesaba geçince o hesap için yeniden analiz tetiklenir
-- (belgemod sorunu çözülür). Additive + nullable — mevcut satırlar ve akış bozulmaz;
-- damgasız (NULL) eski satırlar geriye-uyum için gösterilmeye devam eder.

ALTER TABLE yoai_daily_runs ADD COLUMN IF NOT EXISTS account_scope TEXT;
