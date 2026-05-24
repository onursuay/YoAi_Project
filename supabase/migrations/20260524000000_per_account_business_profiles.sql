-- ─────────────────────────────────────────────────────────────
-- YoAi — Çoklu İşletme (Per-Account Business Profiles) — Faz 0
--
-- Sorun: Bir kullanıcı birden fazla reklam hesabı/işletme yönetebilir
-- (örn. "Antso Denizcilik" + "Belgemod"). Ama user_business_profiles ve
-- user_business_intelligence kullanıcı başına TEK profil tutuyor
-- (UNIQUE(user_id)). Tarama, tek profili tüm hesaplara uyguluyor →
-- yanlış "marka uyumsuz" uyarıları. account_alerts da hesaba göre
-- ayrılamıyor (account_id kolonu yok).
--
-- Bu migration: işletme-ayırt-edici kolonları EKLER (additive).
--   • Tüm yeni kolonlar NULLABLE, IF NOT EXISTS → mevcut tek-profil
--     kullanıcıları AYNEN çalışır (NULL = legacy/global profil).
--   • UNIQUE(user_id) kısıtı KASITLI olarak DEĞİŞTİRİLMEZ. Çoklu profil
--     yazımı YOAI_PER_ACCOUNT_SCOPE flag'i + backfill sonrası (Faz 3)
--     açılacak. Bu adımda sıfır regresyon.
--   • Sadece okuma/yazma katmanı (flag arkasında) bu kolonları kullanır.
--
-- Anahtarlama: işletme = kayıtlı reklam hesabı kimliği (account_id).
--   business_key konvansiyonu: 'meta:<metaAccountId>' (Meta varsa),
--   yoksa 'google:<customerId>'. meta_account_id + google_customer_id
--   ayrıca tutulur → scope'un her iki platformu da doğru profile eşlenir.
-- ─────────────────────────────────────────────────────────────

-- ── 1) user_business_profiles — hesap-ayırt-edici kolonlar ────
ALTER TABLE public.user_business_profiles
  ADD COLUMN IF NOT EXISTS business_key        TEXT,
  ADD COLUMN IF NOT EXISTS meta_account_id     TEXT,
  ADD COLUMN IF NOT EXISTS google_customer_id  TEXT;

CREATE INDEX IF NOT EXISTS user_business_profiles_business_key_idx
  ON public.user_business_profiles (user_id, business_key);
CREATE INDEX IF NOT EXISTS user_business_profiles_meta_idx
  ON public.user_business_profiles (user_id, meta_account_id);
CREATE INDEX IF NOT EXISTS user_business_profiles_google_idx
  ON public.user_business_profiles (user_id, google_customer_id);

-- ── 2) user_business_intelligence — aynı boyut (profile_id zaten var) ──
ALTER TABLE public.user_business_intelligence
  ADD COLUMN IF NOT EXISTS business_key TEXT;

CREATE INDEX IF NOT EXISTS user_business_intelligence_business_key_idx
  ON public.user_business_intelligence (user_id, business_key);

-- ── 3) account_alerts — hesap boyutu ──────────────────────────
-- account_id NULL = legacy/hesap-genel uyarı (mevcut kayıtlar böyle kalır).
ALTER TABLE public.account_alerts
  ADD COLUMN IF NOT EXISTS account_id   TEXT,
  ADD COLUMN IF NOT EXISTS business_key TEXT;

CREATE INDEX IF NOT EXISTS idx_account_alerts_user_account
  ON public.account_alerts (user_id, account_id, status, created_at DESC);

-- ── 4) Bilgilendirme ──────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Faz 0 (çoklu işletme) kolonları hazır: business_key/meta_account_id/google_customer_id (profiles), business_key (intelligence), account_id/business_key (account_alerts). UNIQUE(user_id) korundu.';
END $$;
