/* ──────────────────────────────────────────────────────────
   YoAlgoritma AI Engine — Feature Flag

   USE_AI_ENGINE=true  → /api/cron/yoalgoritma-scan aktif,
                         AI engine sonuçları üretilir.
   USE_AI_ENGINE=false → eski /api/yoai/daily-run flow'u kullanılır
                         (rule engine + adCreator). Rollback yolu.

   Default: false. Production'a açmak için Vercel env'e eklenmeli.
   ────────────────────────────────────────────────────────── */

export function isAiEngineEnabled(): boolean {
  const v = (process.env.USE_AI_ENGINE ?? '').toLowerCase().trim()
  return v === 'true' || v === '1' || v === 'yes'
}

/**
 * YoAlgoritma per-account scope (Madde 2 — Faz 3.3b). Açıkken command-center
 * yalnız aktif (Meta+Google) seçime ait analizi gösterir; uyuşmazsa o hesap için
 * /api/yoai/command-center/refresh ile yeniden üretilir (belgemod fix). Default
 * KAPALI → mevcut per-user (birleşik) davranış, sıfır regresyon.
 */
export function isPerAccountScopeEnabled(): boolean {
  const v = (process.env.YOAI_PER_ACCOUNT_SCOPE ?? '').toLowerCase().trim()
  return v === 'true' || v === '1' || v === 'yes'
}
