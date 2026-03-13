import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import { getSearchTermsReport, excludeSearchTerm } from '@/lib/google-ads/reports'

export async function POST(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const { campaignId, adGroupId, dateRange } = await req.json()
    if (!dateRange?.startDate || !dateRange?.endDate) {
      return NextResponse.json({ error: 'dateRange.startDate ve endDate zorunlu' }, { status: 400 })
    }
    const searchTerms = await getSearchTermsReport(ctx, { campaignId, adGroupId, dateRange })
    return NextResponse.json({ searchTerms }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const { campaignResourceName, searchTerm, matchType } = await req.json()
    if (!campaignResourceName || !searchTerm) {
      return NextResponse.json({ error: 'campaignResourceName ve searchTerm zorunlu' }, { status: 400 })
    }
    await excludeSearchTerm(ctx, campaignResourceName, searchTerm, matchType)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
