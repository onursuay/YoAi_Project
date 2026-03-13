import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import { listCampaignLocations, addCampaignLocation, removeCampaignLocation } from '@/lib/google-ads/locations'

export async function GET(_req: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const ctx = await getGoogleAdsContext()
    const locations = await listCampaignLocations(ctx, params.campaignId)
    return NextResponse.json({ locations }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const { campaignResourceName, geoTargetConstantId, isNegative, bidModifier } = await req.json()
    await addCampaignLocation(ctx, campaignResourceName, geoTargetConstantId, isNegative, bidModifier)
    return NextResponse.json({ success: true })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }) }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const { resourceName } = await req.json()
    await removeCampaignLocation(ctx, resourceName)
    return NextResponse.json({ success: true })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }) }
}
