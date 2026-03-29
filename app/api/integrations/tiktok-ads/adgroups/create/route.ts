import { NextResponse } from 'next/server'
import { getTikTokContext, tiktokApiRequest } from '@/lib/tiktokAdsAuth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/integrations/tiktok-ads/adgroups/create
 * Create a new TikTok Ads ad group.
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
    campaignId?: string
    name?: string
    placementType?: string
    budget?: number
    budgetMode?: string
    scheduleType?: string
    scheduleStartTime?: string
    scheduleEndTime?: string
    optimizationGoal?: string
    bidType?: string
    bidPrice?: number
    billingEvent?: string
    location?: string[]
    gender?: string
    ageGroups?: string[]
    languages?: string[]
    operatingSystem?: string[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_body', message: 'JSON body required' },
      { status: 400 }
    )
  }

  if (!body.campaignId) {
    return NextResponse.json(
      { ok: false, error: 'validation_error', message: 'Campaign ID is required' },
      { status: 400 }
    )
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json(
      { ok: false, error: 'validation_error', message: 'Ad group name is required' },
      { status: 400 }
    )
  }

  try {
    const payload: Record<string, unknown> = {
      advertiser_id: ctx.advertiserId,
      campaign_id: body.campaignId,
      adgroup_name: name,
      placement_type: body.placementType || 'PLACEMENT_TYPE_AUTOMATIC',
      budget_mode: body.budgetMode || 'BUDGET_MODE_DAY',
      optimization_goal: body.optimizationGoal || 'CLICK',
      bid_type: body.bidType || 'BID_TYPE_NO_BID',
      billing_event: body.billingEvent || 'CPC',
      operation_status: 'DISABLE', // Start paused
    }

    if (body.budget !== undefined && Number.isFinite(body.budget) && body.budget > 0) {
      payload.budget = body.budget
    }

    if (body.bidPrice !== undefined && Number.isFinite(body.bidPrice) && body.bidPrice > 0) {
      payload.bid_price = body.bidPrice
    }

    // Schedule
    if (body.scheduleType) {
      payload.schedule_type = body.scheduleType
    }
    if (body.scheduleStartTime) {
      payload.schedule_start_time = body.scheduleStartTime
    }
    if (body.scheduleEndTime) {
      payload.schedule_end_time = body.scheduleEndTime
    }

    // Targeting
    if (body.location && body.location.length > 0) {
      payload.location_ids = body.location
    }
    if (body.gender) {
      payload.gender = body.gender
    }
    if (body.ageGroups && body.ageGroups.length > 0) {
      payload.age_groups = body.ageGroups
    }
    if (body.languages && body.languages.length > 0) {
      payload.languages = body.languages
    }
    if (body.operatingSystem && body.operatingSystem.length > 0) {
      payload.operating_systems = body.operatingSystem
    }

    const result = await tiktokApiRequest<{ adgroup_id: string }>(
      '/adgroup/create/',
      ctx,
      { body: payload }
    )

    return NextResponse.json(
      { ok: true, adGroupId: result.adgroup_id },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[TikTok AdGroup Create] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: 'tiktok_api_error', message },
      { status: 502 }
    )
  }
}
