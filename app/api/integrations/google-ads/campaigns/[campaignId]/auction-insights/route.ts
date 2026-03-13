import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { num, microsToUnits, getDefaultDateRange } from '@/lib/google-ads/helpers'
import { buildErrorResponse } from '@/lib/google-ads/errors'

function buildQuery(campaignId: string, from: string, to: string): string {
  return `
  SELECT
    campaign.id,
    metrics.search_absolute_top_impression_share,
    metrics.search_top_impression_share,
    metrics.search_impression_share,
    metrics.search_budget_lost_impression_share,
    metrics.search_rank_lost_impression_share,
    metrics.search_exact_match_impression_share,
    metrics.clicks,
    metrics.impressions,
    metrics.ctr,
    metrics.average_cpc,
    metrics.cost_micros,
    metrics.conversions
  FROM campaign
  WHERE campaign.id = ${campaignId}
    AND segments.date BETWEEN '${from}' AND '${to}'
  `.trim()
}

export interface AuctionInsightsRow {
  absoluteTopImpressionShare: number | null
  topImpressionShare: number | null
  searchImpressionShare: number | null
  budgetLostImpressionShare: number | null
  rankLostImpressionShare: number | null
  exactMatchImpressionShare: number | null
  clicks: number
  impressions: number
  ctr: number
  averageCpc: number
  cost: number
  conversions: number
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  try {
    const { campaignId } = await params
    const ctx = await getGoogleAdsContext()

    const { searchParams } = new URL(req.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const { from, to } = fromParam && toParam
      ? { from: fromParam, to: toParam }
      : getDefaultDateRange()

    const rows = await searchGAds<any>(ctx, buildQuery(campaignId, from, to))

    // Aggregate across date segments
    let totalClicks = 0, totalImpressions = 0, totalCostMicros = 0, totalConversions = 0
    let absTopShare: number | null = null
    let topShare: number | null = null
    let searchShare: number | null = null
    let budgetLost: number | null = null
    let rankLost: number | null = null
    let exactMatch: number | null = null

    for (const r of rows) {
      const m = r.metrics
      totalClicks += num(m?.clicks)
      totalImpressions += num(m?.impressions)
      totalCostMicros += num(m?.costMicros ?? m?.cost_micros)
      totalConversions += num(m?.conversions)

      const abs = m?.searchAbsoluteTopImpressionShare ?? m?.search_absolute_top_impression_share
      const top = m?.searchTopImpressionShare ?? m?.search_top_impression_share
      const sis = m?.searchImpressionShare ?? m?.search_impression_share
      const bl = m?.searchBudgetLostImpressionShare ?? m?.search_budget_lost_impression_share
      const rl = m?.searchRankLostImpressionShare ?? m?.search_rank_lost_impression_share
      const em = m?.searchExactMatchImpressionShare ?? m?.search_exact_match_impression_share

      if (abs !== undefined && abs !== null) absTopShare = num(abs)
      if (top !== undefined && top !== null) topShare = num(top)
      if (sis !== undefined && sis !== null) searchShare = num(sis)
      if (bl !== undefined && bl !== null) budgetLost = num(bl)
      if (rl !== undefined && rl !== null) rankLost = num(rl)
      if (em !== undefined && em !== null) exactMatch = num(em)
    }

    const data: AuctionInsightsRow = {
      absoluteTopImpressionShare: absTopShare,
      topImpressionShare: topShare,
      searchImpressionShare: searchShare,
      budgetLostImpressionShare: budgetLost,
      rankLostImpressionShare: rankLost,
      exactMatchImpressionShare: exactMatch,
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      averageCpc: totalClicks > 0 ? microsToUnits(totalCostMicros) / totalClicks : 0,
      cost: microsToUnits(totalCostMicros),
      conversions: totalConversions,
    }

    return NextResponse.json({ insights: data, dateRange: { from, to } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'auction_insights_failed', 'AuctionInsights')
    return NextResponse.json(body, { status })
  }
}
