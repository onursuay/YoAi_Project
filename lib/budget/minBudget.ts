/**
 * Minimum daily budget helpers.
 * Rule: min daily budget = 1 USD in TRY, safe rate (ceil).
 */

/**
 * Returns the minimum daily budget in TRY for a given USD/TRY exchange rate.
 * Uses Math.ceil(usdTryRate * 1) for a single integer minimum (e.g. 44 TRY).
 */
export function getMinDailyBudgetTRY(opts: { usdTryRate: number }): number {
  return Math.ceil(opts.usdTryRate * 1)
}

/**
 * Gösterilen/dayatılan minimum günlük bütçe (TRY).
 * Meta'nın GERÇEK per-optimization-goal değeri (serverVal, /minimum_budgets) baz alınır.
 * Yalnız $1 tabanının (floorTry) ÜZERİNDEKİ yükseltilmiş minimumlara (mesajlaşma/dönüşüm: ~76)
 * ORANSAL (%) bir güvenlik tamponu eklenir → ör. 76 → 78, 96 → 99 (FX kayması + kuruş yuvarlamasına karşı).
 * Yüzde olduğu için her büyüklükte aynı oranda yastık verir (sabit TL değil → enflasyona dayanıklı).
 * Taban seviyesindeki minimumlar (trafik/erişim ≈ $1 ≈ 44) DEĞİŞMEZ.
 * Uyarı metni ile "İleri" kilidi bu AYNI değeri kullanmalı (tutarlılık).
 */
export const MIN_BUDGET_SAFETY_PCT = 0.025 // %2.5
export function bufferedMinTry(serverVal: number | null | undefined, floorTry: number | null): number | null {
  if (serverVal == null || !Number.isFinite(serverVal)) return null
  const ceilRaw = Math.ceil(serverVal)
  const floorCeil = floorTry != null && Number.isFinite(floorTry) ? Math.ceil(floorTry) : null
  const isElevated = floorCeil != null && ceilRaw > floorCeil
  return isElevated ? Math.ceil(serverVal * (1 + MIN_BUDGET_SAFETY_PCT)) : ceilRaw
}

/**
 * Reads NEXT_PUBLIC_USD_TRY_RATE from env with robust parsing.
 * Parsing: trim, replace comma with dot, keep only numeric chars.
 * Returns null (and console.warn) when missing or invalid — callers should suppress the warning.
 */
export function getUsdTryRate(): number | null {
  const raw = (process.env.NEXT_PUBLIC_USD_TRY_RATE ?? '').trim()
  if (!raw) {
    console.warn('[minBudget] NEXT_PUBLIC_USD_TRY_RATE is not set — min-budget warning suppressed')
    return null
  }
  const normalized = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const v = Number(normalized)
  if (Number.isNaN(v) || v <= 0) {
    console.warn(`[minBudget] NEXT_PUBLIC_USD_TRY_RATE is invalid ("${raw}") — min-budget warning suppressed`)
    return null
  }
  return v
}
