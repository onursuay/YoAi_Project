/* ──────────────────────────────────────────────────────────
   YoAi — Social Source Scanner

   Sosyal medya kaynaklarını (Instagram, Facebook, LinkedIn,
   YouTube, TikTok) en azından PUBLIC METADATA düzeyinde
   tarar. Bot engeli / login wall karşılaşırsa partial veya
   failed olarak işaretler. Fake data ÜRETMEZ.

   Strateji:
     1) Önce HTTP fetch dene (og:title, og:description, title,
        meta description, canonical, görünür gövde özeti).
     2) Eğer içerik login wall ise (Login required, sign up to
        continue vb.) scan_status='partial' veya 'failed' yaz.
     3) Sağlayıcı (Apify) entegrasyonu burada yer almaz —
        bu modül public metadata fallback'idir.
   ────────────────────────────────────────────────────────── */

import type { SourceScanInput, SourceScanOutput, SourceType } from './businessSourceScanner'

const FETCH_TIMEOUT_MS = 8_000
const RAW_EXCERPT_CHARS = 1_500
const BODY_TEXT_CHARS = 4_000

const SOCIAL_TYPES: SourceType[] = ['instagram', 'facebook', 'linkedin', 'youtube', 'tiktok']

export function isSocialSourceType(type: SourceType): boolean {
  return SOCIAL_TYPES.includes(type)
}

/* ── HTML helpers (intentionally duplicated to keep this module
   independent of businessSourceScanner internals; both modules
   are small) ──────────────────────────────────────────────── */

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitle(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
  if (og) return og[1].trim().slice(0, 240)
  const ogAlt = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
  if (ogAlt) return ogAlt[1].trim().slice(0, 240)
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!t) return null
  return stripHtml(t[1]).slice(0, 240) || null
}

function extractDescription(html: string): string | null {
  const patterns = [
    /<meta[^>]+(?:name|property)=["'](?:og:description|description|twitter:description)["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["'](?:og:description|description|twitter:description)["']/i,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return m[1].trim().slice(0, 480)
  }
  return null
}

function extractCanonical(html: string): string | null {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
  return m ? m[1].trim().slice(0, 320) : null
}

function extractSiteName(html: string): string | null {
  const m = html.match(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)
  return m ? m[1].trim().slice(0, 120) : null
}

function extractBodyText(html: string): string {
  return stripHtml(html).slice(0, BODY_TEXT_CHARS)
}

/* ── Signal extraction (lightweight) ──────────────────────── */

const CTA_HINTS = [
  'iletişim', 'iletişime geç', 'bize ulaşın', 'whatsapp', 'randevu', 'rezervasyon',
  'kayıt', 'satın al', 'sipariş', 'teklif', 'demo', 'dm', 'mesaj', 'destek',
  'shop now', 'sign up', 'message', 'contact',
]
const OFFER_HINTS = [
  'kampanya', 'indirim', 'fırsat', 'ücretsiz', 'erken', 'sınırlı', 'taksit',
  'free', 'discount', 'sale',
]

function findHints(text: string, hints: string[], max = 5): string[] {
  const lower = text.toLowerCase()
  const out = new Set<string>()
  for (const h of hints) {
    const idx = lower.indexOf(h)
    if (idx >= 0) {
      const window = text.substring(Math.max(0, idx - 20), Math.min(text.length, idx + 80)).trim()
      if (window) out.add(window.slice(0, 120))
      if (out.size >= max) break
    }
  }
  return Array.from(out)
}

function extractKeywords(text: string, max = 15): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\sığüşöçİĞÜŞÖÇ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 5)
  const freq = new Map<string, number>()
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1)
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k)
}

/* ── Login-wall / blocked-page detection ──────────────────── */

const LOGIN_WALL_MARKERS = [
  'log in to see',
  'login to continue',
  'please log in',
  'sign up to continue',
  'oturum aç',
  'giriş yapın',
  'giriş yap',
  'this content is unavailable',
  'something went wrong',
]

function looksLikeLoginWall(text: string): boolean {
  const lower = text.toLowerCase()
  let hits = 0
  for (const m of LOGIN_WALL_MARKERS) {
    if (lower.includes(m)) hits++
    if (hits >= 1) return true
  }
  // Heuristic: very short body with mostly UI strings
  return text.length < 200 && /login|sign in|oturum/i.test(lower)
}

/* ── Provider info ─────────────────────────────────────────── */

export interface SocialScanProviderInfo {
  provider: 'public_metadata' | 'apify' | 'none'
  apifyTokenPresent: boolean
}

export function getSocialScanProviderInfo(): SocialScanProviderInfo {
  const apifyTokenPresent = !!(process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN)
  return {
    provider: 'public_metadata',
    apifyTokenPresent,
  }
}

