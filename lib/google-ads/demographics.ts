import { searchGAds, buildGoogleAdsHeaders, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'
import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'

export type DemographicType = 'GENDER' | 'AGE_RANGE' | 'INCOME_RANGE'

export interface DemographicCriterion {
  resourceName: string
  criterionId: string
  type: DemographicType
  value: string
  status: 'ENABLED' | 'REMOVED'
  bidModifier: number | null
  negative: boolean
}

/* ── READ ── */

export async function listCampaignDemographics(ctx: Ctx, campaignId: string): Promise<DemographicCriterion[]> {
  const query = `
    SELECT
      campaign.id,
      campaign_criterion.resource_name,
      campaign_criterion.criterion_id,
      campaign_criterion.type,
      campaign_criterion.gender.type,
      campaign_criterion.age_range.type,
      campaign_criterion.income_range.type,
      campaign_criterion.status,
      campaign_criterion.bid_modifier,
      campaign_criterion.negative
    FROM campaign_criterion
    WHERE campaign.id = ${campaignId}
      AND campaign_criterion.type IN ('GENDER', 'AGE_RANGE', 'INCOME_RANGE')
      AND campaign_criterion.status != 'REMOVED'
  `
  const rows = await searchGAds<any>(ctx, query)
  return rows.map(r => mapCampaignDemographic(r))
}

export async function listAdGroupDemographics(ctx: Ctx, adGroupId: string): Promise<DemographicCriterion[]> {
  const query = `
    SELECT
      ad_group.id,
      ad_group_criterion.resource_name,
      ad_group_criterion.criterion_id,
      ad_group_criterion.type,
      ad_group_criterion.gender.type,
      ad_group_criterion.age_range.type,
      ad_group_criterion.income_range.type,
      ad_group_criterion.status,
      ad_group_criterion.bid_modifier,
      ad_group_criterion.negative
    FROM ad_group_criterion
    WHERE ad_group.id = ${adGroupId}
      AND ad_group_criterion.type IN ('GENDER', 'AGE_RANGE', 'INCOME_RANGE')
      AND ad_group_criterion.status != 'REMOVED'
  `
  const rows = await searchGAds<any>(ctx, query)
  return rows.map(r => mapAdGroupDemographic(r))
}

function mapCampaignDemographic(r: any): DemographicCriterion {
  const c = r.campaignCriterion ?? r.campaign_criterion ?? {}
  return extractDemographic(c)
}

function mapAdGroupDemographic(r: any): DemographicCriterion {
  const c = r.adGroupCriterion ?? r.ad_group_criterion ?? {}
  return extractDemographic(c)
}

function extractDemographic(c: any): DemographicCriterion {
  const type: DemographicType = c.type ?? ''
  let value = ''
  if (type === 'GENDER') {
    const g = c.gender ?? {}
    value = g.type ?? ''
  } else if (type === 'AGE_RANGE') {
    const a = c.ageRange ?? c.age_range ?? {}
    value = a.type ?? ''
  } else if (type === 'INCOME_RANGE') {
    const i = c.incomeRange ?? c.income_range ?? {}
    value = i.type ?? ''
  }
  return {
    resourceName: c.resourceName ?? c.resource_name ?? '',
    criterionId: String(c.criterionId ?? c.criterion_id ?? ''),
    type,
    value,
    status: c.status ?? 'ENABLED',
    bidModifier: c.bidModifier ?? c.bid_modifier ?? null,
    negative: c.negative ?? false,
  }
}

/* ── WRITE ── */

export interface DemographicUpdate {
  resourceName: string
  status?: 'ENABLED' | 'REMOVED'
  bidModifier?: number
}

export async function updateCampaignDemographics(ctx: Ctx, updates: DemographicUpdate[]): Promise<void> {
  if (!updates.length) return
  const operations = updates.map(u => {
    const fields: Record<string, any> = { resourceName: u.resourceName }
    const mask: string[] = []
    if (u.status !== undefined) { fields.status = u.status; mask.push('status') }
    if (u.bidModifier !== undefined) { fields.bidModifier = u.bidModifier; mask.push('bid_modifier') }
    return { update: fields, updateMask: mask.join(',') }
  })
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'updateCampaignDemographics failed') }
}

export async function updateAdGroupDemographics(ctx: Ctx, updates: DemographicUpdate[]): Promise<void> {
  if (!updates.length) return
  const operations = updates.map(u => {
    const fields: Record<string, any> = { resourceName: u.resourceName }
    const mask: string[] = []
    if (u.status !== undefined) { fields.status = u.status; mask.push('status') }
    if (u.bidModifier !== undefined) { fields.bidModifier = u.bidModifier; mask.push('bid_modifier') }
    return { update: fields, updateMask: mask.join(',') }
  })
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroupCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'updateAdGroupDemographics failed') }
}

/* ── CREATE ── */

export interface DemographicCreate {
  type: DemographicType
  value: string
  negative?: boolean
  bidModifier?: number
}

function buildDemographicField(type: DemographicType, value: string): Record<string, any> {
  if (type === 'GENDER') return { gender: { type: value } }
  if (type === 'AGE_RANGE') return { ageRange: { type: value } }
  if (type === 'INCOME_RANGE') return { incomeRange: { type: value } }
  return {}
}

export async function addCampaignDemographics(ctx: Ctx, campaignId: string, creates: DemographicCreate[]): Promise<void> {
  if (!creates.length) return
  const campaignRn = `customers/${ctx.customerId}/campaigns/${campaignId}`
  const operations = creates.map(c => ({
    create: {
      campaign: campaignRn,
      ...buildDemographicField(c.type, c.value),
      ...(c.negative ? { negative: true } : {}),
      ...(c.bidModifier !== undefined ? { bidModifier: c.bidModifier } : {}),
    },
  }))
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'addCampaignDemographics failed') }
}

export async function addAdGroupDemographics(ctx: Ctx, adGroupId: string, creates: DemographicCreate[]): Promise<void> {
  if (!creates.length) return
  const adGroupRn = `customers/${ctx.customerId}/adGroups/${adGroupId}`
  const operations = creates.map(c => ({
    create: {
      adGroup: adGroupRn,
      ...buildDemographicField(c.type, c.value),
      ...(c.negative ? { negative: true } : {}),
      ...(c.bidModifier !== undefined ? { bidModifier: c.bidModifier } : {}),
    },
  }))
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroupCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'addAdGroupDemographics failed') }
}
