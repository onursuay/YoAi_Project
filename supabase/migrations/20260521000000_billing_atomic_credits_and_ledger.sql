-- Billing hardening: atomik kredi mutasyonları + kredi defteri (ledger).
--
-- SORUN: lib/billing/db.ts içindeki addCreditsServer/spendCreditsServer/
-- refundCreditsServer "oku-değiştir-yaz" yapıyordu → eşzamanlı işlemde lost
-- update / çift harcama / bakiye bozulması riski. Ödeme alınan bir üründe
-- bu kabul edilemez.
--
-- ÇÖZÜM: deduct_strategy_credit ile aynı desende, tek UPDATE/INSERT ile
-- atomik RPC'ler. Her mutasyon credit_transactions defterine de yazılır
-- (audit / uyuşmazlık / mutabakat için). RPC'ler service-role üzerinden
-- çağrılır (RLS bypass), tıpkı deduct_strategy_credit gibi.

-- ─────────────────────────────────────────────────────────────
-- 1. Kredi defteri (ledger) — her bakiye değişiminin değişmez kaydı
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  delta         int  NOT NULL,                 -- +kazanım / -harcama
  reason        text NOT NULL,                 -- purchase | bundled | grant | spend | refund
  balance_after int  NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user
  ON public.credit_transactions (user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 2. add_credits — atomik kredi ekleme (satır yoksa oluşturur)
--    Not: JS katmanı önce getCreditBalance ile 100-hoşgeldin satırını
--    idempotent oluşturur; INSERT dalı yalnız uç durum güvenlik ağıdır.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id uuid,
  p_amount  int,
  p_reason  text DEFAULT 'grant'
)
RETURNS SETOF public.credit_balances
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance int;
BEGIN
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT * FROM public.credit_balances WHERE user_id = p_user_id;
    RETURN;
  END IF;

  INSERT INTO public.credit_balances (user_id, balance, total_earned, total_spent)
  VALUES (p_user_id, p_amount, p_amount, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET balance      = public.credit_balances.balance + p_amount,
        total_earned = public.credit_balances.total_earned + p_amount,
        updated_at   = now()
  RETURNING balance INTO new_balance;

  INSERT INTO public.credit_transactions (user_id, delta, reason, balance_after)
  VALUES (p_user_id, p_amount, p_reason, new_balance);

  RETURN QUERY SELECT * FROM public.credit_balances WHERE user_id = p_user_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. spend_credits — atomik harcama (yetersizse 0 satır döner)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.spend_credits(
  p_user_id uuid,
  p_amount  int,
  p_reason  text DEFAULT 'spend'
)
RETURNS SETOF public.credit_balances
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance int;
BEGIN
  UPDATE public.credit_balances
  SET balance     = balance - p_amount,
      total_spent = total_spent + p_amount,
      updated_at  = now()
  WHERE user_id = p_user_id
    AND balance  >= p_amount
  RETURNING balance INTO new_balance;

  IF NOT FOUND THEN
    RETURN;  -- yetersiz bakiye / satır yok → 0 satır
  END IF;

  INSERT INTO public.credit_transactions (user_id, delta, reason, balance_after)
  VALUES (p_user_id, -p_amount, p_reason, new_balance);

  RETURN QUERY SELECT * FROM public.credit_balances WHERE user_id = p_user_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. refund_credits — atomik iade (total_spent 0'ın altına inmez)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user_id uuid,
  p_amount  int,
  p_reason  text DEFAULT 'refund'
)
RETURNS SETOF public.credit_balances
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance int;
BEGIN
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT * FROM public.credit_balances WHERE user_id = p_user_id;
    RETURN;
  END IF;

  UPDATE public.credit_balances
  SET balance     = balance + p_amount,
      total_spent = GREATEST(0, total_spent - p_amount),
      updated_at  = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO new_balance;

  IF NOT FOUND THEN
    RETURN;  -- satır yok → iade edilecek bakiye yok
  END IF;

  INSERT INTO public.credit_transactions (user_id, delta, reason, balance_after)
  VALUES (p_user_id, p_amount, p_reason, new_balance);

  RETURN QUERY SELECT * FROM public.credit_balances WHERE user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.add_credits    IS 'Atomik kredi ekleme + ledger kaydı. Yeni bakiye satırını döner.';
COMMENT ON FUNCTION public.spend_credits  IS 'Atomik kredi harcama: balance >= p_amount ise düşer + ledger. Yetersizse 0 satır döner.';
COMMENT ON FUNCTION public.refund_credits IS 'Atomik kredi iadesi + ledger. total_spent 0 altına inmez.';
