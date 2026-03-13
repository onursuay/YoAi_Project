import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import { listUserLists, createRemarketingList } from '@/lib/google-ads/audience-manager'

export async function GET() {
  try {
    const ctx = await getGoogleAdsContext()
    const userLists = await listUserLists(ctx)
    return NextResponse.json({ userLists }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const { name, description, membershipLifeSpanDays } = await req.json()
    const resourceName = await createRemarketingList(ctx, name, description, membershipLifeSpanDays)
    return NextResponse.json({ resourceName })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }) }
}
