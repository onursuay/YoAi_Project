import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import { searchGeoTargets } from '@/lib/google-ads/locations'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') ?? ''
    const countryCode = searchParams.get('country') || ''
    const locale = searchParams.get('locale') ?? 'tr'
    if (q.length < 2) return NextResponse.json({ results: [] })
    const results = await searchGeoTargets(ctx, q, locale, countryCode || undefined)
    return NextResponse.json({ results })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }) }
}
