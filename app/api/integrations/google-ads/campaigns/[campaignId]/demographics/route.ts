import { NextResponse } from 'next/server'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import { listCampaignDemographics, updateCampaignDemographics, addCampaignDemographics } from '@/lib/google-ads/demographics'
import { buildErrorResponse } from '@/lib/google-ads/errors'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params
    const ctx = await getGoogleAdsContext()
    const demographics = await listCampaignDemographics(ctx, campaignId)
    return NextResponse.json({ demographics }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'demographics_list_failed', 'CampaignDemographics')
    return NextResponse.json(body, { status })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params
    const ctx = await getGoogleAdsContext()
    const { creates } = await request.json()
    if (!creates?.length) {
      return NextResponse.json({ error: 'creates required' }, { status: 400 })
    }
    await addCampaignDemographics(ctx, campaignId, creates)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'demographics_create_failed', 'CampaignDemographicsCreate')
    return NextResponse.json(body, { status })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    await params
    const ctx = await getGoogleAdsContext()
    const { updates } = await request.json()
    if (!updates?.length) {
      return NextResponse.json({ error: 'updates required' }, { status: 400 })
    }
    await updateCampaignDemographics(ctx, updates)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'demographics_update_failed', 'CampaignDemographicsUpdate')
    return NextResponse.json(body, { status })
  }
}
