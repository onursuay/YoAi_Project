import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { num, microsToUnits, getDefaultDateRange } from '@/lib/google-ads/helpers'
import { buildErrorResponse } from '@/lib/google-ads/errors'

function buildQuery(campaignId: string, from: string, to: string): string {
  return `
  SELECT
    campaign.id,
    segments.device,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    metrics.ctr,
    metrics.average_cpc
  FROM campaign
  WHERE campaign.id = ${campaignId}
    AND segments.date BETWEEN '${from}' AND '${to}'
  `.trim()
}

const DEVICE_LABELS: Record<string, string> = {
  MOBILE: 'Mobil',
  DESKTOP: 'Masaüstü',
  TABLET: 'Tablet',
  CONNECTED_TV: 'Bağlı TV',
  OTHER: 'Diğer',
  UNKNOWN: 'Bilinmeyen',
  UNSPECIFIED: 'Belirtilmemiş',
}

export interface DeviceRow {
  device: string
  deviceLabel: string
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

    // Aggregate by device (rows may have multiple date segments per device)
    const deviceMap = new Map<string, { impressions: number; clicks: number; costMicros: number; conversions: number }>()
    for (const r of rows) {
      const m = r.metrics ?? {}
      const seg = r.segments ?? {}
      const device = seg.device ?? 'UNKNOWN'
      const existing = deviceMap.get(device) ?? { impressions: 0, clicks: 0, costMicros: 0, conversions: 0 }
      existing.impressions += num(m.impressions)
      existing.clicks += num(m.clicks)
      existing.costMicros += num(m.costMicros ?? m.cost_micros)
      existing.conversions += num(m.conversions)
      deviceMap.set(device, existing)
    }

    const devices: DeviceRow[] = Array.from(deviceMap.entries())
      .map(([device, d]) => ({
        device,
        deviceLabel: DEVICE_LABELS[device] || device,
        impressions: d.impressions,
        clicks: d.clicks,
        cost: microsToUnits(d.costMicros),
        conversions: d.conversions,
        ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
        cpc: d.clicks > 0 ? microsToUnits(d.costMicros) / d.clicks : 0,
      }))
      .sort((a, b) => b.impressions - a.impressions)

    return NextResponse.json({ devices, dateRange: { from, to } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'devices_failed', 'DeviceReport')
    return NextResponse.json(body, { status })
  }
}
