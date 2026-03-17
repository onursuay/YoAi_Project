/**
 * Normalization and matching utilities for audience search.
 * Turkish-safe: ç→c, ğ→g, ı→i, İ→i, ö→o, ş→s, ü→u
 */

const TR_MAP: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i', I: 'i',
  ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
}

/** Lowercase + flatten diacritics for search matching */
export function normalizeText(input: string): string {
  if (!input || typeof input !== 'string') return ''
  let s = input
  for (const [from, to] of Object.entries(TR_MAP)) {
    s = s.split(from).join(to)
  }
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** Build searchable aliases from item (nameEn, nameTr, known synonyms) */
export function buildAliases(item: {
  nameEn: string
  nameTr: string
  path?: string[]
  knownSynonyms?: string[]
}): string[] {
  const seen = new Set<string>()
  const add = (x: string) => {
    const n = normalizeText(x)
    if (n && n.length >= 2) seen.add(n)
  }
  add(item.nameEn)
  add(item.nameTr)
  ;(item.path ?? []).forEach(add)
  ;(item.knownSynonyms ?? []).forEach(add)
  return [...seen]
}

/** Score for ranking: 1=exact alias, 2=startsWith, 3=word boundary, 4=contains */
export function scoreMatch(
  normalizedQuery: string,
  item: { normalizedAliases: string[]; nameTr: string }
): number {
  if (!normalizedQuery) return 0
  const q = normalizedQuery
  const nameNorm = normalizeText(item.nameTr)
  let best = 0

  for (const alias of item.normalizedAliases) {
    if (alias === q) return 100
    if (alias.startsWith(q) || q.startsWith(alias)) best = Math.max(best, 50)
    if (alias.includes(q) || q.includes(alias)) best = Math.max(best, 25)
  }
  if (nameNorm === q) return 80
  if (nameNorm.startsWith(q) || q.startsWith(nameNorm)) best = Math.max(best, 40)
  if (nameNorm.includes(q) || q.includes(nameNorm)) best = Math.max(best, 10)

  return best
}
