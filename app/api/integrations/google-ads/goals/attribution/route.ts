import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import { listConversionAttribution, updateAttributionModel } from '@/lib/google-ads/attribution'

export async function GET() {
  try {
    const ctx = await getGoogleAdsContext()
    const attributions = await listConversionAttribution(ctx)
    return NextResponse.json({ attributions }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }) }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const { resourceName, attributionModel, clickThroughLookbackWindowDays } = await req.json()
    await updateAttributionModel(ctx, resourceName, attributionModel, clickThroughLookbackWindowDays)
    return NextResponse.json({ success: true })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }) }
}
