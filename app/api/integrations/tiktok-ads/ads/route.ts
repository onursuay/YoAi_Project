import { NextResponse } from 'next/server'
import { getTikTokContext, tiktokApiRequest } from '@/lib/tiktokAdsAuth'

export const dynamic = 'force-dynamic'

interface TikTokAd {
  ad_id: string
  ad_name: string
  adgroup_id: string
  campaign_id: string
  operation_status: string
  ad_text: string
  call_to_action: string
  image_ids: string[]
  video_id: string
  landing_page_url: string
  display_name: string
}

/**
 * GET /api/integrations/tiktok-ads/ads?adGroupId=xxx
 * List ads for an ad group (or all ads for the advertiser).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const adGroupId = url.searchParams.get('adGroupId')
  const campaignId = url.searchParams.get('campaignId')

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
    const filtering: Record<string, unknown> = {}
    if (adGroupId) {
      filtering.adgroup_ids = [adGroupId]
    }
    if (campaignId) {
      filtering.campaign_ids = [campaignId]
    }

    const data = await tiktokApiRequest<{ list: TikTokAd[]; page_info?: { total_number: number } }>(
      '/ad/get/',
      ctx,
      {
        params: {
          advertiser_id: ctx.advertiserId,
          filtering: JSON.stringify(filtering),
          page_size: '200',
        },
      }
    )

    const ads = (data?.list || []).map((ad) => ({
      adId: ad.ad_id,
      adName: ad.ad_name,
      adGroupId: ad.adgroup_id,
      campaignId: ad.campaign_id,
      status: ad.operation_status,
      adText: ad.ad_text,
      callToAction: ad.call_to_action,
      imageIds: ad.image_ids || [],
      videoId: ad.video_id,
      landingPageUrl: ad.landing_page_url,
      displayName: ad.display_name,
    }))

    return NextResponse.json(
      { ok: true, ads },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[TikTok Ads] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: 'tiktok_api_error', message },
      { status: 500 }
    )
  }
}
