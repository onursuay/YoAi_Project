import { NextResponse } from 'next/server'
import { getGoogleAdsContext, GOOGLE_ADS_BASE, buildGoogleAdsHeaders } from '@/lib/googleAdsAuth'
import { normalizeError, parseGoogleAdsResponse } from '@/lib/google-ads/errors'

/**
 * POST /api/integrations/google-ads/ad-groups/[adGroupId]/remove
 * Sets ad group status to REMOVED (soft delete).
 */
export async function POST(
  _request: Request,
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

  try {
    const ctx = await getGoogleAdsContext()
    const resourceName = `customers/${ctx.customerId}/adGroups/${id}`

    const mutateRes = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroups:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({
        operations: [{ update: { resourceName, status: 'REMOVED' }, updateMask: 'status' }],
      }),
    })

    if (!mutateRes.ok) {
      const parsed = await parseGoogleAdsResponse(mutateRes, 'ad_group_remove_failed')
      return NextResponse.json(
        { error: parsed.error, message: parsed.message },
        { status: parsed.status }
      )
    }

    return NextResponse.json({ ok: true, adGroupId: id })
  } catch (e: unknown) {
    const { error, message, status: errStatus } = normalizeError(e, 'ad_group_remove_failed', 401)
    return NextResponse.json({ error, message }, { status: errStatus })
  }
}