/* ── Public scanner ───────────────────────────────────────── */

function failed(input: SourceScanInput, now: string, error: string, providerUsed: string): SourceScanOutput & { provider_used?: string } {
  return {
    source_type: input.source_type,
    source_url: input.source_url || null,
    scan_status: 'failed',
    raw_excerpt: null,
    extracted_title: null,
    extracted_description: null,
    extracted_services: [],
    extracted_products: [],
    extracted_keywords: [],
    extracted_audience: null,
    extracted_locations: [],
    extracted_ctas: [],
    extracted_brand_tone: null,
    extracted_offers: [],
    extracted_social_proof: null,
    confidence: 0,
    error_message: `${error}|provider:${providerUsed}`,
    scanned_at: now,
  }
}

function userAgentForType(type: SourceType): string {
  // YouTube and LinkedIn tend to be more permissive for typical browsers;
  // generic UA works for all and avoids platform-specific games.
  void type
  return 'Mozilla/5.0 (compatible; YoAi-SocialScanner/1.0; +https://yoai)'
}

/**
 * scanSocialSource — public metadata fallback.
 *
 * Provider seçimi:
 *   - APIFY_API_TOKEN varsa "provider_used = apify_not_wired" olarak işaretlenir
 *     (gerçek Apify actor entegrasyonu sosyal kaynaklar için kuruluncaya kadar
 *     bu modül public HTTP'i deniyor — sahte veri üretmez).
 *   - Token yoksa "provider_used = public_metadata".
 *
 * Public HTTP başarısızsa → failed.
 * Public HTTP başarılı ama login wall → partial (description tutulur).
 */
export async function scanSocialSource(input: SourceScanInput): Promise<SourceScanOutput> {
  const now = new Date().toISOString()
  const url = (input.source_url || '').trim()
  if (!url) {
    return failed(input, now, 'no_url', 'none')
  }
  if (!isSocialSourceType(input.source_type)) {
    return failed(input, now, 'unsupported_source_type', 'none')
  }

  const providerInfo = getSocialScanProviderInfo()
  const providerUsed: string = providerInfo.apifyTokenPresent
    ? 'apify_present_public_metadata_fallback'
    : 'public_metadata'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': userAgentForType(input.source_type),
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return failed(input, now, `http_${res.status}`, providerUsed)
    }

    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      return failed(input, now, `unsupported_content_type:${ct.split(';')[0]}`, providerUsed)
    }

    const html = await res.text()
    const title = extractTitle(html)
    const description = extractDescription(html)
    const canonical = extractCanonical(html)
    const siteName = extractSiteName(html)
    const body = extractBodyText(html)

    const corpus = [title, description, siteName, body].filter(Boolean).join(' ').slice(0, BODY_TEXT_CHARS)
    const blocked = looksLikeLoginWall(corpus)

    const keywords = extractKeywords(corpus)
    const ctas = findHints(corpus, CTA_HINTS, 5)
    const offers = findHints(corpus, OFFER_HINTS, 5)

    // Minimal signal threshold — if neither title nor description came out,
    // treat as failed (we never invent data).
    if (!title && !description && body.length < 200) {
      return failed(input, now, 'no_extractable_metadata', providerUsed)
    }

    // Login wall yet some metadata exists → partial
    const status: SourceScanOutput['scan_status'] = blocked ? 'failed' : 'completed'
    const errorMessage = blocked ? `login_wall|provider:${providerUsed}` : null

    const confidence = blocked
      ? 0
      : Math.min(
          80,
          15 +
            (title ? 25 : 0) +
            (description ? 20 : 0) +
            (siteName ? 5 : 0) +
            (keywords.length > 4 ? 10 : 0),
        )

    return {
      source_type: input.source_type,
      source_url: url,
      scan_status: status,
      raw_excerpt: blocked ? null : body.slice(0, RAW_EXCERPT_CHARS),
      extracted_title: title,
      extracted_description: description,
      extracted_services: [],
      extracted_products: [],
      extracted_keywords: blocked ? [] : keywords,
      extracted_audience: null,
      extracted_locations: [],
      extracted_ctas: blocked ? [] : ctas,
      extracted_brand_tone: null,
      extracted_offers: blocked ? [] : offers,
      extracted_social_proof: canonical && /verified|doğrulanmış/i.test(corpus) ? canonical : null,
      confidence,
      error_message: errorMessage,
      scanned_at: now,
    }
  } catch (e) {
    clearTimeout(timeout)
    const msg = e instanceof Error ? e.message : 'unknown_error'
    return failed(input, now, msg.includes('aborted') ? 'timeout' : msg.slice(0, 160), providerUsed)
  }
}
