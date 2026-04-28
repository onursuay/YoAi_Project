import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsContext, buildGoogleAdsHeaders, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'

const MAX_BYTES = 5 * 1024 * 1024
// Bazı siteler (Cloudflare, WordPress + güvenlik eklentileri) bot user-agent'ları bloklar.
// Gerçek Chrome UA ile daha az engel alıyoruz.
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 12000

const SCRAPE_ERRORS = {
  tr: {
    invalidUrl: 'Geçersiz URL. http:// veya https:// ile başlamalı.',
    blockedUrl: 'Bu URL dahili ağ adresi olduğu için taranamaz.',
    fetchFailed: 'Site taranamadı. URL erişilebilir mi kontrol edin.',
    noImages: 'Sitede uygun görsel bulunamadı.',
    downloadFailed: 'Görsel indirilemedi.',
    tooLarge: 'Görsel 5 MB sınırını aşıyor.',
    uploadFailed: 'Google Ads\'e yükleme başarısız oldu.',
    invalidKind: 'Geçersiz asset türü.',
    generic: 'İşlem başarısız oldu.',
  },
  en: {
    invalidUrl: 'Invalid URL. Must start with http:// or https://.',
    blockedUrl: 'Internal network URLs cannot be scraped.',
    fetchFailed: 'Site could not be scraped. Check if URL is reachable.',
    noImages: 'No suitable images found on the site.',
    downloadFailed: 'Image download failed.',
    tooLarge: 'Image exceeds 5 MB limit.',
    uploadFailed: 'Upload to Google Ads failed.',
    invalidKind: 'Invalid asset kind.',
    generic: 'Operation failed.',
  },
} as const

type AssetKind =
  | 'MARKETING_IMAGE'
  | 'SQUARE_MARKETING_IMAGE'
  | 'PORTRAIT_MARKETING_IMAGE'
  | 'LOGO'
  | 'SQUARE_LOGO'

const VALID_KINDS: AssetKind[] = [
  'MARKETING_IMAGE',
  'SQUARE_MARKETING_IMAGE',
  'PORTRAIT_MARKETING_IMAGE',
  'LOGO',
  'SQUARE_LOGO',
]

async function resolveLocale(): Promise<'tr' | 'en'> {
  const cookieStore = await cookies()
  return (cookieStore.get('NEXT_LOCALE')?.value ?? 'tr') === 'en' ? 'en' : 'tr'
}

/** Basit SSRF filtresi — localhost, RFC1918, metadata servisleri engellenir */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h === '0.0.0.0' || h === '::1' || h === '::' || h === '[::1]') return true
  if (h === '169.254.169.254') return true // AWS/GCP metadata
  if (h === 'metadata.google.internal') return true
  if (/^127\./.test(h)) return true
  if (/^10\./.test(h)) return true
  if (/^192\.168\./.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
  if (/^fe80:/.test(h)) return true
  return false
}

