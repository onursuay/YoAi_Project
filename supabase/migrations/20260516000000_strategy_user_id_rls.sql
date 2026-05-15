-- ============================================================
-- YoAi Strateji — user_id kolonu + RLS politikaları + kredi RPC
-- Faz 1: Güvenlik katmanı
--
-- 1. strategy_instances tablosuna user_id TEXT kolonu ekler.
-- 2. Tüm 6 strateji tablosuna kullanıcı izolasyonu için RLS policy yazar.
--    (Servis role key RLS'i bypass eder — bu tasarım gereği doğrudur.
--     Backend API'leri zaten ad_account_id + user_id ile filtreler.
--     RLS savunma katmanıdır, birincil guard değil.)
-- 3. Atomik kredi düşme RPC fonksiyonu ekler (deduct_strategy_credit).
-- 4. strategy_tasks kategori kısıtına 'optimization' ekler
--    (job-runner 'optimization' kategorisini kullanır ama constraint'e dahil değildi).
--
-- Idempotent: DROP POLICY IF EXISTS + ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. strategy_instances: user_id kolonu
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.strategy_instances
  ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_si_user_id
  ON public.strategy_instances (user_id);

-- ─────────────────────────────────────────────────────────────
-- 2. strategy_instances RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.strategy_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "strategy_instances_select_own" ON public.strategy_instances;
CREATE POLICY "strategy_instances_select_own"
  ON public.strategy_instances FOR SELECT
  USING (
    user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  );

DROP POLICY IF EXISTS "strategy_instances_insert_own" ON public.strategy_instances;
CREATE POLICY "strategy_instances_insert_own"
  ON public.strategy_instances FOR INSERT
  WITH CHECK (
    user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  );

DROP POLICY IF EXISTS "strategy_instances_update_own" ON public.strategy_instances;
CREATE POLICY "strategy_instances_update_own"
  ON public.strategy_instances FOR UPDATE
  USING (
    user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  )
  WITH CHECK (
    user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  );

DROP POLICY IF EXISTS "strategy_instances_delete_own" ON public.strategy_instances;
CREATE POLICY "strategy_instances_delete_own"
  ON public.strategy_instances FOR DELETE
  USING (
    user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  );

-- ─────────────────────────────────────────────────────────────
-- 3a. strategy_inputs RLS (FK üzerinden strategy_instances'a JOIN)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.strategy_inputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "strategy_inputs_select_own" ON public.strategy_inputs;
CREATE POLICY "strategy_inputs_select_own"
  ON public.strategy_inputs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = strategy_inputs.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

DROP POLICY IF EXISTS "strategy_inputs_insert_own" ON public.strategy_inputs;
CREATE POLICY "strategy_inputs_insert_own"
  ON public.strategy_inputs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = strategy_inputs.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

DROP POLICY IF EXISTS "strategy_inputs_update_own" ON public.strategy_inputs;
CREATE POLICY "strategy_inputs_update_own"
  ON public.strategy_inputs FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = strategy_inputs.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

DROP POLICY IF EXISTS "strategy_inputs_delete_own" ON public.strategy_inputs;
CREATE POLICY "strategy_inputs_delete_own"
  ON public.strategy_inputs FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = strategy_inputs.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

-- ─────────────────────────────────────────────────────────────
-- 3b. strategy_outputs RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.strategy_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "strategy_outputs_select_own" ON public.strategy_outputs;
CREATE POLICY "strategy_outputs_select_own"
  ON public.strategy_outputs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = strategy_outputs.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

DROP POLICY IF EXISTS "strategy_outputs_insert_own" ON public.strategy_outputs;
CREATE POLICY "strategy_outputs_insert_own"
  ON public.strategy_outputs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = strategy_outputs.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

DROP POLICY IF EXISTS "strategy_outputs_delete_own" ON public.strategy_outputs;
CREATE POLICY "strategy_outputs_delete_own"
  ON public.strategy_outputs FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = strategy_outputs.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

-- ─────────────────────────────────────────────────────────────
-- 3c. strategy_tasks RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.strategy_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "strategy_tasks_select_own" ON public.strategy_tasks;
CREATE POLICY "strategy_tasks_select_own"
  ON public.strategy_tasks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = strategy_tasks.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

DROP POLICY IF EXISTS "strategy_tasks_insert_own" ON public.strategy_tasks;
CREATE POLICY "strategy_tasks_insert_own"
  ON public.strategy_tasks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = strategy_tasks.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

DROP POLICY IF EXISTS "strategy_tasks_update_own" ON public.strategy_tasks;
CREATE POLICY "strategy_tasks_update_own"
  ON public.strategy_tasks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = strategy_tasks.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = strategy_tasks.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

DROP POLICY IF EXISTS "strategy_tasks_delete_own" ON public.strategy_tasks;
CREATE POLICY "strategy_tasks_delete_own"
  ON public.strategy_tasks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = strategy_tasks.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

-- ─────────────────────────────────────────────────────────────
-- 3d. sync_jobs RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sync_jobs_select_own" ON public.sync_jobs;
CREATE POLICY "sync_jobs_select_own"
  ON public.sync_jobs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = sync_jobs.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

DROP POLICY IF EXISTS "sync_jobs_insert_own" ON public.sync_jobs;
CREATE POLICY "sync_jobs_insert_own"
  ON public.sync_jobs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = sync_jobs.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

DROP POLICY IF EXISTS "sync_jobs_update_own" ON public.sync_jobs;
CREATE POLICY "sync_jobs_update_own"
  ON public.sync_jobs FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = sync_jobs.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

DROP POLICY IF EXISTS "sync_jobs_delete_own" ON public.sync_jobs;
CREATE POLICY "sync_jobs_delete_own"
  ON public.sync_jobs FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = sync_jobs.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

-- ─────────────────────────────────────────────────────────────
-- 3e. metrics_snapshots RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.metrics_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "metrics_snapshots_select_own" ON public.metrics_snapshots;
CREATE POLICY "metrics_snapshots_select_own"
  ON public.metrics_snapshots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = metrics_snapshots.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

DROP POLICY IF EXISTS "metrics_snapshots_insert_own" ON public.metrics_snapshots;
CREATE POLICY "metrics_snapshots_insert_own"
  ON public.metrics_snapshots FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = metrics_snapshots.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

DROP POLICY IF EXISTS "metrics_snapshots_delete_own" ON public.metrics_snapshots;
CREATE POLICY "metrics_snapshots_delete_own"
  ON public.metrics_snapshots FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.strategy_instances si
    WHERE si.id = metrics_snapshots.strategy_instance_id
      AND si.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))
  ));

