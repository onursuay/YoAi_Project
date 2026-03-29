import { NextResponse } from 'next/server'
import { getTikTokContext, tiktokApiRequest } from '@/lib/tiktokAdsAuth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/integrations/tiktok-ads/campaigns/create
 * Create a new TikTok Ads campaign.
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
    name?: string
    objective?: string
    budget?: number
    budgetMode?: string
    specialIndustries?: string[]
  }
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
      { ok: false, error: 'validation_error', message: 'Campaign name is required' },
      { status: 400 }
    )
  }

  const objective = body.objective || 'TRAFFIC'
  const budgetMode = body.budgetMode || 'BUDGET_MODE_DAY'

  if (body.budget !== undefined && (!Number.isFinite(body.budget) || body.budget < 0)) {
    return NextResponse.json(
      { ok: false, error: 'validation_error', message: 'Budget must be a positive number' },
      { status: 400 }
    )
  }

  try {
    const payload: Record<string, unknown> = {
      advertiser_id: ctx.advertiserId,
      campaign_name: name,
      objective_type: objective,
      budget_mode: budgetMode,
      operation_status: 'DISABLE', // Start paused
    }

    if (body.budget !== undefined && body.budget > 0) {
      payload.budget = body.budget
    }

    if (body.specialIndustries && body.specialIndustries.length > 0) {
      payload.special_industries = body.specialIndustries
    }

    const result = await tiktokApiRequest<{ campaign_id: string }>(
      '/campaign/create/',
      ctx,
      { body: payload }
    )

    return NextResponse.json(
      { ok: true, campaignId: result.campaign_id },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[TikTok Campaign Create] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: 'tiktok_api_error', message },
      { status: 502 }
    )
  }
}
