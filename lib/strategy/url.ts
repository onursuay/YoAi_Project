/* ──────────────────────────────────────────────────────────
   Strateji URL yardımcıları

   Amaç: kısa, temiz /strateji/<id8>[/<sekme>] yolu.
   - Migration YOK: kısa kimlik = UUID'nin ilk 8 karakteri; GET route bunu tam
     UUID'ye çözer.
   - Geri uyumlu: eski okunabilir '<slug>--<id8>' ve tam-UUID linkleri de çalışır
     (extractStrategyIdSegment her ikisini de ayıklar).
   - API route'ları değişmez: sayfa, çözülmüş tam UUID'yi kullanır.
   ────────────────────────────────────────────────────────── */

import { tabIdToSlug } from '@/lib/tabRoutes'

const TR_MAP: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', I: 'i', İ: 'i',
  ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
}

/** Türkçe karakterleri ASCII'ye indirip URL-güvenli slug üretir. */
export function slugifyTr(input: string): string {
  return (input || '')
    .replace(/[çÇğĞıIİöÖşŞüÜ]/g, (m) => TR_MAP[m] || m)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

/** Tam UUID mi? (v4 biçimi) */
export function isFullUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

/**
 * Kısa, temiz strateji yolu üretir: /strateji/<id8>[/<sekme>]
 * @param tab opsiyonel sekme id'si (wizard|plan|tasks|jobs) → locale slug'ına çevrilir
 */
export function strategyPath(
  instance: { id: string; title?: string | null; brand?: string | null },
  tab?: string,
): string {
  const short = instance.id.slice(0, 8)
  const base = `/strateji/${short}`
  return tab ? `${base}/${tabIdToSlug('strateji', tab)}` : base
}

/**
 * URL param'ından kimlik kısmını ayıklar.
 * - '<slug>--<id8>' → '<id8>'
 * - '<tam-uuid>'    → '<tam-uuid>' (eski link)
 */
export function extractStrategyIdSegment(param: string): string {
  const decoded = decodeURIComponent(param || '')
  const idx = decoded.lastIndexOf('--')
  return idx >= 0 ? decoded.slice(idx + 2) : decoded
}
