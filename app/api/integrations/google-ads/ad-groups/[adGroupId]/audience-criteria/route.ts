import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import { listAdGroupAudienceCriteria, addAdGroupAudienceCriteria, removeAdGroupAudienceCriteria } from '@/lib/google-ads/audience-criteria'
import { buildErrorResponse } from '@/lib/google-ads/errors'
import { translateAudienceName } from '@/lib/google-ads/audience-translations'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ adGroupId: string }> },
) {
  try {
    const { adGroupId } = await params
    const ctx = await getGoogleAdsContext()
    const criteria = await listAdGroupAudienceCriteria(ctx, adGroupId)
    // Translate display names to Turkish
    const cookieStore = await cookies()
    const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr'
    const translated = criteria.map(c => ({
      ...c,
      displayName: c.displayName === 'Bilinmeyen Segment' ? c.displayName : translateAudienceName(c.displayName, locale),
    }))
    return NextResponse.json({ criteria: translated }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'audience_criteria_list_failed', 'AdGroupAudienceCriteria')
    return NextResponse.json(body, { status })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ adGroupId: string }> },
) {
  try {
    await params
    const ctx = await getGoogleAdsContext()
    const { adGroupResourceName, segments, bidOnly } = await request.json()
    if (!adGroupResourceName || !segments?.length) {
      return NextResponse.json({ error: 'adGroupResourceName and segments required' }, { status: 400 })
    }
    await addAdGroupAudienceCriteria(ctx, adGroupResourceName, segments, !!bidOnly)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'audience_criteria_add_failed', 'AdGroupAudienceCriteriaAdd')
    return NextResponse.json(body, { status })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ adGroupId: string }> },
) {
  try {
    await params
    const ctx = await getGoogleAdsContext()
    const { resourceNames } = await request.json()
    if (!resourceNames?.length) {
      return NextResponse.json({ error: 'resourceNames required' }, { status: 400 })
    }
    await removeAdGroupAudienceCriteria(ctx, resourceNames)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'audience_criteria_remove_failed', 'AdGroupAudienceCriteriaRemove')
    return NextResponse.json(body, { status })
  }
}
