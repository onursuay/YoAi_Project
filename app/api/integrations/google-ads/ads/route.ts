import { NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { getDefaultDateRange, computeDerivedMetrics } from '@/lib/google-ads/helpers'
import { normalizeError } from '@/lib/google-ads/errors'

function buildAdsQuery(from: string, to: string, showInactive: boolean): string {
  const statusFilter = showInactive ? '' : " AND ad_group_ad.status = 'ENABLED'"
  return `
  SELECT
    ad_group_ad.ad.id,
    ad_group_ad.ad.name,
    ad_group_ad.status,
    campaign.id,
    campaign.name,
    ad_group.id,
    ad_group.name,
    metrics.cost_micros,
    metrics.impressions,
    metrics.clicks,
    metrics.ctr,
    metrics.average_cpc,
    metrics.conversions,
    metrics.conversions_value
  FROM ad_group_ad
  WHERE segments.date BETWEEN '${from}' AND '${to}'${statusFilter}
  ORDER BY metrics.cost_micros DESC
  LIMIT 200
`.trim()
}

export interface GoogleAdRow {
  publishEnabled: boolean
  status: string
  adId: string
  adName: string
  adGroupId: string
  adGroupName: string
  campaignId: string
  campaignName: string
  amountSpent: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  roas: number | null
}

/**
 * GET /api/integrations/google-ads/ads?from=&to=&showInactive=0|1
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
    const query = buildAdsQuery(from, to, showInactive)

    type Row = {
      adGroupAd?: {
        ad?: { id?: string; name?: string }
        status?: string
      }
      campaign?: { id?: string; name?: string }
      adGroup?: { id?: string; name?: string }
      metrics?: {
        cost_micros?: string | number
        costMicros?: string | number
        impressions?: string | number
        clicks?: string | number
        ctr?: number
        average_cpc?: string | number
        averageCpc?: string | number
        conversions_value?: string | number
        conversionsValue?: string | number
      }
    }

    const rows = await searchGAds<Row>(ctx, query)

    const byKey = new Map<
      string,
      {
        adId: string
        adName: string
        status: string
        campaignId: string
        campaignName: string
        adGroupId: string
        adGroupName: string
        impressions: number
        clicks: number
        costMicros: number
        conversionsValue: number
      }
    >()

    for (const r of rows) {
      const aga = r.adGroupAd ?? (r as { ad_group_ad?: Row['adGroupAd'] }).ad_group_ad
      const ad = aga?.ad
      const camp = r.campaign
      const ag = r.adGroup ?? (r as { ad_group?: Row['adGroup'] }).ad_group
      const m = r.metrics
      const adId = ad?.id ?? ''
      const campaignId = camp?.id ?? ''
      const adGroupId = ag?.id ?? ''
      if (!adId) continue
      const key = `${campaignId}-${adGroupId}-${adId}`

      const impressions = Number(m?.impressions ?? 0)
      const clicks = Number(m?.clicks ?? 0)
      const costMicros = Number(m?.costMicros ?? m?.cost_micros ?? 0)
      const conversionsValue = Number(m?.conversions_value ?? m?.conversionsValue ?? 0)

      const existing = byKey.get(key)
      if (existing) {
        existing.impressions += impressions
        existing.clicks += clicks
        existing.costMicros += costMicros
        existing.conversionsValue += conversionsValue
      } else {
        byKey.set(key, {
          adId,
          adName: ad?.name ?? '',
          status: aga?.status ?? 'UNKNOWN',
          campaignId,
          campaignName: camp?.name ?? '',
          adGroupId,
          adGroupName: ag?.name ?? '',
          impressions,
          clicks,
          costMicros,
          conversionsValue,
        })
      }
    }

    const ads: GoogleAdRow[] = Array.from(byKey.values()).map((agg) => {
      const { amountSpent, cpc, ctr, roas } = computeDerivedMetrics(agg)
      return {
        publishEnabled: agg.status === 'ENABLED',
        status: agg.status,
        adId: agg.adId,
        adName: agg.adName,
        adGroupId: agg.adGroupId,
        adGroupName: agg.adGroupName,
        campaignId: agg.campaignId,
        campaignName: agg.campaignName,
        amountSpent,
        impressions: agg.impressions,
        clicks: agg.clicks,
        ctr,
        cpc,
        roas,
      }
    })

    return NextResponse.json(
      { ads },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: unknown) {
    const { error, message, status } = normalizeError(e, 'ads_fetch_failed', 401)
    return NextResponse.json({ error, message }, { status })
  }
}
