import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import { listAdSchedule, replaceAdSchedule } from '@/lib/google-ads/adschedule'

export async function GET(_req: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const ctx = await getGoogleAdsContext()
    const schedule = await listAdSchedule(ctx, params.campaignId)
    return NextResponse.json({ schedule }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }) }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const { campaignResourceName, existingResourceNames, newSchedule } = await req.json()
    await replaceAdSchedule(ctx, campaignResourceName, existingResourceNames, newSchedule)
    return NextResponse.json({ success: true })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }) }
}
