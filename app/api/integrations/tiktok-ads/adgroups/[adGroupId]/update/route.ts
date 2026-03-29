import { NextResponse } from 'next/server'
import { getTikTokContext, tiktokApiRequest } from '@/lib/tiktokAdsAuth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/integrations/tiktok-ads/adgroups/[adGroupId]/update
 * Update an existing TikTok Ads ad group.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ adGroupId: string }> }
) {
  const { adGroupId } = await params
  const agid = String(adGroupId || '').trim()

  if (!agid) {
    return NextResponse.json(
      { ok: false, error: 'invalid_id', message: 'Ad group ID is required' },
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
    budget?: number
    budgetMode?: string
    bidPrice?: number
    scheduleStartTime?: string
    scheduleEndTime?: string
    optimizationGoal?: string
    location?: string[]
    gender?: string
    ageGroups?: string[]
    languages?: string[]
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
    adgroup_id: agid,
  }

  if (body.name !== undefined && body.name.trim() !== '') {
    payload.adgroup_name = body.name.trim()
    updatedFields.push('adgroup_name')
  }
  if (body.budget !== undefined && Number.isFinite(body.budget) && body.budget >= 0) {
    payload.budget = body.budget
    updatedFields.push('budget')
  }
  if (body.budgetMode !== undefined) {
    payload.budget_mode = body.budgetMode
    updatedFields.push('budget_mode')
  }
  if (body.bidPrice !== undefined && Number.isFinite(body.bidPrice) && body.bidPrice >= 0) {
    payload.bid_price = body.bidPrice
    updatedFields.push('bid_price')
  }
  if (body.scheduleStartTime !== undefined) {
    payload.schedule_start_time = body.scheduleStartTime
    updatedFields.push('schedule_start_time')
  }
  if (body.scheduleEndTime !== undefined) {
    payload.schedule_end_time = body.scheduleEndTime
    updatedFields.push('schedule_end_time')
  }
  if (body.optimizationGoal !== undefined) {
    payload.optimization_goal = body.optimizationGoal
    updatedFields.push('optimization_goal')
  }
  if (body.location && body.location.length > 0) {
    payload.location_ids = body.location
    updatedFields.push('location_ids')
  }
  if (body.gender !== undefined) {
    payload.gender = body.gender
    updatedFields.push('gender')
  }
  if (body.ageGroups && body.ageGroups.length > 0) {
    payload.age_groups = body.ageGroups
    updatedFields.push('age_groups')
  }
  if (body.languages && body.languages.length > 0) {
    payload.languages = body.languages
    updatedFields.push('languages')
  }

  if (updatedFields.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'no_changes', message: 'No fields to update' },
      { status: 400 }
    )
  }

  try {
    await tiktokApiRequest<Record<string, unknown>>(
      '/adgroup/update/',
      ctx,
      { body: payload }
    )

    return NextResponse.json(
      { ok: true, adGroupId: agid, updatedFields },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[TikTok AdGroup Update] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: 'tiktok_api_error', message },
      { status: 502 }
    )
  }
}
