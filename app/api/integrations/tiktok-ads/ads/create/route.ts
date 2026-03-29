import { NextResponse } from 'next/server'
import { getTikTokContext, tiktokApiRequest } from '@/lib/tiktokAdsAuth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/integrations/tiktok-ads/ads/create
 * Create a new TikTok ad within an ad group.
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

  let body: {
    adGroupId?: string
    name?: string
    adText?: string
    callToAction?: string
    videoId?: string
    imageIds?: string[]
    landingPageUrl?: string
    displayName?: string
    identityId?: string
    identityType?: string
    adFormat?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_body', message: 'JSON body required' },
      { status: 400 }
    )
  }

  if (!body.adGroupId) {
    return NextResponse.json(
      { ok: false, error: 'validation_error', message: 'Ad group ID is required' },
      { status: 400 }
    )
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json(
      { ok: false, error: 'validation_error', message: 'Ad name is required' },
      { status: 400 }
    )
  }

  try {
    const payload: Record<string, unknown> = {
      advertiser_id: ctx.advertiserId,
      adgroup_id: body.adGroupId,
      ad_name: name,
      ad_format: body.adFormat || 'SINGLE_VIDEO',
      operation_status: 'DISABLE', // Start paused
    }

    if (body.adText) {
      payload.ad_text = body.adText
    }
    if (body.callToAction) {
      payload.call_to_action = body.callToAction
    }
    if (body.videoId) {
      payload.video_id = body.videoId
    }
    if (body.imageIds && body.imageIds.length > 0) {
      payload.image_ids = body.imageIds
    }
    if (body.landingPageUrl) {
      payload.landing_page_url = body.landingPageUrl
    }
    if (body.displayName) {
      payload.display_name = body.displayName
    }
    if (body.identityId) {
      payload.identity_id = body.identityId
    }
    if (body.identityType) {
      payload.identity_type = body.identityType
    }

    const result = await tiktokApiRequest<{ ad_id: string }>(
      '/ad/create/',
      ctx,
      { body: payload }
    )

    return NextResponse.json(
      { ok: true, adId: result.ad_id },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[TikTok Ad Create] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: 'tiktok_api_error', message },
      { status: 502 }
    )
  }
}