function isHttpUrl(u: string): boolean {
  try {
    const parsed = new URL(u)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** srcset'ten en geniş URL'yi seç (lazy/responsive img patternlerine uygun) */
function pickBestFromSrcset(srcset: string): string | null {
  // "url1 320w, url2 640w, url3 1080w" veya "url1 1x, url2 2x"
  const parts = srcset.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) return null
  let best: { url: string; weight: number } | null = null
  for (const p of parts) {
    const tokens = p.split(/\s+/)
    const url = tokens[0]
    if (!url) continue
    const desc = tokens[1] ?? ''
    const wMatch = /^(\d+)w$/.exec(desc)
    const xMatch = /^([\d.]+)x$/.exec(desc)
    const weight = wMatch ? parseInt(wMatch[1], 10) : xMatch ? parseFloat(xMatch[1]) * 1000 : 0
    if (!best || weight > best.weight) best = { url, weight }
  }
  return best?.url ?? null
}

/** "background-image: url('...')" inline stilden URL çek */
function extractBgUrls(style: string): string[] {
  const out: string[] = []
  const re = /url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi
  for (const m of style.matchAll(re)) out.push(m[2])
  return out
}

function extractImageCandidates(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl)
  const out = new Set<string>()
  const toAbs = (src: string): string | null => {
    if (!src) return null
    const trimmed = src.trim()
    if (!trimmed) return null
    // Lazy-load placeholder'larını (data: URI, transparent gif/svg) ele
    if (/^data:/i.test(trimmed)) return null
    try {
      const abs = new URL(trimmed, base).toString()
      if (!isHttpUrl(abs)) return null
      return abs
    } catch {
      return null
    }
  }

  // og:image, twitter:image
  const metaRe = /<meta\s+[^>]*(?:property|name)\s*=\s*["'](og:image(?::secure_url|:url)?|twitter:image(?::src)?)["'][^>]*content\s*=\s*["']([^"']+)["']/gi
  for (const m of html.matchAll(metaRe)) {
    const abs = toAbs(m[2])
    if (abs) out.add(abs)
  }
  const metaReRev = /<meta\s+[^>]*content\s*=\s*["']([^"']+)["'][^>]*(?:property|name)\s*=\s*["'](og:image(?::secure_url|:url)?|twitter:image(?::src)?)["']/gi
  for (const m of html.matchAll(metaReRev)) {
    const abs = toAbs(m[1])
    if (abs) out.add(abs)
  }

  // link rel="icon" / "apple-touch-icon"
  const linkRe = /<link\s+[^>]*rel\s*=\s*["']([^"']*(?:icon|apple-touch-icon)[^"']*)["'][^>]*href\s*=\s*["']([^"']+)["']/gi
  for (const m of html.matchAll(linkRe)) {
    const abs = toAbs(m[2])
    if (abs) out.add(abs)
  }
  const linkReRev = /<link\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']([^"']*(?:icon|apple-touch-icon)[^"']*)["']/gi
  for (const m of html.matchAll(linkReRev)) {
    const abs = toAbs(m[1])
    if (abs) out.add(abs)
  }

  // <img>, <source>, <picture> — tag'in TÜM attribute'larını yakalayıp lazy-load varyantlarını dene
  const imgTagRe = /<(img|source)\s+([^>]*?)\/?>/gi
  for (const m of html.matchAll(imgTagRe)) {
    const attrs = m[2]
    const attrRe = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
    const map: Record<string, string> = {}
    for (const a of attrs.matchAll(attrRe)) {
      map[a[1].toLowerCase()] = a[2] ?? a[3] ?? ''
    }
    // Lazy-load attributes (öncelik sırasına göre — gerçek görsel önce)
    const lazyKeys = [
      'data-src', 'data-lazy-src', 'data-original', 'data-original-src',
      'data-image', 'data-large_image', 'data-full', 'data-orig-file',
      'data-bg', 'data-background', 'data-srcset', 'data-lazy-srcset',
    ]
    for (const k of lazyKeys) {
      if (!map[k]) continue
      if (k.endsWith('srcset')) {
        const best = pickBestFromSrcset(map[k])
        const abs = best ? toAbs(best) : null
        if (abs) out.add(abs)
      } else {
        const abs = toAbs(map[k])
        if (abs) out.add(abs)
      }
    }
    // srcset (öncelik: en geniş)
    if (map.srcset) {
      const best = pickBestFromSrcset(map.srcset)
      const abs = best ? toAbs(best) : null
      if (abs) out.add(abs)
    }
    // src (data: değilse)
    if (map.src) {
      const abs = toAbs(map.src)
      if (abs) out.add(abs)
    }
  }

  // Inline style="background-image: url(...)"
  const styleRe = /\sstyle\s*=\s*"([^"]+)"/gi
  for (const m of html.matchAll(styleRe)) {
    if (!/background/i.test(m[1])) continue
    for (const u of extractBgUrls(m[1])) {
      const abs = toAbs(u)
      if (abs) out.add(abs)
    }
  }
  const styleReSingle = /\sstyle\s*=\s*'([^']+)'/gi
  for (const m of html.matchAll(styleReSingle)) {
    if (!/background/i.test(m[1])) continue
    for (const u of extractBgUrls(m[1])) {
      const abs = toAbs(u)
      if (abs) out.add(abs)
    }
  }

  // <style> block'larında background-image
  const styleBlockRe = /<style[^>]*>([\s\S]*?)<\/style>/gi
  for (const m of html.matchAll(styleBlockRe)) {
    for (const u of extractBgUrls(m[1])) {
      const abs = toAbs(u)
      if (abs) out.add(abs)
    }
  }

  // İkonları/sprite'ları/spacer'ları/tracking pixel'leri filtrele
  const trackingHosts = [
    'facebook.com/tr', 'connect.facebook.net',
    'google-analytics.com', 'analytics.google.com',
    'googletagmanager.com', 'doubleclick.net',
    'googleadservices.com', 'googlesyndication.com',
    'hotjar.com', 'mixpanel.com', 'segment.io',
    'pixel.', 'beacon.', 'tracking.',
  ]
  const filtered = Array.from(out).filter(u => {
    const lower = u.toLowerCase()
    if (/\.(svg|ico)(\?|$)/i.test(lower)) return false
    if (/(spacer|blank|placeholder|transparent|pixel|sprite|spinner|loader)\.(png|gif|jpg|jpeg|webp)(\?|$)/i.test(lower)) return false
    if (/1x1\.(png|gif|jpe?g)/i.test(lower)) return false
    // Analytics/tracking pixel'leri
    if (trackingHosts.some(h => lower.includes(h))) return false
    // Görsel uzantısı YOK ve query'de tracking parametreleri var → atla
    if (!/\.(jpe?g|png|gif|webp|avif|bmp)(\?|$)/i.test(lower) && /[?&](id|ev|tid|uid|cid|fbp|gclid)=/i.test(lower)) return false
    return true
  })

  return filtered.slice(0, 80)
}

