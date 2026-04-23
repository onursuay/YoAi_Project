import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsContext, buildGoogleAdsHeaders, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'

const MAX_BYTES = 5 * 1024 * 1024
const USER_AGENT = 'Mozilla/5.0 (compatible; YoAiBot/1.0; +https://yodijital.com)'
const FETCH_TIMEOUT_MS = 8000

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

function extractImageCandidates(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl)
  const out = new Set<string>()
  const toAbs = (src: string): string | null => {
    if (!src) return null
    try {
      const abs = new URL(src, base).toString()
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

  // link rel="icon" / "apple-touch-icon" / "shortcut icon"
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

  // <img src="...">
  const imgRe = /<img\s+[^>]*src\s*=\s*["']([^"']+)["']/gi
  for (const m of html.matchAll(imgRe)) {
    const abs = toAbs(m[1])
    if (abs) out.add(abs)
  }
  // <img ... srcset="url1 1x, url2 2x">
  const srcsetRe = /<img\s+[^>]*srcset\s*=\s*["']([^"']+)["']/gi
  for (const m of html.matchAll(srcsetRe)) {
    const first = m[1].split(',')[0]?.trim().split(/\s+/)[0]
    if (first) {
      const abs = toAbs(first)
      if (abs) out.add(abs)
    }
  }

  // Filter: sadece image uzantılı veya şüphesiz image URL'leri — bazı CDN'ler uzantısız döner, onları da kabul edelim
  return Array.from(out).slice(0, 50)
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
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    if (!res.ok) {
      return NextResponse.json({ error: msg.fetchFailed }, { status: 502 })
    }
    const contentType = res.headers.get('content-type') ?? ''
    if (!/text\/html|application\/xhtml/.test(contentType)) {
      return NextResponse.json({ error: msg.fetchFailed }, { status: 415 })
    }
    const html = await res.text()
    const candidates = extractImageCandidates(html, target)
    return NextResponse.json({
      url: target,
      images: candidates.map(u => ({ url: u, source: new URL(u).hostname })),
    })
  } catch {
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
