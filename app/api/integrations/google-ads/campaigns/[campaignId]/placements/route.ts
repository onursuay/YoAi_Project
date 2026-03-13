import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { num, microsToUnits, getDefaultDateRange } from '@/lib/google-ads/helpers'
import { buildErrorResponse } from '@/lib/google-ads/errors'

function buildQuery(campaignId: string, from: string, to: string): string {
  return `
  SELECT
    campaign.id,
    detail_placement_view.display_name,
    detail_placement_view.target_url,
    detail_placement_view.placement_type,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    metrics.ctr,
    metrics.average_cpc
  FROM detail_placement_view
  WHERE campaign.id = ${campaignId}
    AND segments.date BETWEEN '${from}' AND '${to}'
  ORDER BY metrics.impressions DESC
  LIMIT 500
  `.trim()
}

export interface PlacementRow {
  displayName: string
  targetUrl: string
  placementType: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
  ctr: number
  cpc: number
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

    const placements: PlacementRow[] = rows.map((r: any) => {
      const view = r.detailPlacementView ?? r.detail_placement_view ?? {}
      const m = r.metrics ?? {}

      return {
        displayName: view.displayName ?? view.display_name ?? '',
        targetUrl: view.targetUrl ?? view.target_url ?? '',
        placementType: view.placementType ?? view.placement_type ?? '',
        impressions: num(m.impressions),
        clicks: num(m.clicks),
        cost: microsToUnits(num(m.costMicros ?? m.cost_micros)),
        conversions: num(m.conversions),
        ctr: num(m.ctr) * 100,
        cpc: microsToUnits(num(m.averageCpc ?? m.average_cpc)),
      }
    })

    return NextResponse.json({ placements, dateRange: { from, to } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'placements_failed', 'Placements')
    return NextResponse.json(body, { status })
  }
}