-- ─────────────────────────────────────────────────────────────
-- 4. Atomik kredi düşme RPC fonksiyonu
--    Döndürür: yeni bakiye, ya da -1 (yetersiz kredi / satır yok)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_strategy_credit(
  p_user_id uuid,
  p_cost    int DEFAULT 10
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance int;
BEGIN
  UPDATE public.credit_balances
  SET
    balance     = balance - p_cost,
    total_spent = total_spent + p_cost,
    updated_at  = now()
  WHERE user_id = p_user_id
    AND balance  >= p_cost
  RETURNING balance INTO new_balance;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  RETURN new_balance;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. strategy_tasks kategori kısıtına 'optimization' ekle
--    (job-runner optimize job'u bu kategoriyi kullanıyor)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.strategy_tasks
  DROP CONSTRAINT IF EXISTS strategy_tasks_category_check;

ALTER TABLE public.strategy_tasks
  ADD CONSTRAINT strategy_tasks_category_check
  CHECK (category IN ('setup','creative','audience','campaign','measurement','optimization'));

COMMENT ON FUNCTION public.deduct_strategy_credit IS
  'Atomik kredi düşme: credit_balances.balance >= p_cost ise düşer ve yeni bakiyeyi döner. Yetersiz kredi/satır yoksa -1 döner.';
