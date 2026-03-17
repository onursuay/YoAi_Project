import { NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { getDefaultDateRange } from '@/lib/google-ads/helpers'
import { normalizeError } from '@/lib/google-ads/errors'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params
    const { searchParams } = new URL(req.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const { from, to } =
      fromParam && toParam ? { from: fromParam, to: toParam } : getDefaultDateRange()
    const ctx = await getGoogleAdsContext()

    const query = `
      SELECT
        segments.auction_insight_domain,
        metrics.auction_insight_search_impression_share,
        metrics.auction_insight_search_overlap_rate,
        metrics.auction_insight_search_position_above_rate,
        metrics.auction_insight_search_top_impression_percentage,
        metrics.auction_insight_search_absolute_top_impression_percentage,
        metrics.auction_insight_search_outranking_share
      FROM campaign
      WHERE campaign.id = '${campaignId}'
        AND segments.date BETWEEN '${from}' AND '${to}'
      ORDER BY metrics.auction_insight_search_impression_share DESC
      LIMIT 50
    `.trim()

    type Row = {
      segments?: {
        auctionInsightDomain?: string
        auction_insight_domain?: string
      }
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

    const rows = await searchGAds<Row>(ctx, query)
    const fmtPct = (v: number) => (v < 0.1 ? '< %10' : `%${(v * 100).toFixed(2)}`)

    const results = rows
      .map((r) => {
        const domain = r.segments?.auctionInsightDomain ?? r.segments?.auction_insight_domain ?? ''
        const m = r.metrics ?? {}
        return {
          domain,
          impressionShare: fmtPct(
            m.auctionInsightSearchImpressionShare ?? m.auction_insight_search_impression_share ?? 0
          ),
          overlapRate: fmtPct(
            m.auctionInsightSearchOverlapRate ?? m.auction_insight_search_overlap_rate ?? 0
          ),
          positionAboveRate: fmtPct(
            m.auctionInsightSearchPositionAboveRate ??
              m.auction_insight_search_position_above_rate ??
              0
          ),
          topImpressionPct: fmtPct(
            m.auctionInsightSearchTopImpressionPercentage ??
              m.auction_insight_search_top_impression_percentage ??
              0
          ),
          absTopImpressionPct: fmtPct(
            m.auctionInsightSearchAbsoluteTopImpressionPercentage ??
              m.auction_insight_search_absolute_top_impression_percentage ??
              0
          ),
          outrankingShare: fmtPct(
            m.auctionInsightSearchOutrankingShare ??
              m.auction_insight_search_outranking_share ??
              0
          ),
        }
      })
      .filter((r) => r.domain !== '')

    return NextResponse.json({ competitors: results })
  } catch (err) {
    return NextResponse.json(
      { error: normalizeError(err) },
      { status: 500 }
    )
  }
}
