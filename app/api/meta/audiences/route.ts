import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'
import { getCached, setCached } from '@/lib/meta/cache'

export const dynamic = 'force-dynamic'

const CACHE_KEY_PREFIX = 'meta_audiences_'

interface MetaAudience {
  id: string
  name: string
  type: 'CUSTOM' | 'LOOKALIKE' | 'SAVED'
  subtype?: string
  approximateCount?: { lower: number; upper: number }
  deliveryStatus?: string
  operationStatus?: { code: number; description: string }
  targeting?: Record<string, unknown>
  createdTime: string
}

/**
 * GET /api/meta/audiences
 * Fetches existing audiences from Meta Graph API for the connected ad account.
 */
export async function GET() {
  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
  }

  const cacheKey = `${CACHE_KEY_PREFIX}${ctx.accountId}`
  const cached = getCached(cacheKey)
  if (cached) {
    return NextResponse.json(cached)
  }

  const audiences: MetaAudience[] = []

  // Fetch custom audiences (includes lookalikes)
  try {
    const customRes = await ctx.client.get<{
      data?: Array<{
        id: string
        name: string
        subtype: string
        approximate_count_lower_bound?: number
        approximate_count_upper_bound?: number
        delivery_status?: { status: string }
        operation_status?: { code: number; description: string }
        created_time: string
      }>
    }>(`/${ctx.accountId}/customaudiences`, {
      fields: 'id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status,operation_status,created_time',
      limit: '100',
    })

    if (customRes.ok && customRes.data?.data) {
      for (const a of customRes.data.data) {
        audiences.push({
          id: a.id,
          name: a.name,
          type: a.subtype === 'LOOKALIKE' ? 'LOOKALIKE' : 'CUSTOM',
          subtype: a.subtype,
          approximateCount: a.approximate_count_lower_bound != null
            ? { lower: a.approximate_count_lower_bound, upper: a.approximate_count_upper_bound ?? 0 }
            : undefined,
          deliveryStatus: a.delivery_status?.status,
          operationStatus: a.operation_status,
          createdTime: a.created_time,
        })
      }
    }
  } catch {
    // Custom audiences fetch failed — continue with saved
  }

  // Fetch saved audiences
  try {
    const savedRes = await ctx.client.get<{
      data?: Array<{
        id: string
        name: string
        targeting?: Record<string, unknown>
        created_time: string
      }>
    }>(`/${ctx.accountId}/saved_audiences`, {
      fields: 'id,name,targeting,created_time',
      limit: '100',
    })

    if (savedRes.ok && savedRes.data?.data) {
      for (const a of savedRes.data.data) {
        audiences.push({
          id: a.id,
          name: a.name,
          type: 'SAVED',
          targeting: a.targeting,
          createdTime: a.created_time,
        })
      }
    }
  } catch {
    // Saved audiences fetch failed
  }

  const payload = { ok: true, audiences }
  setCached(cacheKey, payload)
  return NextResponse.json(payload)
}
