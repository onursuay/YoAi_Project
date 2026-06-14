import 'server-only'

/**
 * Stok görsel sağlayıcı soyutlaması (lisans-temiz, sunucu-taraflı).
 * Öncelik: Freepik (birincil — abonelik) → Pexels → Unsplash → Pixabay (ücretsiz yedek).
 * Env anahtarı yoksa o sağlayıcı boş döner; hiçbiri yoksa görsel atlanır (site görselsiz de render olur).
 *
 * Freepik API NOTU: "Premium indirme aboneliği" ile "Freepik API erişimi" AYRIDIR.
 * API anahtarı Freepik geliştirici panelinden alınır (ayrı faturalanabilir) ve env'e konur:
 *   FREEPIK_API_KEY=...                       (zorunlu)
 *   FREEPIK_API_BASE=https://api.freepik.com  (opsiyonel; Magnific anahtarı için https://api.magnific.com)
 */

export interface StockImage {
  url: string
  thumb: string
  width: number
  height: number
  source: 'freepik' | 'pexels' | 'unsplash' | 'pixabay'
  attribution?: string
}

export function isStockReady(): boolean {
  return Boolean(
    process.env.FREEPIK_API_KEY ||
      process.env.PEXELS_API_KEY ||
      process.env.UNSPLASH_ACCESS_KEY ||
      process.env.PIXABAY_API_KEY,
  )
}

function parseSize(size: unknown): { w: number; h: number } {
  const m = typeof size === 'string' ? size.match(/(\d+)\s*x\s*(\d+)/i) : null
  return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 1200, h: 800 }
}

/** Freepik/Magnific Stock Content API — GET /v1/resources (photo, landscape). */
async function searchFreepik(query: string, count: number): Promise<StockImage[]> {
  const key = process.env.FREEPIK_API_KEY
  if (!key) return []
  const base = process.env.FREEPIK_API_BASE || 'https://api.freepik.com'
  const headerName = base.includes('magnific') ? 'x-magnific-api-key' : 'x-freepik-api-key'
  const url =
    `${base}/v1/resources?term=${encodeURIComponent(query)}&limit=${Math.max(1, count)}` +
    `&order=relevance&filters[content_type][photo]=1&filters[orientation][landscape]=1`
  const data = (await fetchJson(url, { headers: { [headerName]: key, 'Accept-Language': 'en-US' } })) as {
    data?: { image?: { type?: string; source?: { url?: string; size?: string } }; author?: { name?: string } }[]
  } | null
  if (!data?.data) return []
  return data.data
    .filter((r) => r.image?.type === 'photo' && typeof r.image?.source?.url === 'string')
    .map((r) => {
      const { w, h } = parseSize(r.image?.source?.size)
      const u = r.image!.source!.url as string
      return { url: u, thumb: u, width: w, height: h, source: 'freepik' as const, attribution: r.author?.name }
    })
    .filter((x) => x.url.startsWith('http') && x.url.length > 12)
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function searchPexels(query: string, count: number): Promise<StockImage[]> {
  const key = process.env.PEXELS_API_KEY
  if (!key) return []
  const data = (await fetchJson(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
    { headers: { Authorization: key } },
  )) as { photos?: { src?: { large2x?: string; large?: string; medium?: string }; width?: number; height?: number; photographer?: string }[] } | null
  if (!data?.photos) return []
  return data.photos
    .map((p) => ({
      url: p.src?.large2x || p.src?.large || p.src?.medium || '',
      thumb: p.src?.medium || p.src?.large || '',
      width: p.width ?? 1200,
      height: p.height ?? 800,
      source: 'pexels' as const,
      attribution: p.photographer,
    }))
    .filter((x) => x.url)
}

async function searchUnsplash(query: string, count: number): Promise<StockImage[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) return []
  const data = (await fetchJson(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
    { headers: { Authorization: `Client-ID ${key}` } },
  )) as { results?: { urls?: { regular?: string; small?: string }; width?: number; height?: number; user?: { name?: string } }[] } | null
  if (!data?.results) return []
  return data.results
    .map((p) => ({
      url: p.urls?.regular || '',
      thumb: p.urls?.small || p.urls?.regular || '',
      width: p.width ?? 1200,
      height: p.height ?? 800,
      source: 'unsplash' as const,
      attribution: p.user?.name,
    }))
    .filter((x) => x.url)
}

async function searchPixabay(query: string, count: number): Promise<StockImage[]> {
  const key = process.env.PIXABAY_API_KEY
  if (!key) return []
  const data = (await fetchJson(
    `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=${Math.max(3, count)}`,
  )) as { hits?: { largeImageURL?: string; webformatURL?: string; imageWidth?: number; imageHeight?: number; user?: string }[] } | null
  if (!data?.hits) return []
  return data.hits
    .map((p) => ({
      url: p.largeImageURL || p.webformatURL || '',
      thumb: p.webformatURL || '',
      width: p.imageWidth ?? 1200,
      height: p.imageHeight ?? 800,
      source: 'pixabay' as const,
      attribution: p.user,
    }))
    .filter((x) => x.url)
}

/** İlk anahtarı tanımlı sağlayıcıdan sonuç döndürür (Freepik → Pexels → Unsplash → Pixabay). */
export async function searchStock(query: string, count = 5): Promise<StockImage[]> {
  const q = query.trim()
  if (!q) return []
  for (const provider of [searchFreepik, searchPexels, searchUnsplash, searchPixabay]) {
    const res = await provider(q, count)
    if (res.length) return res
  }
  return []
}

/** Tek en uygun görseli döner (yoksa null). */
export async function pickStockImage(query: string): Promise<StockImage | null> {
  const res = await searchStock(query, 3)
  return res[0] ?? null
}
