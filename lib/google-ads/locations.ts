import { buildGoogleAdsHeaders, searchGAds, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'
import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'

export interface LocationTarget {
  resourceName: string
  criterionId: string
  locationName: string
  isNegative: boolean
  bidModifier?: number
}

export async function listCampaignLocations(ctx: Ctx, campaignId: string): Promise<LocationTarget[]> {
  const query = `
    SELECT
      campaign_criterion.resource_name,
      campaign_criterion.criterion_id,
      campaign_criterion.bid_modifier,
      campaign_criterion.negative,
      campaign_criterion.location.geo_target_constant,
      geo_target_constant.name,
      geo_target_constant.canonical_name
    FROM campaign_criterion
    WHERE
      campaign_criterion.type = 'LOCATION'
      AND campaign.id = ${campaignId}
  `
  const response = await searchGAds<any>(ctx, query)
  return response.map((row: any) => ({
    resourceName: row.campaignCriterion.resourceName,
    criterionId: String(row.campaignCriterion.criterionId),
    bidModifier: row.campaignCriterion.bidModifier,
    isNegative: row.campaignCriterion.negative,
    locationName: row.geoTargetConstant?.canonicalName
      ?? row.geoTargetConstant?.name
      ?? row.geo_target_constant?.canonical_name
      ?? row.geo_target_constant?.name
      ?? '',
  }))
}

export async function searchGeoTargets(
  ctx: Ctx,
  searchText: string,
  locale = 'tr',
  countryCode?: string
): Promise<Array<{ id: string; name: string; countryCode: string; targetType: string }>> {
  const body: Record<string, string> = { locale, searchTerm: searchText }
  if (countryCode) body.countryCode = countryCode
  const res = await fetch(`${GOOGLE_ADS_BASE}/geoTargetConstants:suggest`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify(body),
  })
  if (!res.ok) { const err = await res.json(); throw new Error(err?.error?.message ?? 'searchGeoTargets failed') }
  const data = await res.json()
  return (data.geoTargetConstantSuggestions ?? []).map((s: any) => ({
    id: s.geoTargetConstant.id,
    name: s.geoTargetConstant.canonicalName ?? s.geoTargetConstant.name,
    countryCode: s.geoTargetConstant.countryCode,
    targetType: s.geoTargetConstant.targetType,
  }))
}

export async function addCampaignLocation(
  ctx: Ctx,
  campaignResourceName: string,
  geoTargetConstantId: string,
  isNegative = false,
  bidModifier?: number
): Promise<void> {
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({
      operations: [{
        create: {
          campaign: campaignResourceName,
          negative: isNegative,
          ...(bidModifier && { bidModifier }),
          location: { geoTargetConstant: `geoTargetConstants/${geoTargetConstantId}` },
        },
      }],
    }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'addCampaignLocation failed') }
}

export async function removeCampaignLocation(ctx: Ctx, resourceName: string): Promise<void> {
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations: [{ remove: resourceName }] }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'removeCampaignLocation failed') }
}
