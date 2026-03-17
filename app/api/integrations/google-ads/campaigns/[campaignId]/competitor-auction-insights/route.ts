import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { getDefaultDateRange } from '@/lib/google-ads/helpers'
import { buildErrorResponse } from '@/lib/google-ads/errors'

type Row = {
  segments?: { auctionInsightDomain?: string; auction_insight_domain?: string }
  auctionInsight?: { domain?: string }
  auction_insight?: { domain?: string }
  metrics?: {
    auction_insight_search_impression_share?: number
    auctionInsightSearchImpressionShare?: number
    auction_insight_search_overlap_rate?: number
    auctionInsightSearchOverlapRate?: number
    auction_insight_search_position_above_rate?: number
    auctionInsightSearchPositionAboveRate?: number
    auction_insight_search_top_impression_percentage?: number
    auctionInsightSearchTopImpressionPercentage?: number
    auction_insight_search_absolute_top_impression_percentage?: number
    auctionInsightSearchAbsoluteTopImpressionPercentage?: number
    auction_insight_search_outranking_share?: number
    auctionInsightSearchOutrankingShare?: number
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params
    const { searchParams } = new URL(req.url)
    const adGroupId = searchParams.get('adGroupId')
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    const { from, to } =
      fromParam && toParam
        ? { from: fromParam, to: toParam }
        : getDefaultDateRange()

    const ctx = await getGoogleAdsContext()

    let whereClause = `segments.date BETWEEN '${from}' AND '${to}'`
    if (adGroupId) {
      whereClause += ` AND ad_group.id = '${adGroupId}'`
    } else {
      whereClause += ` AND campaign.id = '${campaignId}'`
    }

    const resource = adGroupId ? 'ad_group' : 'campaign'
    const query = `
      SELECT
        segments.auction_insight_domain,
        metrics.auction_insight_search_impression_share,
        metrics.auction_insight_search_overlap_rate,
        metrics.auction_insight_search_position_above_rate,
        metrics.auction_insight_search_top_impression_percentage,
        metrics.auction_insight_search_absolute_top_impression_percentage,
        metrics.auction_insight_search_outranking_share
      FROM ${resource}
      WHERE ${whereClause}
      ORDER BY metrics.auction_insight_search_impression_share DESC
    `.trim()

    const rows = await searchGAds<Row>(ctx, query)

    const results = rows
      .map((r) => {
        const seg = r.segments ?? {}
        const ai = r.auctionInsight ?? r.auction_insight
        const domain =
          seg.auctionInsightDomain ??
          seg.auction_insight_domain ??
          ai?.domain ??
          ''
        const m = r.metrics ?? {}

        const impressionShare =
          m.auctionInsightSearchImpressionShare ??
          m.auction_insight_search_impression_share ??
          0
        const overlapRate =
          m.auctionInsightSearchOverlapRate ??
          m.auction_insight_search_overlap_rate ??
          0
        const positionAboveRate =
          m.auctionInsightSearchPositionAboveRate ??
          m.auction_insight_search_position_above_rate ??
          0
        const topImpressionPct =
          m.auctionInsightSearchTopImpressionPercentage ??
          m.auction_insight_search_top_impression_percentage ??
          0
        const absTopImpressionPct =
          m.auctionInsightSearchAbsoluteTopImpressionPercentage ??
          m.auction_insight_search_absolute_top_impression_percentage ??
          0
        const outrankingShare =
          m.auctionInsightSearchOutrankingShare ??
          m.auction_insight_search_outranking_share ??
          0

        return {
          domain,
          impressionShare: Number((impressionShare * 100).toFixed(2)),
          overlapRate: Number((overlapRate * 100).toFixed(2)),
          positionAboveRate: Number((positionAboveRate * 100).toFixed(2)),
          topImpressionPct: Number((topImpressionPct * 100).toFixed(2)),
          absTopImpressionPct: Number((absTopImpressionPct * 100).toFixed(2)),
          outrankingShare: Number((outrankingShare * 100).toFixed(2)),
        }
      })
      .filter((r) => r.domain !== '')

    return NextResponse.json(
      { insights: results, dateRange: { from, to } },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    const { body, status } = buildErrorResponse(
      err,
      'competitor_auction_insights_failed',
      'CompetitorAuctionInsights'
    )
    return NextResponse.json(body, { status })
  }
}
