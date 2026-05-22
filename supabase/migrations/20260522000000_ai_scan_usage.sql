-- Optimizasyon — sunucu-otoriter günlük AI scan limiti + overage kredi düşme.
--
-- SORUN: "AI ile Tara" günlük limiti yalnızca client-side localStorage'da
-- tutuluyordu (lib/subscription/storage.ts). Teknik kullanıcı doğrudan
-- /api/meta/optimization/magic-scan?useAI=true çağrısıyla limiti bypass
-- edebiliyordu — ücretli AI çağrısı için gelir/kaynak sızıntısı.
--
-- ÇÖZÜM: deduct_strategy_credit / spend_credits ile aynı desende, tek
-- atomik RPC. Günlük ücretsiz kota sunucuda sayılır; kota dolunca mevcut
-- kredi bakiyesinden overage düşülür (yetersizse izin verilmez). Para-kritik
-- adım (kredi düşme) yarış-güvenli UPDATE...WHERE balance>=cost ile yapılır.

-- ─────────────────────────────────────────────────────────────
-- 1. Günlük AI scan kullanım sayacı (kullanıcı + gün)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_scan_usage (
  user_id    uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  scan_date  date NOT NULL,
  count      int  NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scan_date)
);

-- Yalnız SECURITY DEFINER RPC / service-role erişir — doğrudan client erişimi kapalı.
ALTER TABLE public.ai_scan_usage ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 2. consume_ai_scan — günlük kotayı tüketir; kota dolunca kredi düşer.
--    Dönüş: allowed (izin), used (bugünkü sayaç), source (free|credit|
--    unlimited|insufficient_credit), balance (kalan kredi).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consume_ai_scan(
  p_user_id      uuid,
  p_daily_limit  int,   -- -1 = sınırsız (enterprise/owner)
  p_overage_cost int    -- günlük kota aşımında düşülecek kredi
)
RETURNS TABLE(allowed boolean, used int, source text, balance int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today       date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  cur         int;
  new_balance int;
  cur_balance int;
BEGIN
  -- Sınırsız plan: say + izin ver, kredi düşme yok.
  IF p_daily_limit < 0 THEN
    INSERT INTO public.ai_scan_usage (user_id, scan_date, count)
    VALUES (p_user_id, today, 1)
    ON CONFLICT (user_id, scan_date) DO UPDATE
      SET count = public.ai_scan_usage.count + 1, updated_at = now()
    RETURNING count INTO cur;
    RETURN QUERY SELECT true, cur, 'unlimited'::text, NULL::int;
    RETURN;
  END IF;

  -- Bugünkü sayaç (yoksa 0).
  SELECT count INTO cur FROM public.ai_scan_usage
    WHERE user_id = p_user_id AND scan_date = today;
  IF cur IS NULL THEN cur := 0; END IF;

  -- Ücretsiz kota içinde → say + izin ver.
  IF cur < p_daily_limit THEN
    INSERT INTO public.ai_scan_usage (user_id, scan_date, count)
    VALUES (p_user_id, today, 1)
    ON CONFLICT (user_id, scan_date) DO UPDATE
      SET count = public.ai_scan_usage.count + 1, updated_at = now()
    RETURNING count INTO cur;
    RETURN QUERY SELECT true, cur, 'free'::text, NULL::int;
    RETURN;
  END IF;

  -- Kota doldu → overage: krediyi atomik düş (yarış-güvenli).
  UPDATE public.credit_balances
    SET balance     = balance - p_overage_cost,
        total_spent = total_spent + p_overage_cost,
        updated_at  = now()
    WHERE user_id = p_user_id
      AND balance  >= p_overage_cost
    RETURNING balance INTO new_balance;

  IF NOT FOUND THEN
    -- Yetersiz kredi → izin yok, sayaç ARTMAZ.
    SELECT balance INTO cur_balance FROM public.credit_balances WHERE user_id = p_user_id;
    RETURN QUERY SELECT false, cur, 'insufficient_credit'::text, COALESCE(cur_balance, 0);
    RETURN;
  END IF;

  -- Ledger + sayaç.
  INSERT INTO public.credit_transactions (user_id, delta, reason, balance_after)
  VALUES (p_user_id, -p_overage_cost, 'ai_scan_overage', new_balance);

  INSERT INTO public.ai_scan_usage (user_id, scan_date, count)
  VALUES (p_user_id, today, 1)
  ON CONFLICT (user_id, scan_date) DO UPDATE
    SET count = public.ai_scan_usage.count + 1, updated_at = now()
  RETURNING count INTO cur;

  RETURN QUERY SELECT true, cur, 'credit'::text, new_balance;
END;
$$;

COMMENT ON FUNCTION public.consume_ai_scan IS
  'Sunucu-otoriter günlük AI scan kotası. Kota içinde ücretsiz; dolunca overage kredi düşer (atomik). allowed=false → kota dolu + yetersiz kredi.';
