import { NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds, GOOGLE_ADS_BASE, buildGoogleAdsHeaders } from '@/lib/googleAdsAuth'

/**
 * POST /api/integrations/google-ads/campaigns/[campaignId]/negative-keywords
 * Add campaign-level negative keywords
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params
  let ctx
  try { ctx = await getGoogleAdsContext() } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { campaignResourceName, keywords } = body

  if (!campaignResourceName || !keywords?.length) {
    return NextResponse.json({ error: 'campaignResourceName and keywords required' }, { status: 400 })
  }

  const operations = keywords.map((kw: { text: string; matchType: string }) => ({
    create: {
      campaign: campaignResourceName,
      negative: true,
      keyword: { text: kw.text, matchType: kw.matchType },
    },
  }))

  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations }),
  })

  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    return NextResponse.json(
      { error: e?.error?.message ?? 'Failed to add negative keywords' },
      { status: 400 }
    )
  }

  return NextResponse.json({ ok: true, campaignId })
}

/**
 * DELETE /api/integrations/google-ads/campaigns/[campaignId]/negative-keywords
 * Remove a campaign-level negative keyword
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params
  let ctx
  try { ctx = await getGoogleAdsContext() } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { resourceName } = body

  if (!resourceName) {
    return NextResponse.json({ error: 'resourceName required' }, { status: 400 })
  }

  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations: [{ remove: resourceName }] }),
  })

  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    return NextResponse.json(
      { error: e?.error?.message ?? 'Failed to remove negative keyword' },
      { status: 400 }
    )
  }

  return NextResponse.json({ ok: true, campaignId })
}
