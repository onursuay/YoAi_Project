/* ──────────────────────────────────────────────────────────
   Strateji okunabilir URL yardımcıları

   Amaç: /strateji/<UUID> yerine okunabilir /strateji/<slug>--<id8>.
   - Migration YOK: slug başlıktan anlık türetilir, sonuna UUID'nin ilk 8
     karakteri (kısa kimlik) eklenir.
   - Geri uyumlu: eski tam-UUID linkleri de çalışır (ayraç yoksa param
     doğrudan kimlik kabul edilir).
   - API route'ları değişmez: sayfa, çözülmüş tam UUID'yi kullanır.
   ────────────────────────────────────────────────────────── */

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
 * Okunabilir strateji yolu üretir: /strateji/<slug>--<id8>[suffix]
 * @param suffix opsiyonel query/sekme eki, örn. '?tab=jobs'
 */
export function strategyPath(
  instance: { id: string; title?: string | null; brand?: string | null },
  suffix = '',
): string {
  const slug = slugifyTr(instance.title || instance.brand || '') || 'strateji'
  const short = instance.id.slice(0, 8)
  return `/strateji/${slug}--${short}${suffix}`
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
