-- ============================================================
-- YoAi Strateji — NULL user_id Backfill
-- ============================================================
--
-- AMAÇ:
--   20260516000000 migrasyonuyla user_id kolonu eklendi.
--   Bu migration öncesi oluşturulmuş strategy_instances kayıtları
--   user_id = NULL taşıyor. Yeni GET filtresi (.eq('user_id', ctx.userId))
--   bu kayıtları dışarıda bırakır — kullanıcı eski stratejilerini göremez.
--
-- ÇÖZÜM KURALLARI:
--   1. Yalnızca meta_connections.selected_ad_account_id üzerinden
--      güvenli (1:1 unambiguous) eşleşme bulunduğunda user_id doldur.
--   2. Aynı ad_account_id'ye birden fazla farklı user_id karşılık
--      geliyorsa (ambiguous) o satırlar dokunulmaz.
--   3. Eşleşme bulunamayan (orphan) kayıtlar silinmez, NULL kalır.
--   4. Tüm adımlar idempotent: tekrar çalıştırılabilir.
--   5. RAISE NOTICE: kaç güncellendi, kaç ambiguous, kaç orphan.
--
-- NORMALIZASYON:
--   strategy_instances.ad_account_id → resolveMetaContext tarafından
--   her zaman "act_XXXXX" formatına normalize edilir.
--   meta_connections.selected_ad_account_id bazı eski kayıtlarda
--   "XXXXX" (act_ öneksiz) olabilir. REPLACE ile her iki taraf
--   normalize edilerek karşılaştırma yapılır.
--
-- GÜVENLİK:
--   - RLS gevşetilmez, user_id izolasyonu korunur.
--   - Mevcut kayıtlar silinmez, yalnızca NULL user_id güncellenir.
--   - user_id dolu (NULL olmayan) kayıtlara dokunulmaz.
-- ============================================================

DO $$
DECLARE
  v_null_before        int;
  v_ambiguous_accounts int;
  v_updated            int;
  v_null_after         int;
BEGIN

  -- 0) Başlangıç sayımı
  SELECT COUNT(*) INTO v_null_before
  FROM public.strategy_instances
  WHERE user_id IS NULL;

  RAISE NOTICE '--- Backfill başlıyor: % kayıt user_id = NULL ---', v_null_before;

  IF v_null_before = 0 THEN
    RAISE NOTICE 'Backfill gerekmiyor: zaten tüm kayıtlarda user_id dolu.';
    RETURN;
  END IF;

  -- 1) Ambiguous (birden fazla user, aynı ad_account) sayısı
  SELECT COUNT(*)
  INTO v_ambiguous_accounts
  FROM (
    SELECT selected_ad_account_id
    FROM public.meta_connections
    WHERE selected_ad_account_id IS NOT NULL
      AND user_id               IS NOT NULL
    GROUP BY selected_ad_account_id
    HAVING COUNT(DISTINCT user_id) > 1
  ) ambiguous_sub;

  IF v_ambiguous_accounts > 0 THEN
    RAISE NOTICE '% ad_account_id için birden fazla user_id var — bu hesaplara ait kayıtlar atlanacak (ambiguous).',
      v_ambiguous_accounts;
  END IF;

  -- 2) Güvenli (unambiguous) eşleşmelerden backfill
  --    CTE: sadece 1:1 eşleşen (tek user_id) meta_connections kayıtları
  WITH unambiguous AS (
    SELECT
      selected_ad_account_id,
      MIN(user_id) AS user_id          -- HAVING = 1 olduğu için MIN = tek değer
    FROM public.meta_connections
    WHERE selected_ad_account_id IS NOT NULL
      AND user_id               IS NOT NULL
    GROUP BY selected_ad_account_id
    HAVING COUNT(DISTINCT user_id) = 1
  )
  UPDATE public.strategy_instances si
  SET    user_id    = u.user_id,
         updated_at = now()
  FROM   unambiguous u
  WHERE  si.user_id IS NULL
    AND  -- ad_account_id normalizasyonu: her iki taraf 'act_' öneksiz karşılaştırılır
         REPLACE(si.ad_account_id, 'act_', '') =
         REPLACE(u.selected_ad_account_id, 'act_', '');

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- 3) Kalan NULL sayısı (orphan)
  SELECT COUNT(*) INTO v_null_after
  FROM public.strategy_instances
  WHERE user_id IS NULL;

  -- 4) Sonuç raporu
  RAISE NOTICE '--- Backfill tamamlandı ---';
  RAISE NOTICE '  Başlangıçtaki NULL kayıt : %', v_null_before;
  RAISE NOTICE '  Güncellenen (backfill)   : %', v_updated;
  RAISE NOTICE '  Kalan orphan (NULL)       : %', v_null_after;

  IF v_null_after > 0 THEN
    RAISE NOTICE '  Orphan kayıtlar silinmedi. user_id = NULL olan strategy_instances';
    RAISE NOTICE '  GET /api/strategy/instances listesinde görünmez (user_id filtresi).';
    RAISE NOTICE '  Orphan kaydı görmek için: SELECT id, ad_account_id, title, created_at';
    RAISE NOTICE '    FROM strategy_instances WHERE user_id IS NULL ORDER BY created_at;';
  END IF;

END
$$;

-- ── Idempotent index: zaten varsa skip edilir (20260516000000'de de var) ──
CREATE INDEX IF NOT EXISTS idx_si_user_id
  ON public.strategy_instances (user_id);
