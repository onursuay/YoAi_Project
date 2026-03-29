import { NextResponse } from 'next/server'
import { getTikTokContext, tiktokApiRequest } from '@/lib/tiktokAdsAuth'

export const dynamic = 'force-dynamic'

interface TikTokPixel {
  pixel_id: string
  pixel_name: string
  pixel_code: string
  status: string
  create_time: string
}

/**
 * GET /api/integrations/tiktok-ads/pixel
 * List pixels for the advertiser.
 */
export async function GET() {
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

  try {
    const data = await tiktokApiRequest<{ pixels: TikTokPixel[] }>(
      '/pixel/list/',
      ctx,
      {
        params: {
          advertiser_id: ctx.advertiserId,
          page_size: '50',
        },
      }
    )

    const pixels = (data?.pixels || []).map((p) => ({
      pixelId: p.pixel_id,
      pixelName: p.pixel_name,
      pixelCode: p.pixel_code,
      status: p.status,
      createdAt: p.create_time,
    }))

    return NextResponse.json(
      { ok: true, pixels },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[TikTok Pixel List] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: 'tiktok_api_error', message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/integrations/tiktok-ads/pixel
 * Create a new pixel.
 */
export async function POST(request: Request) {
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

  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_body', message: 'JSON body required' },
      { status: 400 }
    )
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json(
      { ok: false, error: 'validation_error', message: 'Pixel name is required' },
      { status: 400 }
    )
  }

  try {
    const result = await tiktokApiRequest<{ pixel_id: string; pixel_code: string }>(
      '/pixel/create/',
      ctx,
      {
        body: {
          advertiser_id: ctx.advertiserId,
          pixel_name: name,
        },
      }
    )

    return NextResponse.json(
      {
        ok: true,
        pixelId: result.pixel_id,
        pixelCode: result.pixel_code,
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[TikTok Pixel Create] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: 'tiktok_api_error', message },
      { status: 502 }
    )
  }
}
