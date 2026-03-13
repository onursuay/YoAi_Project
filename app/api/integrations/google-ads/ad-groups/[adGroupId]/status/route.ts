import { NextResponse } from 'next/server'
import { getGoogleAdsContext, GOOGLE_ADS_BASE, buildGoogleAdsHeaders } from '@/lib/googleAdsAuth'
import { normalizeError, parseGoogleAdsResponse } from '@/lib/google-ads/errors'

/**
 * POST /api/integrations/google-ads/ad-groups/[adGroupId]/status
 * Body: { enabled: boolean }
 * Sets ad group status to ENABLED or PAUSED.
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
    const resourceName = `customers/${ctx.customerId}/adGroups/${id}`

    const mutateRes = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroups:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({
        operations: [{ update: { resourceName, status }, updateMask: 'status' }],
      }),
    })

    if (!mutateRes.ok) {
      const parsed = await parseGoogleAdsResponse(mutateRes, 'ad_group_status_update_failed')
      return NextResponse.json(
        { error: parsed.error, message: parsed.message },
        { status: parsed.status }
      )
    }

    return NextResponse.json({ ok: true, adGroupId: id, status, enabled })
  } catch (e: unknown) {
    const { error, message, status: errStatus } = normalizeError(e, 'ad_group_status_update_failed', 401)
    return NextResponse.json({ error, message }, { status: errStatus })
  }
}
