import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { getDefaultDateRange, num, microsToUnits } from '@/lib/google-ads/helpers'
import { buildErrorResponse } from '@/lib/google-ads/errors'

function buildLandingPagesQuery(campaignId: string, from: string, to: string): string {
  return `
  SELECT
    campaign.id,
    landing_page_view.unexpanded_final_url,
    metrics.clicks,
    metrics.impressions,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value,
    metrics.ctr,
    metrics.average_cpc
  FROM landing_page_view
  WHERE campaign.id = ${campaignId}
    AND segments.date BETWEEN '${from}' AND '${to}'
  ORDER BY metrics.clicks DESC
  LIMIT 100
  `.trim()
}

export interface LandingPageRow {
  url: string
  clicks: number
  impressions: number
  cost: number
  conversions: number
  conversionsValue: number
  ctr: number
  cpc: number
}

export async function GET(req: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const ctx = await getGoogleAdsContext()
    const campaignId = params.campaignId

    const { searchParams } = new URL(req.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const { from, to } = fromParam && toParam
      ? { from: fromParam, to: toParam }
      : getDefaultDateRange()

    const rows = await searchGAds<any>(ctx, buildLandingPagesQuery(campaignId, from, to))

    // Aggregate by URL (multiple date segments possible)
    const byUrl = new Map<string, { clicks: number; impressions: number; costMicros: number; conversions: number; conversionsValue: number }>()
    for (const r of rows) {
      const view = r.landingPageView ?? r.landing_page_view
      const m = r.metrics
      const url = view?.unexpandedFinalUrl ?? view?.unexpanded_final_url ?? ''
      if (!url) continue

      const existing = byUrl.get(url)
      const clicks = num(m?.clicks)
      const impressions = num(m?.impressions)
      const costMicros = num(m?.costMicros ?? m?.cost_micros)
      const conversions = num(m?.conversions)
      const conversionsValue = num(m?.conversions_value ?? m?.conversionsValue)

      if (existing) {
        existing.clicks += clicks
        existing.impressions += impressions
        existing.costMicros += costMicros
        existing.conversions += conversions
        existing.conversionsValue += conversionsValue
      } else {
        byUrl.set(url, { clicks, impressions, costMicros, conversions, conversionsValue })
      }
    }

    const landingPages: LandingPageRow[] = Array.from(byUrl.entries())
      .map(([url, agg]) => ({
        url,
        clicks: agg.clicks,
        impressions: agg.impressions,
        cost: microsToUnits(agg.costMicros),
        conversions: agg.conversions,
        conversionsValue: agg.conversionsValue,
        ctr: agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
        cpc: agg.clicks > 0 ? microsToUnits(agg.costMicros) / agg.clicks : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks)

    return NextResponse.json({ landingPages }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'landing_pages_failed', 'LandingPages')
    return NextResponse.json(body, { status })
  }
}
