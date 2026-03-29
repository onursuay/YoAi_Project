import { NextResponse } from 'next/server'
import { getTikTokContext, tiktokApiRequest } from '@/lib/tiktokAdsAuth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/integrations/tiktok-ads/ads/[adId]/update
 * Update an existing TikTok ad.
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

  let body: {
    name?: string
    adText?: string
    callToAction?: string
    videoId?: string
    imageIds?: string[]
    landingPageUrl?: string
    displayName?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_body', message: 'JSON body required' },
      { status: 400 }
    )
  }

  const updatedFields: string[] = []
  const payload: Record<string, unknown> = {
    advertiser_id: ctx.advertiserId,
    ad_id: aid,
  }

  if (body.name !== undefined && body.name.trim() !== '') {
    payload.ad_name = body.name.trim()
    updatedFields.push('ad_name')
  }
  if (body.adText !== undefined) {
    payload.ad_text = body.adText
    updatedFields.push('ad_text')
  }
  if (body.callToAction !== undefined) {
    payload.call_to_action = body.callToAction
    updatedFields.push('call_to_action')
  }
  if (body.videoId !== undefined) {
    payload.video_id = body.videoId
    updatedFields.push('video_id')
  }
  if (body.imageIds && body.imageIds.length > 0) {
    payload.image_ids = body.imageIds
    updatedFields.push('image_ids')
  }
  if (body.landingPageUrl !== undefined) {
    payload.landing_page_url = body.landingPageUrl
    updatedFields.push('landing_page_url')
  }
  if (body.displayName !== undefined) {
    payload.display_name = body.displayName
    updatedFields.push('display_name')
  }

  if (updatedFields.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'no_changes', message: 'No fields to update' },
      { status: 400 }
    )
  }

  try {
    await tiktokApiRequest<Record<string, unknown>>(
      '/ad/update/',
      ctx,
      { body: payload }
    )

    return NextResponse.json(
      { ok: true, adId: aid, updatedFields },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[TikTok Ad Update] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: 'tiktok_api_error', message },
      { status: 502 }
    )
  }
}
