import { NextResponse } from 'next/server'
import { getGoogleAdsContext, GOOGLE_ADS_BASE, buildGoogleAdsHeaders } from '@/lib/googleAdsAuth'
import { normalizeError, parseGoogleAdsResponse } from '@/lib/google-ads/errors'
import { MICROS } from '@/lib/google-ads/constants'

/**
 * POST /api/integrations/google-ads/ad-groups/[adGroupId]/update
 * Body: { name?, cpcBid? }
 * Updates ad group name and/or CPC bid.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ adGroupId: string }> }
) {
  const { adGroupId } = await params
  const id = String(adGroupId || '').replace(/-/g, '').trim()
  if (!id) {
    return NextResponse.json({ error: 'invalid_id', message: 'adGroupId is required' }, { status: 400 })
  }

  let body: { name?: string; cpcBid?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body', message: 'JSON body required' }, { status: 400 })
  }

  const updateFields: string[] = []
  const update: any = { resourceName: `customers/{cid}/adGroups/${id}` }

  if (body.name !== undefined && body.name.trim() !== '') {
    update.name = body.name.trim()
    updateFields.push('name')
  }

  if (body.cpcBid !== undefined && Number.isFinite(body.cpcBid) && body.cpcBid >= 0) {
    update.cpcBidMicros = String(Math.round(body.cpcBid * MICROS))
    updateFields.push('cpc_bid_micros')
  }

  if (updateFields.length === 0) {
    return NextResponse.json({ error: 'no_changes', message: 'No fields to update' }, { status: 400 })
  }

  try {
    const ctx = await getGoogleAdsContext()
    update.resourceName = `customers/${ctx.customerId}/adGroups/${id}`

    const mutateRes = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroups:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({
        operations: [{ update, updateMask: updateFields.join(',') }],
      }),
    })

    if (!mutateRes.ok) {
      const parsed = await parseGoogleAdsResponse(mutateRes, 'ad_group_update_failed')
      return NextResponse.json({ error: parsed.error, message: parsed.message }, { status: parsed.status })
    }

    return NextResponse.json({ ok: true, adGroupId: id, updatedFields: updateFields })
  } catch (e: unknown) {
    const { error, message, status: errStatus } = normalizeError(e, 'ad_group_update_failed', 500)
    return NextResponse.json({ error, message }, { status: errStatus })
  }
}
