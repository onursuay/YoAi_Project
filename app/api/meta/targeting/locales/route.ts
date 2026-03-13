import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'

// Cache locale searches — they rarely change
const cache = new Map<string, { data: any[]; ts: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const locale = searchParams.get('locale') || 'en_US' // Default to en_US for English names

    if (!query || query.length < 1) {
      return NextResponse.json({ ok: true, data: [] })
    }

    // Include locale in cache key to prevent mixing different language results
    const cacheKey = `locale:${locale}:${query.toLowerCase().trim()}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ ok: true, data: cached.data })
    }

    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    const result = await metaClient.client.get('/search', {
      type: 'adlocale',
      q: query,
      locale, // Pass locale to Meta API for language-specific names
    })

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: 'meta_api_error', message: result.error?.message || 'Dil araması başarısız' },
        { status: 502 }
      )
    }

    const locales = (result.data?.data || []).map((loc: { key: number; name: string }) => ({
      key: loc.key,
      name: loc.name,
    }))

    cache.set(cacheKey, { data: locales, ts: Date.now() })
    // Evict old entries
    if (cache.size > 100) {
      const now = Date.now()
      for (const [k, v] of cache) {
        if (now - v.ts > CACHE_TTL) cache.delete(k)
      }
    }

    return NextResponse.json({ ok: true, data: locales })
  } catch (error) {
    if (DEBUG) console.error('Locale search error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
