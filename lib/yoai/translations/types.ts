/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Enum Çeviri Katmanı: ortak tipler (Faz 3)

   Meta/Google API'leri İngilizce enum döndürür
   (OUTCOME_ENGAGEMENT, CONVERSATIONS, Advantage+ Placements…).
   Bu katman her enum'u TR + EN karşılığına çevirir; kullanıcıya
   ASLA ham enum gösterilmez.
   ────────────────────────────────────────────────────────── */

export type Locale = 'tr' | 'en'
export type Platform = 'meta' | 'google'

/** Tek bir enum değerinin iki dildeki karşılığı. */
export interface EnumTranslation {
  tr: string
  en: string
}

/**
 * Okunabilir ham harita: anahtar serbest yazılır
 * ('OUTCOME_ENGAGEMENT', 'Send WhatsApp Message', 'Advantage+ Placements'),
 * yükleme anında normalize edilir (bkz. normKey).
 */
export type RawEnumMap = Record<string, EnumTranslation>

/** Normalize anahtarlı harita (lookup için). */
export type EnumMap = Record<string, EnumTranslation>
