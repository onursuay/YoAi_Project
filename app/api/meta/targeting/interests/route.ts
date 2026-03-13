import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'

// In-memory cache: key → { data, ts }
const cache = new Map<string, { data: any[]; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
      return NextResponse.json({ ok: true, data: [] })
    }

    const locale = searchParams.get('locale') || 'tr_TR'
    const cacheKey = `interest:${locale}:${query.toLowerCase().trim()}`
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
      type: 'adinterest',
      q: query,
      locale,
    })

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: 'meta_api_error', message: result.error?.message || 'İlgi alanı araması başarısız' },
        { status: 502 }
      )
    }

    const interests = (result.data?.data || []).map((int: { id: string; name: string; audience_size_lower_bound?: number; audience_size_upper_bound?: number; path?: string[] }) => ({
      id: int.id,
      name: int.name,
      audience_size_lower_bound: int.audience_size_lower_bound,
      audience_size_upper_bound: int.audience_size_upper_bound,
      path: int.path,
    }))

    // Cache result
    cache.set(cacheKey, { data: interests, ts: Date.now() })
    // Evict old entries
    if (cache.size > 200) {
      const now = Date.now()
      for (const [k, v] of cache) {
        if (now - v.ts > CACHE_TTL) cache.delete(k)
      }
    }

    return NextResponse.json({ ok: true, data: interests })
  } catch (error) {
    if (DEBUG) console.error('Interest search error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
