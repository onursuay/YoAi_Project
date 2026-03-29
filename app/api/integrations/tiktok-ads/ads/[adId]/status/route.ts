import { NextResponse } from 'next/server'
import { getTikTokContext, tiktokApiRequest } from '@/lib/tiktokAdsAuth'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['ENABLE', 'DISABLE', 'DELETE'] as const

/**
 * POST /api/integrations/tiktok-ads/ads/[adId]/status
 * Enable, disable (pause), or delete a TikTok ad.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ adId: string }> }
) {
  const { adId } = await params
  const aid = String(adId || '').trim()

  if (!aid) {
    return NextResponse.json(
      { ok: false, error: 'invalid_id', message: 'Ad ID is required' },
      { status: 400 }
    )
  }

  let ctx
  try {
    ctx = await getTikTokContext()
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string }
    return NextResponse.json(
      { ok: false, error: e.code || 'not_connected', message: e.message },
      { status: e.status || 401 }
    )
  }

  let body: { status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_body', message: 'JSON body required' },
      { status: 400 }
    )
  }

  const status = body.status?.toUpperCase()
  if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { ok: false, error: 'validation_error', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    await tiktokApiRequest<Record<string, unknown>>(
      '/ad/status/update/',
      ctx,
      {
        body: {
          advertiser_id: ctx.advertiserId,
          ad_ids: [aid],
          opt_status: status,
        },
      }
    )

    return NextResponse.json(
      { ok: true, adId: aid, status },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[TikTok Ad Status] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: 'tiktok_api_error', message },
      { status: 502 }
    )
  }
}
