import { NextResponse } from 'next/server'
import { getGoogleAdsContext, GOOGLE_ADS_BASE, buildGoogleAdsHeaders } from '@/lib/googleAdsAuth'
import { normalizeError, parseGoogleAdsResponse } from '@/lib/google-ads/errors'

/**
 * POST /api/integrations/google-ads/campaigns/[campaignId]/status
 * Body: { enabled: boolean }
 * Sets campaign status to ENABLED or PAUSED via Google Ads API CampaignService.MutateCampaigns.
 */
export async function POST(
  request: Request,
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

  let body: { enabled?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'JSON body with enabled (boolean) required' },
      { status: 400 }
    )
  }

  const enabled = body.enabled === true
  const status = enabled ? 'ENABLED' : 'PAUSED'

  try {
    const ctx = await getGoogleAdsContext()

    const resourceName = `customers/${ctx.customerId}/campaigns/${cid}`
    const mutateUrl = `${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaigns:mutate`
    const headers = buildGoogleAdsHeaders(ctx)

    const mutateRes = await fetch(mutateUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operations: [
          {
            update: {
              resourceName,
              status,
            },
            updateMask: 'status',
          },
        ],
      }),
    })

    if (!mutateRes.ok) {
      const parsed = await parseGoogleAdsResponse(mutateRes, 'campaign_status_update_failed')
      return NextResponse.json(
        { error: parsed.error, message: parsed.message },
        { status: parsed.status }
      )
    }

    return NextResponse.json({
      ok: true,
      campaignId: cid,
      status,
      enabled,
    })
  } catch (e: unknown) {
    const { error, message, status: errStatus } = normalizeError(e, 'campaign_status_update_failed', 401)
    return NextResponse.json({ error, message }, { status: errStatus })
  }
}
