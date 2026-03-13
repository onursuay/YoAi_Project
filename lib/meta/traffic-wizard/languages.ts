/**
 * Meta Ad Targeting — Locale/Language fallback data.
 * Used when Meta Graph API /search?type=adlocale is unavailable
 * (e.g., no Meta connection, rate limit, or network error).
 *
 * Keys match Meta's ad locale targeting IDs.
 * Names are in English to match Meta's en_US locale response.
 * This is a curated subset; the full list is available via the Meta API.
 */

export interface MetaAdLocale {
  key: number
  name: string
}

export const FALLBACK_AD_LOCALES: MetaAdLocale[] = [
  { key: 37, name: 'Turkish' },
  { key: 6, name: 'English (All)' },
  { key: 9, name: 'French (France)' },
  { key: 10, name: 'German' },
  { key: 23, name: 'Spanish' },
  { key: 24, name: 'Italian' },
  { key: 28, name: 'Arabic' },
  { key: 31, name: 'Russian' },
  { key: 50, name: 'Portuguese' },
  { key: 36, name: 'Polish' },
  { key: 15, name: 'Dutch' },
  { key: 45, name: 'Chinese (Simplified)' },
  { key: 46, name: 'Japanese' },
  { key: 48, name: 'Korean' },
  { key: 32, name: 'Hindi' },
  { key: 47, name: 'Swedish' },
  { key: 43, name: 'Norwegian (Bokmål)' },
  { key: 8, name: 'Danish' },
  { key: 49, name: 'Finnish' },
  { key: 12, name: 'Greek' },
  { key: 7, name: 'Czech' },
  { key: 42, name: 'Romanian' },
  { key: 34, name: 'Hungarian' },
  { key: 53, name: 'Vietnamese' },
  { key: 54, name: 'Thai' },
  { key: 55, name: 'Indonesian' },
  { key: 56, name: 'Malay' },
  { key: 39, name: 'Filipino' },
  { key: 59, name: 'Ukrainian' },
]

/**
 * Search fallback locale list by name.
 * Used when Meta API is unavailable.
 */
export function searchFallbackLocales(query: string): MetaAdLocale[] {
  if (!query || query.length < 1) return []
  const q = query.toLowerCase()
  return FALLBACK_AD_LOCALES.filter(l => l.name.toLowerCase().includes(q))
}

/**
 * Lookup locale name by key from fallback list.
 */
export function getLocaleName(key: number): string | undefined {
  return FALLBACK_AD_LOCALES.find(l => l.key === key)?.name
}
