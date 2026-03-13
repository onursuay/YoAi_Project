import { NextResponse } from 'next/server'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import { listAdGroupDemographics, updateAdGroupDemographics, addAdGroupDemographics } from '@/lib/google-ads/demographics'
import { buildErrorResponse } from '@/lib/google-ads/errors'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ adGroupId: string }> },
) {
  try {
    const { adGroupId } = await params
    const ctx = await getGoogleAdsContext()
    const demographics = await listAdGroupDemographics(ctx, adGroupId)
    return NextResponse.json({ demographics }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'demographics_list_failed', 'AdGroupDemographics')
    return NextResponse.json(body, { status })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ adGroupId: string }> },
) {
  try {
    const { adGroupId } = await params
    const ctx = await getGoogleAdsContext()
    const { creates } = await request.json()
    if (!creates?.length) {
      return NextResponse.json({ error: 'creates required' }, { status: 400 })
    }
    await addAdGroupDemographics(ctx, adGroupId, creates)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'demographics_create_failed', 'AdGroupDemographicsCreate')
    return NextResponse.json(body, { status })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ adGroupId: string }> },
) {
  try {
    await params
    const ctx = await getGoogleAdsContext()
    const { updates } = await request.json()
    if (!updates?.length) {
      return NextResponse.json({ error: 'updates required' }, { status: 400 })
    }
    await updateAdGroupDemographics(ctx, updates)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'demographics_update_failed', 'AdGroupDemographicsUpdate')
    return NextResponse.json(body, { status })
  }
}
