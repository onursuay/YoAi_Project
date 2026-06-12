-- Abonelik iptali (dönem sonunda yenileme yok). Erişim current_period_end'e
-- kadar korunur; otomatik yenileme (iyzico kart-saklama) eklendiğinde renewal
-- bu bayrağı kontrol edip yenilemeyi durdurur. Şu an recurring yok → bayrak
-- mesajlaşma + ileride yenileme kararı içindir.
alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;
