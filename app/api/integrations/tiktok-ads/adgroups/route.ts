import { NextResponse } from 'next/server'
import { getTikTokContext, tiktokApiRequest } from '@/lib/tiktokAdsAuth'

export const dynamic = 'force-dynamic'

interface TikTokAdGroup {
  adgroup_id: string
  adgroup_name: string
  campaign_id: string
  operation_status: string
  budget: number
  budget_mode: string
  bid_type: string
  bid_price: number
  optimization_goal: string
  placement_type: string
  schedule_start_time: string
  schedule_end_time: string
}

/**
 * GET /api/integrations/tiktok-ads/adgroups?campaignId=xxx
 * List ad groups for a campaign.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
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
    if (campaignId) {
      filtering.campaign_ids = [campaignId]
    }

    const data = await tiktokApiRequest<{ list: TikTokAdGroup[]; page_info?: { total_number: number } }>(
      '/adgroup/get/',
      ctx,
      {
        params: {
          advertiser_id: ctx.advertiserId,
          filtering: JSON.stringify(filtering),
          page_size: '200',
        },
      }
    )

    const adGroups = (data?.list || []).map((ag) => ({
      adGroupId: ag.adgroup_id,
      adGroupName: ag.adgroup_name,
      campaignId: ag.campaign_id,
      status: ag.operation_status,
      budget: ag.budget || 0,
      budgetMode: ag.budget_mode,
      bidType: ag.bid_type,
      bidPrice: ag.bid_price || 0,
      optimizationGoal: ag.optimization_goal,
      placementType: ag.placement_type,
      scheduleStart: ag.schedule_start_time,
      scheduleEnd: ag.schedule_end_time,
    }))

    return NextResponse.json(
      { ok: true, adGroups },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[TikTok AdGroups] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: 'tiktok_api_error', message },
      { status: 500 }
    )
  }
}
