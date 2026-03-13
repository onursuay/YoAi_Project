import { buildGoogleAdsHeaders, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'
import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'

export interface KeywordIdea {
  text: string
  avgMonthlySearches: number
  competition: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNSPECIFIED'
  competitionIndex: number
  lowTopOfPageBidMicros: number
  highTopOfPageBidMicros: number
}

export async function generateKeywordIdeas(
  ctx: Ctx,
  options: {
    keywords?: string[]
    urls?: string[]
    locationIds?: string[]
    languageId?: string
    includeAdultKeywords?: boolean
  }
): Promise<KeywordIdea[]> {
  // Google Ads API has 3 seed types — use the correct one:
  //   keywordSeed       → keywords only
  //   urlSeed           → single URL only (field is "url", singular)
  //   keywordAndUrlSeed → keywords + url together
  const seed: Record<string, any> = {}
  const hasKeywords = options.keywords && options.keywords.length > 0
  const hasUrl = options.urls && options.urls.length > 0
  if (hasKeywords && hasUrl) {
    seed.keywordAndUrlSeed = { keywords: options.keywords, url: options.urls![0] }
  } else if (hasKeywords) {
    seed.keywordSeed = { keywords: options.keywords }
  } else if (hasUrl) {
    seed.urlSeed = { url: options.urls![0] }
  }

  const body = {
    customerId: ctx.customerId,
    language: `languageConstants/${options.languageId ?? '1037'}`,
    geoTargetConstants: (options.locationIds?.length ? options.locationIds : ['2792']).map(id => `geoTargetConstants/${id}`),
    includeAdultKeywords: options.includeAdultKeywords ?? false,
    keywordPlanNetwork: 'GOOGLE_SEARCH',
    ...seed,
  }

  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}:generateKeywordIdeas`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify(body),
  })
  if (!res.ok) { const err = await res.json(); throw new Error(err?.error?.message ?? 'generateKeywordIdeas failed') }
  const data = await res.json()
  return (data.results ?? []).map((idea: any) => ({
    text: idea.text,
    avgMonthlySearches: idea.keywordIdeaMetrics?.avgMonthlySearches ?? 0,
    competition: idea.keywordIdeaMetrics?.competition ?? 'UNSPECIFIED',
    competitionIndex: idea.keywordIdeaMetrics?.competitionIndex ?? 0,
    lowTopOfPageBidMicros: idea.keywordIdeaMetrics?.lowTopOfPageBidMicros ?? 0,
    highTopOfPageBidMicros: idea.keywordIdeaMetrics?.highTopOfPageBidMicros ?? 0,
  }))
}
