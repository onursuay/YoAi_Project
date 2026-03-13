import { buildGoogleAdsHeaders, searchGAds, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'
import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'

export interface Keyword {
  resourceName: string
  id: string
  text: string
  matchType: 'EXACT' | 'PHRASE' | 'BROAD'
  status: 'ENABLED' | 'PAUSED' | 'REMOVED'
  cpcBidMicros?: number
  qualityScore?: number
  impressions: number
  clicks: number
  cost: number
  conversions: number
}

export async function listKeywords(ctx: Ctx, adGroupId: string): Promise<Keyword[]> {
  const query = `
    SELECT
      ad_group_criterion.resource_name,
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      ad_group_criterion.cpc_bid_micros,
      ad_group_criterion.quality_info.quality_score,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM ad_group_criterion
    WHERE
      ad_group_criterion.type = 'KEYWORD'
      AND ad_group_criterion.status != 'REMOVED'
      AND ad_group.id = ${adGroupId}
    ORDER BY metrics.impressions DESC
    LIMIT 1000
  `
  const results = await searchGAds<any>(ctx, query)
  return results.map((row: any) => ({
    resourceName: row.adGroupCriterion.resourceName,
    id: String(row.adGroupCriterion.criterionId),
    text: row.adGroupCriterion.keyword.text,
    matchType: row.adGroupCriterion.keyword.matchType,
    status: row.adGroupCriterion.status,
    cpcBidMicros: row.adGroupCriterion.cpcBidMicros,
    qualityScore: row.adGroupCriterion.qualityInfo?.qualityScore,
    impressions: Number(row.metrics?.impressions ?? 0),
    clicks: Number(row.metrics?.clicks ?? 0),
    cost: Number(row.metrics?.costMicros ?? 0) / 1_000_000,
    conversions: Number(row.metrics?.conversions ?? 0),
  }))
}

export async function addKeywords(
  ctx: Ctx,
  adGroupResourceName: string,
  keywords: Array<{ text: string; matchType: 'EXACT' | 'PHRASE' | 'BROAD'; cpcBidMicros?: number }>
): Promise<void> {
  const operations = keywords.map(kw => ({
    create: {
      adGroup: adGroupResourceName,
      status: 'ENABLED',
      keyword: { text: kw.text, matchType: kw.matchType },
      ...(kw.cpcBidMicros && { cpcBidMicros: kw.cpcBidMicros }),
    },
  }))
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroupCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'addKeywords failed') }
}

export async function addAdGroupNegativeKeywords(
  ctx: Ctx,
  adGroupResourceName: string,
  negativeKeywords: Array<{ text: string; matchType: 'EXACT' | 'PHRASE' | 'BROAD' }>
): Promise<void> {
  const operations = negativeKeywords.map(kw => ({
    create: {
      adGroup: adGroupResourceName,
      status: 'ENABLED',
      negative: true,
      keyword: { text: kw.text, matchType: kw.matchType },
    },
  }))
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroupCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'addAdGroupNegativeKeywords failed') }
}

export async function addCampaignNegativeKeywords(
  ctx: Ctx,
  campaignResourceName: string,
  negativeKeywords: Array<{ text: string; matchType: 'EXACT' | 'PHRASE' | 'BROAD' }>
): Promise<void> {
  const operations = negativeKeywords.map(kw => ({
    create: {
      campaign: campaignResourceName,
      negative: true,
      keyword: { text: kw.text, matchType: kw.matchType },
    },
  }))
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'addCampaignNegativeKeywords failed') }
}

export async function updateKeyword(
  ctx: Ctx,
  resourceName: string,
  updates: { status?: 'ENABLED' | 'PAUSED'; cpcBidMicros?: number }
): Promise<void> {
  const updateFields: string[] = []
  const criterion: Record<string, any> = { resourceName }
  if (updates.status !== undefined) { criterion.status = updates.status; updateFields.push('status') }
  if (updates.cpcBidMicros !== undefined) { criterion.cpcBidMicros = updates.cpcBidMicros; updateFields.push('cpc_bid_micros') }
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroupCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations: [{ update: criterion, updateMask: updateFields.join(',') }] }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'updateKeyword failed') }
}

export async function removeKeyword(ctx: Ctx, resourceName: string): Promise<void> {
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroupCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations: [{ remove: resourceName }] }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'removeKeyword failed') }
}
