/* ──────────────────────────────────────────────────────────
   Creative Hash — reklam kreatif değişim tespiti

   Per-ad improvement lifecycle'ında, bir reklamın creative'i
   değişmişse eski "pending" kartı superseded yapıp yenisini üretmek
   için kullanılır (refresh policy — Faz 2 karar 2).

   Deterministik: aynı creative içeriği her zaman aynı hash'i verir.
   Normalize (trim + lowercase) → küçük metin farkları gürültü yaratmaz,
   ama anlamlı değişiklik (yeni başlık/CTA/link) yeni hash üretir.
   ────────────────────────────────────────────────────────── */

import { createHash } from 'crypto'

export function computeCreativeHash(parts: Array<string | null | undefined>): string {
  const normalized = parts
    .map((p) => (p ?? '').replace(/\s+/g, ' ').trim().toLowerCase())
    .join('||')
  if (!normalized.replace(/\|/g, '').trim()) return '' // tamamen boşsa hash üretme
  return createHash('sha1').update(normalized, 'utf8').digest('hex').slice(0, 16)
}
