import { NextResponse } from 'next/server'
import { getGoogleAdsContext, GOOGLE_ADS_BASE, buildGoogleAdsHeaders } from '@/lib/googleAdsAuth'
import { normalizeError, parseGoogleAdsResponse } from '@/lib/google-ads/errors'

/**
 * POST /api/integrations/google-ads/ads/[adId]/status
 * Body: { enabled: boolean, adGroupId: string }
 * Sets ad (ad_group_ad) status to ENABLED or PAUSED.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ adId: string }> }
) {
  const { adId } = await params
  const id = String(adId || '').replace(/-/g, '').trim()
  if (!id) {
    return NextResponse.json(
      { error: 'invalid_ad_id', message: 'adId is required' },
      { status: 400 }
    )
  }

  let body: { enabled?: boolean; adGroupId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'JSON body with enabled (boolean) and adGroupId (string) required' },
      { status: 400 }
    )
  }

  const adGroupId = String(body.adGroupId || '').trim()
  if (!adGroupId) {
    return NextResponse.json(
      { error: 'missing_ad_group_id', message: 'adGroupId is required' },
      { status: 400 }
    )
  }

  const enabled = body.enabled === true
  const status = enabled ? 'ENABLED' : 'PAUSED'

  try {
    const ctx = await getGoogleAdsContext()
    const resourceName = `customers/${ctx.customerId}/adGroupAds/${adGroupId}~${id}`

    const mutateRes = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroupAds:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({
        operations: [{ update: { resourceName, status }, updateMask: 'status' }],
      }),
    })

    if (!mutateRes.ok) {
      const parsed = await parseGoogleAdsResponse(mutateRes, 'ad_status_update_failed')
      return NextResponse.json(
        { error: parsed.error, message: parsed.message },
        { status: parsed.status }
      )
    }

    return NextResponse.json({ ok: true, adId: id, adGroupId, status, enabled })
  } catch (e: unknown) {
    const { error, message, status: errStatus } = normalizeError(e, 'ad_status_update_failed', 401)
    return NextResponse.json({ error, message }, { status: errStatus })
  }
}
