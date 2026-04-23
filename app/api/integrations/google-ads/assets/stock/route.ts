import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsContext, buildGoogleAdsHeaders, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'

const PEXELS_API = 'https://api.pexels.com/v1'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_PEXELS_HOSTS = new Set(['images.pexels.com', 'www.pexels.com', 'pexels.com'])

const STOCK_ERRORS = {
  tr: {
    notConfigured: 'Stok resim özelliği henüz yapılandırılmadı. Yönetici PEXELS_API_KEY eklemelidir.',
    queryRequired: 'Arama metni gerekli',
    pexelsFailed: 'Pexels\'ten sonuç alınamadı',
    invalidUrl: 'Geçersiz görsel URL\'si',
    downloadFailed: 'Görsel indirilemedi',
    tooLarge: 'Görsel 5 MB sınırını aşıyor',
    uploadFailed: 'Google Ads\'e yükleme başarısız oldu',
    invalidKind: 'Geçersiz asset türü',
    generic: 'İşlem başarısız oldu',
  },
  en: {
    notConfigured: 'Stock images are not configured yet. Admin must set PEXELS_API_KEY.',
    queryRequired: 'Search query is required',
    pexelsFailed: 'Could not fetch from Pexels',
    invalidUrl: 'Invalid image URL',
    downloadFailed: 'Image download failed',
    tooLarge: 'Image exceeds 5 MB limit',
    uploadFailed: 'Upload to Google Ads failed',
    invalidKind: 'Invalid asset kind',
    generic: 'Operation failed',
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

interface PexelsPhoto {
  id: number
  width: number
  height: number
  url: string
  photographer: string
  photographer_url: string
  alt: string
  src: {
    original: string
    large2x: string
    large: string
    medium: string
    small: string
    tiny: string
    portrait: string
    landscape: string
  }
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[]
  total_results: number
  page: number
  per_page: number
  next_page?: string
}

async function resolveLocale(): Promise<'tr' | 'en'> {
  const cookieStore = await cookies()
  return (cookieStore.get('NEXT_LOCALE')?.value ?? 'tr') === 'en' ? 'en' : 'tr'
}

/** GET /api/integrations/google-ads/assets/stock?q=...&page=1 — Pexels search proxy */
export async function GET(req: NextRequest) {
  const locale = await resolveLocale()
  const msg = STOCK_ERRORS[locale]
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: msg.notConfigured }, { status: 503 })
  }
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const perPage = Math.min(30, Math.max(8, Number(searchParams.get('per_page') ?? '21')))
  if (!q) {
    return NextResponse.json({ error: msg.queryRequired }, { status: 400 })
  }
  try {
    const url = `${PEXELS_API}/search?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}&locale=${locale === 'tr' ? 'tr-TR' : 'en-US'}`
    const res = await fetch(url, { headers: { Authorization: apiKey } })
    if (!res.ok) {
      return NextResponse.json({ error: msg.pexelsFailed }, { status: res.status })
    }
    const data = (await res.json()) as PexelsSearchResponse
    const photos = (data.photos ?? []).map(p => ({
      id: p.id,
      width: p.width,
      height: p.height,
      previewUrl: p.src.medium,
      downloadUrl: p.src.large2x,
      photographer: p.photographer,
      photographerUrl: p.photographer_url,
      alt: p.alt || `Pexels ${p.id}`,
      sourceUrl: p.url,
    }))
    return NextResponse.json({
      photos,
      page: data.page,
      perPage: data.per_page,
      totalResults: data.total_results,
      hasNext: Boolean(data.next_page),
    })
  } catch {
    return NextResponse.json({ error: msg.pexelsFailed }, { status: 502 })
  }
}

/** POST — Pexels URL'sini indir, Google Ads AssetService'e yükle, resourceName dön */
export async function POST(req: NextRequest) {
  const locale = await resolveLocale()
  const msg = STOCK_ERRORS[locale]
  try {
    const ctx = await getGoogleAdsContext()
    const body = (await req.json()) as { imageUrl?: string; kind?: AssetKind; name?: string }
    if (!body.kind || !VALID_KINDS.includes(body.kind)) {
      return NextResponse.json({ error: msg.invalidKind }, { status: 400 })
    }
    if (!body.imageUrl) {
      return NextResponse.json({ error: msg.invalidUrl }, { status: 400 })
    }
    // Yalnızca Pexels host'lu URL'leri kabul et — SSRF korunması
    let host: string
    try {
      host = new URL(body.imageUrl).hostname.toLowerCase()
    } catch {
      return NextResponse.json({ error: msg.invalidUrl }, { status: 400 })
    }
    if (!ALLOWED_PEXELS_HOSTS.has(host)) {
      return NextResponse.json({ error: msg.invalidUrl }, { status: 400 })
    }

    // Görseli indir
    let imageBytes: ArrayBuffer
    try {
      const imgRes = await fetch(body.imageUrl)
      if (!imgRes.ok) {
        return NextResponse.json({ error: msg.downloadFailed }, { status: 502 })
      }
      imageBytes = await imgRes.arrayBuffer()
    } catch {
      return NextResponse.json({ error: msg.downloadFailed }, { status: 502 })
    }
    if (imageBytes.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: msg.tooLarge }, { status: 400 })
    }

    // Base64'e çevir (büyük buffer'lar için chunk)
    const bytes = new Uint8Array(imageBytes)
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    const base64 = typeof Buffer !== 'undefined' ? Buffer.from(bytes).toString('base64') : btoa(binary)

    const safeName = (body.name || `Pexels ${Date.now()}`).slice(0, 120) + ' ' + Date.now()
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
    console.error('[assets/stock POST] error:', message)
    return NextResponse.json({ error: msg.generic }, { status: 500 })
  }
}
