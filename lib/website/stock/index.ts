import 'server-only'

/**
 * Stok görsel sağlayıcı soyutlaması (lisans-temiz, sunucu-taraflı).
 * Pexels / Unsplash / Pixabay resmi API'leri — env anahtarı yoksa o sağlayıcı boş döner.
 * Anahtar gelince otomatik devreye girer; hiçbiri yoksa görsel atlanır (site görselsiz de render olur).
 * Freepik (ücretli) ileride aynı arayüzle eklenir.
 */

export interface StockImage {
  url: string
  thumb: string
  width: number
  height: number
  source: 'pexels' | 'unsplash' | 'pixabay'
  attribution?: string
}

export function isStockReady(): boolean {
  return Boolean(
    process.env.PEXELS_API_KEY ||
      process.env.UNSPLASH_ACCESS_KEY ||
      process.env.PIXABAY_API_KEY,
  )
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

/** İlk anahtarı tanımlı sağlayıcıdan sonuç döndürür (Pexels → Unsplash → Pixabay). */
export async function searchStock(query: string, count = 5): Promise<StockImage[]> {
  const q = query.trim()
  if (!q) return []
  for (const provider of [searchPexels, searchUnsplash, searchPixabay]) {
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
