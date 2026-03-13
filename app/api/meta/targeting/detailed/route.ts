import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'

// In-memory cache
const cache = new Map<string, { data: any[]; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Canonical targeting type mapping.
 * Meta's targetingsearch returns various type strings;
 * we normalize them into 3 categories for the UI.
 */
function normalizeType(raw: string): 'interest' | 'behavior' | 'demographic' {
  const lower = raw.toLowerCase()
  if (lower === 'interests' || lower === 'interest') return 'interest'
  if (lower === 'behaviors' || lower === 'behavior') return 'behavior'
  // demographics, family_statuses, education_statuses, work_employers, etc.
  return 'demographic'
}

/**
 * GET /api/meta/targeting/detailed?q=...&locale=...
 *
 * Unified detailed targeting search using Meta's /{accountId}/targetingsearch.
 * Returns merged results from interests, behaviors, and demographics.
 * Each result includes a normalized `type` field.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
      return NextResponse.json({ ok: true, data: [] })
    }

    const locale = searchParams.get('locale') || 'tr_TR'
    const cacheKey = `detailed:${locale}:${query.toLowerCase().trim()}`
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

    const { client, accountId } = metaClient

    // Use targetingsearch on the ad account — returns interests, behaviors, demographics in one call
    const result = await client.get<{
      data?: Array<{
        id: string
        name: string
        type: string
        audience_size_lower_bound?: number
        audience_size_upper_bound?: number
        path?: string[]
        description?: string
      }>
    }>(`/${accountId}/targetingsearch`, {
      q: query,
      locale,
      limit: '30',
    })

    if (!result.ok) {
      // Fallback: try the old adinterest search endpoint
      const fallbackResult = await client.get('/search', {
        type: 'adinterest',
        q: query,
        locale,
      })

      if (fallbackResult.ok) {
        const interests = (fallbackResult.data?.data || []).map((int: any) => ({
          id: int.id,
          name: int.name,
          type: 'interest' as const,
          audience_size_lower_bound: int.audience_size_lower_bound,
          audience_size_upper_bound: int.audience_size_upper_bound,
          path: int.path,
        }))
        cache.set(cacheKey, { data: interests, ts: Date.now() })
        return NextResponse.json({ ok: true, data: interests })
      }

      return NextResponse.json(
        { ok: false, error: 'meta_api_error', message: result.error?.message || 'Hedefleme araması başarısız' },
        { status: 502 }
      )
    }

    const items = (result.data?.data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      type: normalizeType(item.type || 'interests'),
      audience_size_lower_bound: item.audience_size_lower_bound,
      audience_size_upper_bound: item.audience_size_upper_bound,
      path: item.path,
      description: item.description,
    }))

    // Deduplicate by id
    const seen = new Set<string>()
    const deduped = items.filter((item: any) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })

    cache.set(cacheKey, { data: deduped, ts: Date.now() })

    // Evict old entries
    if (cache.size > 200) {
      const now = Date.now()
      for (const [k, v] of cache) {
        if (now - v.ts > CACHE_TTL) cache.delete(k)
      }
    }

    return NextResponse.json({ ok: true, data: deduped })
  } catch (error) {
    if (DEBUG) console.error('Detailed targeting search error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
