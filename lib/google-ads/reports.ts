import { buildGoogleAdsHeaders, searchGAds, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'
import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'

export interface SearchTerm {
  searchTerm: string
  matchType: string
  status: string
  adGroupName: string
  adGroupId: string
  adGroupResourceName: string
  impressions: number
  clicks: number
  ctr: number
  averageCpc: number
  cost: number
  conversions: number
  conversionRate: number
}

export async function getSearchTermsReport(
  ctx: Ctx,
  options: {
    campaignId?: string
    adGroupId?: string
    dateRange: { startDate: string; endDate: string }
  }
): Promise<SearchTerm[]> {
  const whereConditions = [
    `segments.date BETWEEN '${options.dateRange.startDate}' AND '${options.dateRange.endDate}'`,
    "campaign.status != 'REMOVED'",
  ]
  if (options.campaignId) whereConditions.push(`campaign.id = ${options.campaignId}`)
  if (options.adGroupId) whereConditions.push(`ad_group.id = ${options.adGroupId}`)

  const query = `
    SELECT
      search_term_view.search_term,
      search_term_view.status,
      ad_group.id,
      ad_group.name,
      ad_group.resource_name,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_from_interactions_rate
    FROM search_term_view
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY metrics.clicks DESC
    LIMIT 1000
  `
  const response = await searchGAds<any>(ctx, query)
  return response.map((row: any) => ({
    searchTerm: row.searchTermView.searchTerm,
    matchType: row.searchTermView?.status ?? 'UNKNOWN',
    status: row.searchTermView.status,
    adGroupName: row.adGroup.name,
    adGroupId: String(row.adGroup.id ?? ''),
    adGroupResourceName: row.adGroup.resourceName ?? '',
    impressions: Number(row.metrics?.impressions ?? 0),
    clicks: Number(row.metrics?.clicks ?? 0),
    ctr: Number(row.metrics?.ctr ?? 0),
    averageCpc: Number(row.metrics?.averageCpc ?? 0) / 1_000_000,
    cost: Number(row.metrics?.costMicros ?? 0) / 1_000_000,
    conversions: Number(row.metrics?.conversions ?? 0),
    conversionRate: Number(row.metrics?.conversionsFromInteractionsRate ?? 0),
  }))
}

export async function excludeSearchTerm(
  ctx: Ctx,
  campaignResourceName: string,
  searchTerm: string,
  matchType: 'EXACT' | 'PHRASE' | 'BROAD' = 'EXACT'
): Promise<void> {
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({
      operations: [{
        create: {
          campaign: campaignResourceName,
          negative: true,
          keyword: { text: searchTerm, matchType },
        },
      }],
    }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'excludeSearchTerm failed') }
}
