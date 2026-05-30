-- Multi-account slot tracking: user'ın seçtiği reklam hesaplarını
-- (Meta + Google Ads) plan tier'ına bağlı slot sayısıyla saklar.
-- NOT: omddq'ya elle uygulanmalı (canonical Supabase project).

CREATE TABLE IF NOT EXISTS user_selected_ad_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google_ads')),
  account_id TEXT NOT NULL,
  account_name TEXT,
  slot_index INT NOT NULL CHECK (slot_index >= 1 AND slot_index <= 20),
  selected_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Her kullanıcı için platform başına slot benzersiz
  UNIQUE (user_id, platform, slot_index),
  -- Aynı hesap iki slot'a girmesin
  UNIQUE (user_id, platform, account_id)
);

CREATE INDEX IF NOT EXISTS idx_user_selected_ad_accounts_user
  ON user_selected_ad_accounts (user_id, platform, slot_index);
