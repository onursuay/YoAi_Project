import { NextResponse } from 'next/server'
import { getGoogleAdsContext, GOOGLE_ADS_BASE, buildGoogleAdsHeaders } from '@/lib/googleAdsAuth'
import { normalizeError, parseGoogleAdsResponse } from '@/lib/google-ads/errors'

/**
 * POST /api/integrations/google-ads/ads/[adId]/update
 * Body: { adGroupId, headlines?, descriptions?, finalUrls?, path1?, path2? }
 * Updates RSA ad creative fields.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ adId: string }> }
) {
  const { adId } = await params
  const id = String(adId || '').replace(/-/g, '').trim()
  if (!id) {
    return NextResponse.json({ error: 'invalid_ad_id', message: 'adId is required' }, { status: 400 })
  }

  let body: {
    adGroupId?: string
    headlines?: { text: string; pinnedField?: string | null }[]
    descriptions?: { text: string; pinnedField?: string | null }[]
    finalUrls?: string[]
    path1?: string
    path2?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body', message: 'JSON body required' }, { status: 400 })
  }

  const adGroupId = String(body.adGroupId || '').trim()
  if (!adGroupId) {
    return NextResponse.json({ error: 'missing_ad_group_id', message: 'adGroupId is required' }, { status: 400 })
  }

  // Build update mask and ad object
  const updateFields: string[] = []
  const adUpdate: any = {}
  const rsaUpdate: any = {}

  if (body.headlines && body.headlines.length > 0) {
    rsaUpdate.headlines = body.headlines.map((h) => {
      const entry: any = { text: h.text }
      if (h.pinnedField) entry.pinnedField = h.pinnedField
      return entry
    })
    updateFields.push('ad.responsive_search_ad.headlines')
  }

  if (body.descriptions && body.descriptions.length > 0) {
    rsaUpdate.descriptions = body.descriptions.map((d) => {
      const entry: any = { text: d.text }
      if (d.pinnedField) entry.pinnedField = d.pinnedField
      return entry
    })
    updateFields.push('ad.responsive_search_ad.descriptions')
  }

  if (body.finalUrls && body.finalUrls.length > 0) {
    adUpdate.finalUrls = body.finalUrls
    updateFields.push('ad.final_urls')
  }

  if (body.path1 !== undefined) {
    rsaUpdate.path1 = body.path1
    updateFields.push('ad.responsive_search_ad.path1')
  }

  if (body.path2 !== undefined) {
    rsaUpdate.path2 = body.path2
    updateFields.push('ad.responsive_search_ad.path2')
  }

  if (updateFields.length === 0) {
    return NextResponse.json({ error: 'no_changes', message: 'No fields to update' }, { status: 400 })
  }

  if (Object.keys(rsaUpdate).length > 0) {
    adUpdate.responsiveSearchAd = rsaUpdate
  }

  try {
    const ctx = await getGoogleAdsContext()
    const resourceName = `customers/${ctx.customerId}/adGroupAds/${adGroupId}~${id}`

    const mutateRes = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroupAds:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({
        operations: [{
          update: {
            resourceName,
            ad: { resourceName: `customers/${ctx.customerId}/ads/${id}`, ...adUpdate },
          },
          updateMask: updateFields.join(','),
        }],
      }),
    })

    if (!mutateRes.ok) {
      const parsed = await parseGoogleAdsResponse(mutateRes, 'ad_update_failed')
      return NextResponse.json({ error: parsed.error, message: parsed.message }, { status: parsed.status })
    }

    return NextResponse.json({ ok: true, adId: id, adGroupId, updatedFields: updateFields })
  } catch (e: unknown) {
    const { error, message, status: errStatus } = normalizeError(e, 'ad_update_failed', 500)
    return NextResponse.json({ error, message }, { status: errStatus })
  }
}
