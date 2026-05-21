/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Enum Çeviri Katmanı: genel API (Faz 3)

   Kullanıcıya gösterilen TÜM Meta/Google enum'ları buradan geçer:
     translateEnum('OUTCOME_ENGAGEMENT', 'tr')  → 'Etkileşim Hedefi'
     translateEnum('OUTCOME_ENGAGEMENT', 'en')  → 'Engagement'
     translateEnum('CONVERSATIONS', 'tr')       → 'Konuşmalar'
     translateEnum('Send WhatsApp Message','tr')→ 'WhatsApp Mesajı Gönder'

   Bilinmeyen değer → ham SNAKE_CASE asla gösterilmez; "Title Case"e
   düşürülür. Zaten insan-okur (Türkçe etiket) değer olduğu gibi döner.
   ────────────────────────────────────────────────────────── */

import type { EnumMap, Locale, Platform, RawEnumMap } from './types'
import { META_ENUMS_RAW } from './meta-enums'
import { GOOGLE_ENUMS_RAW } from './google-enums'

export * from './types'
export * from './meta-enums'
export * from './google-enums'

/** Lookup anahtarı normalizasyonu: 'Advantage+ Placements' → 'ADVANTAGE_PLACEMENTS'. */
export function normKey(v: string): string {
  return String(v)
    .trim()
    .toUpperCase()
    .replace(/\+/g, '')
    .replace(/&/g, ' ')
    .replace(/[\s\-./]+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function buildMap(raw: RawEnumMap): EnumMap {
  const out: EnumMap = {}
  for (const [k, v] of Object.entries(raw)) {
    const nk = normKey(k)
    if (nk) out[nk] = v
  }
  return out
}

export const META_ENUMS: EnumMap = buildMap(META_ENUMS_RAW)
export const GOOGLE_ENUMS: EnumMap = buildMap(GOOGLE_ENUMS_RAW)
/** Platform belirtilmezse aranan birleşik harita (Meta öncelikli). */
export const ALL_ENUMS: EnumMap = { ...GOOGLE_ENUMS, ...META_ENUMS }

/** Bilinmeyen değeri okunabilir hale getir — ham enum'u UI'da göstermemek için. */
function prettify(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  // RAW_ENUM gibi mi (yalnızca A-Z/0-9/_)? → "Title Case"
  if (/^[A-Z0-9_]+$/.test(t)) {
    return t
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }
  // Zaten insan-okur (Türkçe etiket, karışık kâse) → olduğu gibi
  return t
}

/**
 * Tek bir enum değerini locale'e çevirir.
 * @param value    Ham enum veya etiket (Meta/Google API'den veya AI çıktısından)
 * @param locale   'tr' (varsayılan) | 'en'
 * @param platform İpucu — eşleşmede önce bu platformun haritasına bakar
 */
export function translateEnum(
  value: string | null | undefined,
  locale: Locale = 'tr',
  platform?: Platform,
): string {
  if (value == null) return ''
  const raw = String(value).trim()
  if (!raw) return ''
  const key = normKey(raw)
  const order: EnumMap[] =
    platform === 'google' ? [GOOGLE_ENUMS, META_ENUMS] : [META_ENUMS, GOOGLE_ENUMS]
  for (const m of order) {
    const hit = m[key]
    if (hit) return locale === 'en' ? hit.en : hit.tr
  }
  return prettify(raw)
}

/** Bir enum listesini çevirir (placements vb.); boşları atar, tekrarsızlar. */
export function translateEnumList(
  values: Array<string | null | undefined> | null | undefined,
  locale: Locale = 'tr',
  platform?: Platform,
): string[] {
  if (!Array.isArray(values)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of values) {
    const t = translateEnum(v, locale, platform)
    if (t && !seen.has(t)) {
      seen.add(t)
      out.push(t)
    }
  }
  return out
}
