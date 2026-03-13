import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'
import { getCached, setCached } from '@/lib/meta/cache'

export const dynamic = 'force-dynamic'

const CACHE_KEY_PREFIX = 'meta_audience_sources_'

interface SourceItem {
  id: string
  name: string
  sourceCode?: string
  type: 'catalog' | 'pixel' | 'page'
}

/**
 * GET /api/meta/audiences/sources
 *
 * Fetches available lookalike audience sources:
 *   - Value-based: product catalogs + pixels
 *   - Other: Facebook pages
 */
export async function GET() {
  try {
    const ctx = await resolveMetaContext()
    if (!ctx) {
      return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
    }

    const cacheKey = `${CACHE_KEY_PREFIX}${ctx.accountId}`
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const valueBased: SourceItem[] = []
    const other: SourceItem[] = []

    // 1. Product catalogs
    try {
      const catalogRes = await ctx.client.get<{
        data?: { id: string; name: string }[]
      }>(`/${ctx.accountId}/owned_product_catalogs`, {
        fields: 'id,name',
        limit: '50',
      })

      if (catalogRes.ok && catalogRes.data?.data) {
        for (const c of catalogRes.data.data) {
          valueBased.push({
            id: c.id,
            name: c.name,
            sourceCode: `Kaynak Kodu: ${c.id}`,
            type: 'catalog',
          })
        }
      }
    } catch {
      // Catalogs fetch failed — continue
    }

    // 2. Pixels
    try {
      const pixelRes = await ctx.client.get<{
        data?: { id: string; name: string }[]
      }>(`/${ctx.accountId}/adspixels`, {
        fields: 'id,name',
        limit: '10',
      })

      if (pixelRes.ok && pixelRes.data?.data) {
        for (const p of pixelRes.data.data) {
          valueBased.push({
            id: p.id,
            name: p.name,
            sourceCode: `Kaynak Kodu: ${p.id}`,
            type: 'pixel',
          })
        }
      }
    } catch {
      // Pixels fetch failed — continue
    }

    // 3. Pages
    try {
      const pageRes = await ctx.client.get<{
        data?: { id: string; name: string }[]
      }>('/me/accounts', {
        fields: 'id,name',
        limit: '100',
      })

      if (pageRes.ok && pageRes.data?.data) {
        for (const p of pageRes.data.data) {
          other.push({
            id: p.id,
            name: p.name,
            type: 'page',
          })
        }
      }
    } catch {
      // Pages fetch failed — continue
    }

    const payload = { ok: true, valueBased, other }
    setCached(cacheKey, payload)
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
