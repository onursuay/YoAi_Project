import { NextResponse } from 'next/server'
import { getTikTokContext, tiktokApiRequest } from '@/lib/tiktokAdsAuth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/integrations/tiktok-ads/campaigns/[campaignId]/update
 * Update an existing TikTok Ads campaign.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params
  const cid = String(campaignId || '').trim()

  if (!cid) {
    return NextResponse.json(
      { ok: false, error: 'invalid_id', message: 'Campaign ID is required' },
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
    objective?: string
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
    campaign_id: cid,
  }

  if (body.name !== undefined && body.name.trim() !== '') {
    payload.campaign_name = body.name.trim()
    updatedFields.push('campaign_name')
  }

  if (body.budget !== undefined && Number.isFinite(body.budget) && body.budget >= 0) {
    payload.budget = body.budget
    updatedFields.push('budget')
  }

  if (body.budgetMode !== undefined) {
    payload.budget_mode = body.budgetMode
    updatedFields.push('budget_mode')
  }

  if (updatedFields.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'no_changes', message: 'No fields to update' },
      { status: 400 }
    )
  }

  try {
    await tiktokApiRequest<Record<string, unknown>>(
      '/campaign/update/',
      ctx,
      { body: payload }
    )

    return NextResponse.json(
      { ok: true, campaignId: cid, updatedFields },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[TikTok Campaign Update] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: 'tiktok_api_error', message },
      { status: 502 }
    )
  }
}
