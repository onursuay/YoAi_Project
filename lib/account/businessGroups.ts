/* ──────────────────────────────────────────────────────────
   İşletme Gruplama (YoAlgoritma per-account — Faz 3.4)

   Kullanıcının kayıtlı Meta + Google reklam hesaplarını "işletme"
   birimlerine gruplar. Bir işletme = isim olarak eşleşen bir Meta
   hesabı + bir Google hesabı (biri eksik olabilir). Eşleşme tamamen
   OTOMATİK İSİM EŞLEŞTİRME ile yapılır (kullanıcı tercihi):
     "Belge Mod" (Meta) ↔ "belgemod.com" (Google) → tek işletme.

   Bu modül SAF'tır (next/headers yok) → hem client (seçici UI) hem
   server (scope çözümleme) tarafından import edilebilir.
   ────────────────────────────────────────────────────────── */

/** Server-side scope cookie adı — POST /api/yoai/business-scope yazar. */
export const BUSINESS_SCOPE_COOKIE = 'yoai_business_scope'

export interface MetaAccountRef {
  accountId: string
  accountName: string | null
}

export interface GoogleAccountRef {
  customerId: string
  loginCustomerId: string | null
  accountName: string | null
}

export interface BusinessGroup {
  /** Kararlı seçim kimliği: eşleşen çift `b:<key>`, tek `m:<id>` / `g:<id>`. */
  id: string
  /** Gösterilecek ad (Meta markası tercih edilir). */
  name: string
  /** Normalize edilmiş eşleşme anahtarı (debug/sıralama). */
  normalizedKey: string
  meta: MetaAccountRef | null
  google: GoogleAccountRef | null
}

/** Yasal/şirket eki token'ları — eşleştirmede gürültü, atılır. */
const LEGAL_TOKENS = new Set([
  'ltd', 'sti', 'ltdsti', 'limited', 'sirket', 'sirketi',
  'anonim', 'as', 'inc', 'incorporated', 'llc', 'gmbh', 'corp',
])

/**
 * İşletme adını eşleştirme için normalize eder:
 * Türkçe harf katlama → küçük harf → diakritik temizliği → www/TLD atma →
 * noktalama→boşluk → yasal ek token'larını atma → bitişik birleştir.
 *   "Belge Mod"      → "belgemod"
 *   "belgemod.com"   → "belgemod"
 *   "Atlas A.Ş."     → "atlas"
 */
export function normalizeBusinessName(raw: string | null | undefined): string {
  if (!raw) return ''
  let s = raw.toString().trim()

  // Türkçe'ye özgü katlama (İ/ı tuzağından kaçınmak için generic lowercase'ten önce)
  s = s
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ş/g, 's').replace(/ş/g, 's')
    .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u')
    .replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c')

  s = s.toLowerCase()
  // Generic diakritik temizliği (é, ñ, …)
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // www. ön eki ve TLD son eki
  s = s.replace(/^www\./, '')
  s = s.replace(/\.(com|net|org|co|io|biz|info|gov|edu|com\.tr|web\.tr)(\.[a-z]{2})?$/i, '')
  // Noktalama → boşluk (token sınırlarını korumak için)
  s = s.replace(/[^a-z0-9]+/g, ' ').trim()

  const tokens = s.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return ''
  const kept = tokens.filter(t => !LEGAL_TOKENS.has(t))
  return (kept.length > 0 ? kept : tokens).join('')
}

/** İki normalize anahtar arasındaki eşleşme skoru (0 = eşleşmez). */
function matchScore(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 100
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  // İçeride geçme (örn. "belgemod" ⊂ "belgemodreklam") — kısa taraf en az 4 karakter
  if (shorter.length >= 4 && longer.includes(shorter)) return 80
  return 0
}

const MATCH_THRESHOLD = 80

