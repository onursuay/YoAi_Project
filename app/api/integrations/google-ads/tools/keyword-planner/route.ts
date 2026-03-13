import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import { generateKeywordIdeas } from '@/lib/google-ads/keyword-planner'

export async function POST(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const { keywords, urls, locationIds, languageId } = await req.json()
    if (!keywords?.length && !urls?.length) {
      return NextResponse.json({ error: 'keywords veya urls zorunlu' }, { status: 400 })
    }
    const ideas = await generateKeywordIdeas(ctx, { keywords, urls, locationIds, languageId })
    return NextResponse.json({ ideas })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }) }
}
