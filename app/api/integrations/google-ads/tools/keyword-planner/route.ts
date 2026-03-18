import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import { generateKeywordIdeas } from '@/lib/google-ads/keyword-planner'

const KEYWORD_PLANNER_ERRORS = {
  tr: { keywordsOrUrlsRequired: 'keywords veya urls zorunlu' },
  en: { keywordsOrUrlsRequired: 'keywords or urls required' },
} as const

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const locale = (cookieStore.get('NEXT_LOCALE')?.value ?? 'tr') === 'en' ? 'en' : 'tr'
  const msg = KEYWORD_PLANNER_ERRORS[locale]

  try {
    const ctx = await getGoogleAdsContext()
    const { keywords, urls, locationIds, languageId } = await req.json()
    if (!keywords?.length && !urls?.length) {
      return NextResponse.json({ error: msg.keywordsOrUrlsRequired }, { status: 400 })
    }
    const ideas = await generateKeywordIdeas(ctx, { keywords, urls, locationIds, languageId })
    return NextResponse.json({ ideas })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }) }
}
