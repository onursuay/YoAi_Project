import { NextResponse } from 'next/server'
import { getGoogleAdsContext, GOOGLE_ADS_BASE, buildGoogleAdsHeaders } from '@/lib/googleAdsAuth'
import { normalizeError, parseGoogleAdsResponse } from '@/lib/google-ads/errors'
import { MICROS } from '@/lib/google-ads/constants'

/**
 * POST /api/integrations/google-ads/ad-groups/[adGroupId]/bid
 * Body: { cpcBid: number } (currency units, e.g. 2.50)
 * Updates ad group CPC bid via Google Ads API.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ adGroupId: string }> }
) {
  const { adGroupId } = await params
  const id = String(adGroupId || '').replace(/-/g, '').trim()
  if (!id) {
    return NextResponse.json(
      { error: 'invalid_ad_group_id', message: 'adGroupId is required' },
      { status: 400 }
    )
  }

  let body: { cpcBid?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'JSON body with cpcBid (number) required' },
      { status: 400 }
    )
  }

  const cpcBid = typeof body.cpcBid === 'number' ? body.cpcBid : parseFloat(String(body.cpcBid ?? ''))
  if (!Number.isFinite(cpcBid) || cpcBid < 0) {
    return NextResponse.json(
      { error: 'invalid_bid', message: 'cpcBid must be a non-negative number' },
      { status: 400 }
    )
  }

  const cpcBidMicros = String(Math.round(cpcBid * MICROS))

  try {
    const ctx = await getGoogleAdsContext()
    const resourceName = `customers/${ctx.customerId}/adGroups/${id}`

    const mutateRes = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroups:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({
        operations: [{ update: { resourceName, cpcBidMicros }, updateMask: 'cpc_bid_micros' }],
      }),
    })

    if (!mutateRes.ok) {
      const parsed = await parseGoogleAdsResponse(mutateRes, 'bid_update_failed')
      return NextResponse.json(
        { error: parsed.error, message: parsed.message },
        { status: parsed.status }
      )
    }

    return NextResponse.json({ ok: true, adGroupId: id, cpcBid, cpcBidMicros })
  } catch (e: unknown) {
    const { error, message, status: errStatus } = normalizeError(e, 'bid_update_failed', 401)
    return NextResponse.json({ error, message }, { status: errStatus })
  }
}
