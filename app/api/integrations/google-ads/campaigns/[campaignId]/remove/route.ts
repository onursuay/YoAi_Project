import { NextResponse } from 'next/server'
import { getGoogleAdsContext, GOOGLE_ADS_BASE, buildGoogleAdsHeaders } from '@/lib/googleAdsAuth'
import { normalizeError, parseGoogleAdsResponse } from '@/lib/google-ads/errors'

/**
 * POST /api/integrations/google-ads/campaigns/[campaignId]/remove
 * Sets campaign status to REMOVED (soft delete).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params
  const cid = String(campaignId || '').replace(/-/g, '').trim()
  if (!cid) {
    return NextResponse.json(
      { error: 'invalid_campaign_id', message: 'campaignId is required' },
      { status: 400 }
    )
  }

  try {
    const ctx = await getGoogleAdsContext()
    const resourceName = `customers/${ctx.customerId}/campaigns/${cid}`

    const mutateRes = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaigns:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({
        operations: [{ update: { resourceName, status: 'REMOVED' }, updateMask: 'status' }],
      }),
    })

    if (!mutateRes.ok) {
      const parsed = await parseGoogleAdsResponse(mutateRes, 'campaign_remove_failed')
      return NextResponse.json(
        { error: parsed.error, message: parsed.message },
        { status: parsed.status }
      )
    }

    return NextResponse.json({ ok: true, campaignId: cid })
  } catch (e: unknown) {
    const { error, message, status: errStatus } = normalizeError(e, 'campaign_remove_failed', 401)
    return NextResponse.json({ error, message }, { status: errStatus })
  }
}
