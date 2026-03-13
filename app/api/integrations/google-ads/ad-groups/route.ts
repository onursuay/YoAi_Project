import { NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { getDefaultDateRange, computeDerivedMetrics } from '@/lib/google-ads/helpers'
import { normalizeError } from '@/lib/google-ads/errors'

function buildAdGroupsQuery(from: string, to: string, showInactive: boolean): string {
  const statusFilter = showInactive ? '' : " AND ad_group.status = 'ENABLED'"
  return `
  SELECT
    ad_group.id,
    ad_group.name,
    ad_group.status,
    ad_group.cpc_bid_micros,
    campaign.id,
    campaign.name,
    metrics.cost_micros,
    metrics.impressions,
    metrics.clicks,
    metrics.ctr,
    metrics.average_cpc,
    metrics.conversions,
    metrics.conversions_value
  FROM ad_group
  WHERE segments.date BETWEEN '${from}' AND '${to}'${statusFilter}
  ORDER BY metrics.cost_micros DESC
  LIMIT 200
`.trim()
}

export interface GoogleAdGroupRow {
  publishEnabled: boolean
  status: string
  adGroupId: string
  adGroupName: string
  campaignId: string
  campaignName: string
  cpcBid: number | null
  amountSpent: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  roas: number | null
}

/**
 * GET /api/integrations/google-ads/ad-groups?from=&to=&showInactive=0|1
 */
export async function GET(request: Request) {
  try {
    const ctx = await getGoogleAdsContext()

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const showInactive = searchParams.get('showInactive') === '1' || searchParams.get('showInactive') === 'true'
    const { from, to } =
      fromParam && toParam
        ? { from: fromParam, to: toParam }
        : getDefaultDateRange()
    const query = buildAdGroupsQuery(from, to, showInactive)

    type Row = {
      adGroup?: { id?: string; name?: string; status?: string; cpcBidMicros?: string; cpc_bid_micros?: string }
      ad_group?: { id?: string; name?: string; status?: string; cpcBidMicros?: string; cpc_bid_micros?: string }
      campaign?: { id?: string; name?: string }
      metrics?: {
        cost_micros?: string | number
        costMicros?: string | number
        impressions?: string | number
        clicks?: string | number
        ctr?: number
        average_cpc?: string | number
        averageCpc?: string | number
        conversions?: string | number
        conversions_value?: string | number
        conversionsValue?: string | number
      }
    }

    const rows = await searchGAds<Row>(ctx, query)

    const byId = new Map<
      string,
      {
        id: string
        name: string
        status: string
        campaignId: string
        campaignName: string
        cpcBidMicros: number | null
        impressions: number
        clicks: number
        costMicros: number
        conversionsValue: number
      }
    >()

    for (const r of rows) {
      const ag = r.adGroup ?? r.ad_group
      const camp = r.campaign
      const m = r.metrics
      const id = ag?.id ?? ''
      if (!id) continue

      const bidRaw = ag?.cpcBidMicros ?? ag?.cpc_bid_micros
      const cpcBidMicros = bidRaw != null ? Number(bidRaw) : null
      const impressions = Number(m?.impressions ?? 0)
      const clicks = Number(m?.clicks ?? 0)
      const costMicros = Number(m?.costMicros ?? m?.cost_micros ?? 0)
      const conversionsValue = Number(m?.conversions_value ?? m?.conversionsValue ?? 0)

      const existing = byId.get(id)
      if (existing) {
        existing.impressions += impressions
        existing.clicks += clicks
        existing.costMicros += costMicros
        existing.conversionsValue += conversionsValue
      } else {
        byId.set(id, {
          id,
          name: ag?.name ?? '',
          status: ag?.status ?? 'UNKNOWN',
          campaignId: camp?.id ?? '',
          campaignName: camp?.name ?? '',
          cpcBidMicros,
          impressions,
          clicks,
          costMicros,
          conversionsValue,
        })
      }
    }

    const adGroups: GoogleAdGroupRow[] = Array.from(byId.values()).map((agg) => {
      const { amountSpent, cpc, ctr, roas } = computeDerivedMetrics(agg)
      const cpcBid = agg.cpcBidMicros != null ? agg.cpcBidMicros / 1_000_000 : null
      return {
        publishEnabled: agg.status === 'ENABLED',
        status: agg.status,
        adGroupId: agg.id,
        adGroupName: agg.name,
        campaignId: agg.campaignId,
        campaignName: agg.campaignName,
        cpcBid,
        amountSpent,
        impressions: agg.impressions,
        clicks: agg.clicks,
        ctr,
        cpc,
        roas,
      }
    })

    return NextResponse.json(
      { adGroups },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: unknown) {
    const { error, message, status } = normalizeError(e, 'ad_groups_fetch_failed', 401)
    return NextResponse.json({ error, message }, { status })
  }
}