/** GET ?url=<site> — siteyi tara, aday görsel URL'leri dön */
export async function GET(req: NextRequest) {
  const locale = await resolveLocale()
  const msg = SCRAPE_ERRORS[locale]
  const { searchParams } = new URL(req.url)
  const target = (searchParams.get('url') ?? '').trim()
  if (!target || !isHttpUrl(target)) {
    return NextResponse.json({ error: msg.invalidUrl }, { status: 400 })
  }
  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    return NextResponse.json({ error: msg.invalidUrl }, { status: 400 })
  }
  if (isBlockedHost(parsed.hostname)) {
    return NextResponse.json({ error: msg.blockedUrl }, { status: 400 })
  }
  try {
    const res = await fetchWithTimeout(target, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      },
      redirect: 'follow',
    })
    if (!res.ok) {
      console.warn('[scrape] non-OK response', target, res.status)
      return NextResponse.json({ error: msg.fetchFailed, status: res.status }, { status: 502 })
    }
    const contentType = res.headers.get('content-type') ?? ''
    if (!/text\/html|application\/xhtml|text\/plain/.test(contentType)) {
      return NextResponse.json({ error: msg.fetchFailed, contentType }, { status: 415 })
    }
    const html = await res.text()
    const candidates = extractImageCandidates(html, target)
    return NextResponse.json({
      url: target,
      images: candidates.map(u => ({ url: u, source: new URL(u).hostname })),
      htmlLength: html.length,
    })
  } catch (e) {
    console.warn('[scrape] fetch error', target, e instanceof Error ? e.message : String(e))
    return NextResponse.json({ error: msg.fetchFailed }, { status: 502 })
  }
}

/** POST { imageUrl, kind, name } — aday görseli indir + Google Ads asset olarak yükle */
export async function POST(req: NextRequest) {
  const locale = await resolveLocale()
  const msg = SCRAPE_ERRORS[locale]
  try {
    const ctx = await getGoogleAdsContext()
    const body = (await req.json()) as { imageUrl?: string; kind?: AssetKind; name?: string }
    if (!body.kind || !VALID_KINDS.includes(body.kind)) {
      return NextResponse.json({ error: msg.invalidKind }, { status: 400 })
    }
    if (!body.imageUrl || !isHttpUrl(body.imageUrl)) {
      return NextResponse.json({ error: msg.invalidUrl }, { status: 400 })
    }
    let imageHost: string
    try {
      imageHost = new URL(body.imageUrl).hostname
    } catch {
      return NextResponse.json({ error: msg.invalidUrl }, { status: 400 })
    }
    if (isBlockedHost(imageHost)) {
      return NextResponse.json({ error: msg.blockedUrl }, { status: 400 })
    }

    let imageBytes: ArrayBuffer
    try {
      const imgRes = await fetchWithTimeout(body.imageUrl, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
      })
      if (!imgRes.ok) {
        return NextResponse.json({ error: msg.downloadFailed }, { status: 502 })
      }
      const ct = imgRes.headers.get('content-type') ?? ''
      if (!/^image\//i.test(ct)) {
        return NextResponse.json({ error: msg.downloadFailed }, { status: 415 })
      }
      imageBytes = await imgRes.arrayBuffer()
    } catch {
      return NextResponse.json({ error: msg.downloadFailed }, { status: 502 })
    }
    if (imageBytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: msg.tooLarge }, { status: 400 })
    }
    const bytes = new Uint8Array(imageBytes)
    const base64 = Buffer.from(bytes).toString('base64')

    const safeName = (body.name || 'web_asset').slice(0, 100) + ' ' + Date.now()
    const operation = {
      create: {
        name: safeName,
        type: 'IMAGE',
        imageAsset: { data: base64 },
      },
    }
    const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/assets:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({ operations: [operation] }),
    })
    const data = await res.json()
    if (!res.ok) {
      const googleErr = data?.error
      const firstDetail = googleErr?.details?.[0]?.errors?.[0]
      const message = firstDetail?.message ?? googleErr?.message ?? msg.uploadFailed
      return NextResponse.json({ error: message }, { status: res.status })
    }
    const resourceName: string = data.results?.[0]?.resourceName
    return NextResponse.json({ resourceName, kind: body.kind, name: safeName }, { status: 201 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[assets/scrape POST] error:', message)
    return NextResponse.json({ error: msg.generic }, { status: 500 })
  }
}