function bestName(meta: MetaAccountRef | null, google: GoogleAccountRef | null): string {
  const metaName = meta?.accountName?.trim()
  if (metaName && metaName !== meta?.accountId) return metaName
  const gName = google?.accountName?.trim()
  if (gName && gName !== google?.customerId) return gName
  return metaName || gName || meta?.accountId || google?.customerId || '—'
}

/**
 * Kayıtlı Meta + Google hesaplarını işletmelere gruplar.
 * Eşleşen çiftler önce, sonra tek-platform işletmeler; her biri ada göre sıralı.
 */
export function groupIntoBusinesses(
  metaAccts: MetaAccountRef[],
  googleAccts: GoogleAccountRef[],
): BusinessGroup[] {
  const metas = metaAccts.map(m => ({ ref: m, key: normalizeBusinessName(m.accountName || m.accountId) }))
  const googles = googleAccts.map(g => ({ ref: g, key: normalizeBusinessName(g.accountName || g.customerId) }))

  const usedMeta = new Set<string>()
  const businesses: BusinessGroup[] = []

  // 1) Her Google için en iyi (kullanılmamış) Meta eşini bul
  for (const g of googles) {
    let best: { meta: typeof metas[number]; score: number } | null = null
    for (const m of metas) {
      if (usedMeta.has(m.ref.accountId)) continue
      const score = matchScore(m.key, g.key)
      if (score >= MATCH_THRESHOLD && (!best || score > best.score)) best = { meta: m, score }
    }
    if (best) {
      usedMeta.add(best.meta.ref.accountId)
      businesses.push({
        id: `b:${best.meta.key || g.key}`,
        name: bestName(best.meta.ref, g.ref),
        normalizedKey: best.meta.key || g.key,
        meta: best.meta.ref,
        google: g.ref,
      })
    } else {
      businesses.push({
        id: `g:${g.ref.customerId}`,
        name: bestName(null, g.ref),
        normalizedKey: g.key,
        meta: null,
        google: g.ref,
      })
    }
  }

  // 2) Eşleşmeyen Meta hesapları (tek-platform işletme)
  for (const m of metas) {
    if (usedMeta.has(m.ref.accountId)) continue
    businesses.push({
      id: `m:${m.ref.accountId}`,
      name: bestName(m.ref, null),
      normalizedKey: m.key,
      meta: m.ref,
      google: null,
    })
  }

  // Çift-platformlu işletmeler üstte, sonra ada göre
  businesses.sort((a, b) => {
    const aBoth = a.meta && a.google ? 0 : 1
    const bBoth = b.meta && b.google ? 0 : 1
    if (aBoth !== bBoth) return aBoth - bBoth
    return a.name.localeCompare(b.name, 'tr')
  })

  return businesses
}

/* ── Scope cookie serileştirme ──
   Biçim: "<businessId>|<metaId|->|<googleCustomerId|->|<loginCustomerId|->"
   Alanlar `|` veya `:` içermez (id'ler alfanümerik / act_ / digits). */

export interface ParsedBusinessScope {
  businessId: string | null
  metaAccountId: string | null
  googleCustomerId: string | null
  googleLoginCustomerId: string | null
}

const DASH = '-'
const enc = (v: string | null | undefined) => (v && v.trim() ? v.trim() : DASH)
const dec = (v: string | undefined) => (v && v !== DASH ? v : null)

export function serializeBusinessScope(s: ParsedBusinessScope): string {
  return [enc(s.businessId), enc(s.metaAccountId), enc(s.googleCustomerId), enc(s.googleLoginCustomerId)].join('|')
}

export function parseBusinessScope(raw: string | null | undefined): ParsedBusinessScope | null {
  if (!raw) return null
  const parts = raw.split('|')
  if (parts.length < 3) return null
  const metaAccountId = dec(parts[1])
  const googleCustomerId = dec(parts[2])
  // En az bir platform olmalı; ikisi de boşsa scope anlamsız
  if (!metaAccountId && !googleCustomerId) return null
  return {
    businessId: dec(parts[0]),
    metaAccountId,
    googleCustomerId,
    googleLoginCustomerId: dec(parts[3]),
  }
}
