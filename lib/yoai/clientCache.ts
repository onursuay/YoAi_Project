/* ──────────────────────────────────────────────────────────
   YoAlgoritma — client-side cache keys & invalidation
   The /yoai page keeps the last command-center snapshot in the
   browser so a page refresh does not re-show the "scanning" state.
   When the active ad account changes, that snapshot belongs to the
   PREVIOUS account — clear it so a stale snapshot does not flash
   before the fresh fetch.
   ────────────────────────────────────────────────────────── */

/** localStorage — persisted command-center analysis snapshot. */
export const YOAI_CC_CACHE_KEY = 'yoai_cc_cache_v1'
/** sessionStorage — deep-analysis working cache. */
export const YOAI_CC_DEEP_CACHE_KEY = 'yoai_cc_deep_cache'

/**
 * Clear YoAlgoritma's client-side cached analysis.
 * Call on active ad-account switch (Meta/Google). SSR-safe.
 */
export function clearYoAlgoritmaClientCache(): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(YOAI_CC_CACHE_KEY) } catch {}
  try { sessionStorage.removeItem(YOAI_CC_DEEP_CACHE_KEY) } catch {}
}
