-- KVKK/GDPR + Meta Platform: veri silme talepleri kaydı.
-- Hem kullanıcının kendi self-service silme talebini hem Meta'nın data-deletion
-- callback'ini kaydeder (talep asla sessizce düşmesin; denetlenebilir olsun).
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,                         -- kendi hesabını silen kullanıcı (varsa)
  fb_user_id text,                      -- Meta callback'inde gelen Facebook user id (varsa)
  source text not null,                 -- 'self' | 'meta_callback'
  status text not null default 'pending', -- 'pending' | 'processed'
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_deletion_requests_status on public.account_deletion_requests (status);

-- RLS: yalnız service-role erişir; anon deny-all.
alter table public.account_deletion_requests enable row level security;
