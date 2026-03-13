import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

// Cache browse results per account+locale (they rarely change)
const browseCache = new Map<string, { data: any[]; ts: number }>()
const BROWSE_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get('locale') || 'tr_TR'
    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    // Check cache
    const cacheKey = `browse:${metaClient.accountId}:${locale}`
    const cached = browseCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < BROWSE_CACHE_TTL) {
      return NextResponse.json({ ok: true, data: cached.data })
    }

    // Step 1: Get browse results (targetingbrowse doesn't support locale)
    const result = await metaClient.client.get(`/${metaClient.accountId}/targetingbrowse`, {
      limit_type: 'interests',
    })

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: 'meta_api_error', message: result.error?.message || 'Browse başarısız' },
        { status: 502 }
      )
    }

    const rawItems = (result.data?.data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      path: item.path,
      audience_size_lower_bound: item.audience_size_lower_bound,
      audience_size_upper_bound: item.audience_size_upper_bound,
      description: item.description,
    }))

    // Step 2: Batch-resolve IDs with locale to get localized names
    // The Graph API /?ids=... endpoint returns localized object names
    if (locale !== 'en_US' && rawItems.length > 0) {
      try {
        // Split into chunks of 50 (Meta API limit)
        const chunks: string[][] = []
        const ids = rawItems.map((i: any) => i.id)
        for (let i = 0; i < ids.length; i += 50) {
          chunks.push(ids.slice(i, i + 50))
        }

        for (const chunk of chunks) {
          const localizedResult = await metaClient.client.get('/', {
            ids: chunk.join(','),
            fields: 'name',
            locale,
          })

          if (localizedResult.ok && localizedResult.data) {
            // Response format: { "id1": { "name": "...", "id": "..." }, "id2": { ... } }
            for (const item of rawItems) {
              const localized = localizedResult.data[item.id]
              if (localized?.name) {
                item.name = localized.name
              }
            }
          }
        }
      } catch {
        // Fallback: keep original (English) names
      }
    }

    // Cache
    browseCache.set(cacheKey, { data: rawItems, ts: Date.now() })

    return NextResponse.json({ ok: true, data: rawItems })
  } catch (error) {
    console.error('Browse error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
