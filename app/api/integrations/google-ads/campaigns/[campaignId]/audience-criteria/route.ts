import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import { listCampaignAudienceCriteria, addCampaignAudienceCriteria, removeCampaignAudienceCriteria } from '@/lib/google-ads/audience-criteria'
import { buildErrorResponse } from '@/lib/google-ads/errors'
import { translateAudienceName } from '@/lib/google-ads/audience-translations'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params
    const ctx = await getGoogleAdsContext()
    const criteria = await listCampaignAudienceCriteria(ctx, campaignId)
    // Translate display names to Turkish
    const cookieStore = await cookies()
    const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr'
    const translated = criteria.map(c => ({
      ...c,
      displayName: c.displayName === 'Bilinmeyen Segment' ? c.displayName : translateAudienceName(c.displayName, locale),
    }))
    return NextResponse.json({ criteria: translated }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'audience_criteria_list_failed', 'CampaignAudienceCriteria')
    return NextResponse.json(body, { status })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    await params
    const ctx = await getGoogleAdsContext()
    const { campaignResourceName, segments, bidOnly } = await request.json()
    if (!campaignResourceName || !segments?.length) {
      return NextResponse.json({ error: 'campaignResourceName and segments required' }, { status: 400 })
    }
    await addCampaignAudienceCriteria(ctx, campaignResourceName, segments, !!bidOnly)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'audience_criteria_add_failed', 'CampaignAudienceCriteriaAdd')
    return NextResponse.json(body, { status })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    await params
    const ctx = await getGoogleAdsContext()
    const { resourceNames } = await request.json()
    if (!resourceNames?.length) {
      return NextResponse.json({ error: 'resourceNames required' }, { status: 400 })
    }
    await removeCampaignAudienceCriteria(ctx, resourceNames)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'audience_criteria_remove_failed', 'CampaignAudienceCriteriaRemove')
    return NextResponse.json(body, { status })
  }
}
