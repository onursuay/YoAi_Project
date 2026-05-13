/* ──────────────────────────────────────────────────────────
   YoAi — Social Source Scanner

   Sosyal medya kaynaklarını (Instagram, Facebook, LinkedIn,
   YouTube, TikTok) tarar.

   Strateji:
     1) APIFY_API_TOKEN + platform actor ID mevcutsa → Apify
        actor çalıştır, sonucu normalize et.
     2) Apify fail/empty ise → public metadata fallback dene.
     3) Public metadata da fail ise → scan_status='failed'.
     4) Her durumda provider_used ve error_message net yazılır.
     5) Fake data ÜRETİLMEZ.
   ────────────────────────────────────────────────────────── */

import type { SourceScanInput, SourceScanOutput, SourceType } from './businessSourceScanner'
import {
  type ApifySocialPlatform,
  getApifyToken,
  getApifyActorId,
  platformToProviderUsed,
  isApifyReady,
  buildActorInput,
} from './apifySocialConfig'
import { runApifyActor } from './apifySocialRunner'
import { normalizeSocialProfile, type NormalizedSocialProfile } from './socialProfileNormalizer'

const FETCH_TIMEOUT_MS = 8_000
const RAW_EXCERPT_CHARS = 1_500
const BODY_TEXT_CHARS = 4_000

const SOCIAL_TYPES: SourceType[] = ['instagram', 'facebook', 'linkedin', 'youtube', 'tiktok']

export function isSocialSourceType(type: SourceType): boolean {
  return SOCIAL_TYPES.includes(type)
}

/* ── HTML helpers ─────────────────────────────────────────── */

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

/* ── Login-wall detection ─────────────────────────────────── */

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
  for (const m of LOGIN_WALL_MARKERS) {
    if (lower.includes(m)) return true
  }
  return text.length < 200 && /login|sign in|oturum/i.test(lower)
}

/* ── Provider info (kept for backward compatibility) ──────── */

export interface SocialScanProviderInfo {
  provider: 'public_metadata' | 'apify' | 'none'
  apifyTokenPresent: boolean
}

export function getSocialScanProviderInfo(): SocialScanProviderInfo {
  const apifyTokenPresent = !!getApifyToken()
  return {
    provider: 'public_metadata',
    apifyTokenPresent,
  }
}

/* ── Shared helpers ───────────────────────────────────────── */

function failedOutput(input: SourceScanInput, now: string, error: string, providerUsed: string): SourceScanOutput {
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
  void type
  return 'Mozilla/5.0 (compatible; YoAi-SocialScanner/1.0; +https://yoai)'
}

/* ── Build output from Apify-normalized profile ────────────── */

function buildOutputFromApify(
  profile: NormalizedSocialProfile,
  input: SourceScanInput,
  now: string,
  provider: string,
): SourceScanOutput {
  const corpus = [profile.bio, ...profile.recentPostTexts].filter(Boolean).join(' ')
  const rawExcerpt = corpus.slice(0, RAW_EXCERPT_CHARS) || null

  const socialProof = profile.followersCount !== null
    ? `${profile.followersCount.toLocaleString('tr-TR')} takipçi`
    : null

  return {
    source_type: input.source_type,
    source_url: profile.sourceUrl || input.source_url || null,
    scan_status: 'completed',
    raw_excerpt: rawExcerpt,
    extracted_title: profile.profileName,
    extracted_description: profile.bio ?? profile.description,
    extracted_services: profile.extractedServices,
    extracted_products: [],
    extracted_keywords: [...profile.extractedKeywords, ...profile.hashtags.slice(0, 5)].slice(0, 15),
    extracted_audience: profile.extractedAudience,
    extracted_locations: profile.extractedLocations,
    extracted_ctas: profile.extractedCtas,
    extracted_brand_tone: profile.extractedBrandTone,
    extracted_offers: profile.extractedOffers,
    extracted_social_proof: socialProof,
    confidence: profile.confidence,
    error_message: `|provider:${provider}`,
    scanned_at: now,
  }
}

/* ── Public metadata path (HTTP fallback) ─────────────────── */

async function scanPublicMetadata(
  input: SourceScanInput,
  now: string,
  providerUsed: string,
): Promise<SourceScanOutput> {
  const url = (input.source_url || '').trim()

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
      return failedOutput(input, now, `http_${res.status}`, providerUsed)
    }

    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      return failedOutput(input, now, `unsupported_content_type:${ct.split(';')[0]}`, providerUsed)
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

    if (!title && !description && body.length < 200) {
      return failedOutput(input, now, 'no_extractable_metadata', providerUsed)
    }

    const status: SourceScanOutput['scan_status'] = blocked ? 'failed' : 'completed'
    const errorMessage = blocked
      ? `login_wall|provider:${providerUsed}`
      : providerUsed === 'public_metadata'
        ? null  // no-change for plain public_metadata success
        : `|provider:${providerUsed}` // fallback_public_metadata: track provider even on success

    const conf = blocked
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
      confidence: conf,
      error_message: errorMessage,
      scanned_at: now,
    }
  } catch (e) {
    clearTimeout(timeout)
    const msg = e instanceof Error ? e.message : 'unknown_error'
    return failedOutput(
      input,
      now,
      msg.includes('aborted') ? 'timeout' : msg.slice(0, 160),
      providerUsed,
    )
  }
}

/* ── Main scanner ─────────────────────────────────────────── */

/**
 * scanSocialSource
 *
 * Provider selection:
 *   1. APIFY_API_TOKEN + platform actor ID present → try Apify
 *   2. Apify success → return normalized output, provider=apify_<platform>
 *   3. Apify fail/empty → fallback to public metadata (provider=fallback_public_metadata)
 *   4. No Apify config → public metadata directly (provider=public_metadata)
 *   5. Public metadata fail → failed scan (fake data never produced)
 */
export async function scanSocialSource(input: SourceScanInput): Promise<SourceScanOutput> {
  const now = new Date().toISOString()
  const url = (input.source_url || '').trim()

  if (!url) {
    return failedOutput(input, now, 'no_url', 'none')
  }
  if (!isSocialSourceType(input.source_type)) {
    return failedOutput(input, now, 'unsupported_source_type', 'none')
  }

  const platform = input.source_type as ApifySocialPlatform

  // ── Apify path ──────────────────────────────────────────
  if (isApifyReady(platform)) {
    const token = getApifyToken()!
    const actorId = getApifyActorId(platform)!
    const actorInput = buildActorInput(platform, url)
    const apifyResult = await runApifyActor(token, actorId, actorInput)

    if (apifyResult.ok && apifyResult.items.length > 0) {
      const profile = normalizeSocialProfile(platform, apifyResult.items[0], url)
      if (profile.confidence > 0 || profile.profileName || profile.bio) {
        return buildOutputFromApify(profile, input, now, platformToProviderUsed(platform))
      }
      // Apify returned data but normalizer extracted nothing useful
    }

    // Apify failed or empty → try public metadata fallback
    return scanPublicMetadata(input, now, 'fallback_public_metadata')
  }

  // ── Public metadata path (no Apify) ─────────────────────
  const providerUsed: string = getApifyToken()
    ? 'apify_actor_missing_public_metadata'
    : 'public_metadata'

  return scanPublicMetadata(input, now, providerUsed)
}
