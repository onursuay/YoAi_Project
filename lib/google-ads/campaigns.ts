import { searchGAds, GOOGLE_ADS_BASE, buildGoogleAdsHeaders } from '@/lib/googleAdsAuth'
import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'
import type { Campaign } from './types'

export async function listCampaigns(ctx: Ctx): Promise<Campaign[]> {
  const query = `
    SELECT
      campaign.id,
      campaign.resource_name,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.campaign_budget,
      campaign.bidding_strategy_type,
      campaign.start_date,
      campaign.end_date,
      campaign_budget.amount_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE
      campaign.status != 'REMOVED'
      AND segments.date DURING LAST_30_DAYS
    ORDER BY metrics.impressions DESC
  `
  const rows = await searchGAds<any>(ctx, query)
  return rows.map((row: any) => {
    const costMicros = Number(row.metrics?.costMicros ?? 0)
    const convValue = Number(row.metrics?.conversionsValue ?? 0)
    return {
      id: String(row.campaign.id),
      resourceName: row.campaign.resourceName,
      name: row.campaign.name,
      status: row.campaign.status,
      objective: row.campaign.advertisingChannelType,
      campaignBudgetResourceName: row.campaign.campaignBudget,
      dailyBudgetMicros: Number(row.campaignBudget?.amountMicros ?? 0),
      biddingStrategy: row.campaign.biddingStrategyType,
      startDateTime: row.campaign.startDate,
      endDateTime: row.campaign.endDate,
      impressions: Number(row.metrics?.impressions ?? 0),
      clicks: Number(row.metrics?.clicks ?? 0),
      ctr: Number(row.metrics?.ctr ?? 0),
      averageCpc: Number(row.metrics?.averageCpc ?? 0) / 1_000_000,
      cost: costMicros / 1_000_000,
      conversions: Number(row.metrics?.conversions ?? 0),
      roas: costMicros > 0 ? convValue / (costMicros / 1_000_000) : 0,
    }
  })
}

export async function updateCampaignStatus(
  ctx: Ctx,
  resourceName: string,
  status: 'ENABLED' | 'PAUSED'
): Promise<void> {
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaigns:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({
      operations: [{ update: { resourceName, status }, updateMask: 'status' }],
    }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'updateCampaignStatus failed') }
}

export async function updateCampaignBudget(
  ctx: Ctx,
  budgetResourceName: string,
  amountMicros: number
): Promise<void> {
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignBudgets:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({
      operations: [{ update: { resourceName: budgetResourceName, amountMicros }, updateMask: 'amount_micros' }],
    }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'updateCampaignBudget failed') }
}
