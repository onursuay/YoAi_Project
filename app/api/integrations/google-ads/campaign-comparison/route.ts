import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { getMetric } from '@/lib/google-ads/helpers'
import { normalizeError } from '@/lib/google-ads/errors'

type Row = {
  campaign?: { name?: string; id?: string; status?: string }
  metrics?: Record<string, unknown>
}

/**
 * GET /api/integrations/google-ads/campaign-comparison?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns active campaign performance with week-over-week and month-over-month comparisons.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') ?? ''
    const to = searchParams.get('to') ?? ''
    if (!from || !to) {
      return NextResponse.json({ error: 'from and to required (YYYY-MM-DD)' }, { status: 400 })
    }

    const currentTo = new Date(to)

    // Previous week: 7 days before current week end
    const currentWeekFrom = new Date(currentTo)
    currentWeekFrom.setDate(currentWeekFrom.getDate() - 6)
    const prevWeekTo = new Date(currentWeekFrom)
    prevWeekTo.setDate(prevWeekTo.getDate() - 1)
    const prevWeekFrom = new Date(prevWeekTo)
    prevWeekFrom.setDate(prevWeekFrom.getDate() - 6)

    // Previous month: 30 days before current month end
    const currentMonthFrom = new Date(currentTo)
    currentMonthFrom.setDate(currentMonthFrom.getDate() - 29)
    const prevMonthTo = new Date(currentMonthFrom)
    prevMonthTo.setDate(prevMonthTo.getDate() - 1)
    const prevMonthFrom = new Date(prevMonthTo)
    prevMonthFrom.setDate(prevMonthFrom.getDate() - 29)

    const fmt = (d: Date) => d.toISOString().split('T')[0]

    const buildQuery = (from: string, to: string) => `
      SELECT campaign.id, campaign.name, campaign.status,
             metrics.cost_micros, metrics.clicks, metrics.impressions,
             metrics.conversions, metrics.conversions_value, metrics.ctr
      FROM campaign
      WHERE segments.date BETWEEN '${from}' AND '${to}'
        AND campaign.status IN ('ENABLED', 'PAUSED')
    `

    // Fetch all 4 periods in parallel
    const [currentWeekRows, prevWeekRows, currentMonthRows, prevMonthRows] = await Promise.all([
      searchGAds<Row>(ctx, buildQuery(fmt(currentWeekFrom), fmt(currentTo))).catch(() => [] as Row[]),
      searchGAds<Row>(ctx, buildQuery(fmt(prevWeekFrom), fmt(prevWeekTo))).catch(() => [] as Row[]),
      searchGAds<Row>(ctx, buildQuery(fmt(currentMonthFrom), fmt(currentTo))).catch(() => [] as Row[]),
      searchGAds<Row>(ctx, buildQuery(fmt(prevMonthFrom), fmt(prevMonthTo))).catch(() => [] as Row[]),
    ])

    // Aggregate rows by campaign
    const aggregateByCampaign = (rows: Row[]) => {
      const map: Record<string, { id: string; name: string; status: string; cost: number; clicks: number; impressions: number; conversions: number; conversionsValue: number; ctr: number }> = {}
      for (const r of rows) {
        const id = r.campaign?.id ?? ''
        if (!id) continue
        if (!map[id]) {
          map[id] = {
            id,
            name: r.campaign?.name ?? '',
            status: r.campaign?.status ?? '',
            cost: 0, clicks: 0, impressions: 0, conversions: 0, conversionsValue: 0, ctr: 0,
          }
        }
        const c = map[id]
        c.cost += getMetric(r.metrics, 'cost_micros') / 1e6
        c.clicks += getMetric(r.metrics, 'clicks')
        c.impressions += getMetric(r.metrics, 'impressions')
        c.conversions += getMetric(r.metrics, 'conversions')
        c.conversionsValue += getMetric(r.metrics, 'conversions_value')
      }
      // Calculate CTR after aggregation
      for (const c of Object.values(map)) {
        c.ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0
      }
      return map
    }

    const cwData = aggregateByCampaign(currentWeekRows)
    const pwData = aggregateByCampaign(prevWeekRows)
    const cmData = aggregateByCampaign(currentMonthRows)
    const pmData = aggregateByCampaign(prevMonthRows)

    const pct = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100

    const allIds = new Set([...Object.keys(cwData), ...Object.keys(cmData)])
    const campaigns: any[] = []

    for (const id of allIds) {
      const cw = cwData[id]
      const pw = pwData[id]
      const cm = cmData[id]
      const pm = pmData[id]
      const current = cw || cm
      if (!current) continue

      campaigns.push({
        id,
        name: current.name,
        status: current.status,
        weekly: {
          current: cw || null,
          previous: pw || null,
          changes: cw ? {
            cost: pct(cw.cost, pw?.cost || 0),
            impressions: pct(cw.impressions, pw?.impressions || 0),
            clicks: pct(cw.clicks, pw?.clicks || 0),
            ctr: pct(cw.ctr, pw?.ctr || 0),
            conversions: pct(cw.conversions, pw?.conversions || 0),
            conversionsValue: pct(cw.conversionsValue, pw?.conversionsValue || 0),
          } : null,
        },
        monthly: {
          current: cm || null,
          previous: pm || null,
          changes: cm ? {
            cost: pct(cm.cost, pm?.cost || 0),
            impressions: pct(cm.impressions, pm?.impressions || 0),
            clicks: pct(cm.clicks, pm?.clicks || 0),
            ctr: pct(cm.ctr, pm?.ctr || 0),
            conversions: pct(cm.conversions, pm?.conversions || 0),
            conversionsValue: pct(cm.conversionsValue, pm?.conversionsValue || 0),
          } : null,
        },
      })
    }

    // Sort by current week cost descending
    campaigns.sort((a, b) => (b.weekly.current?.cost || 0) - (a.weekly.current?.cost || 0))

    return NextResponse.json({ campaigns, fetchedAt: new Date().toISOString() })
  } catch (e: unknown) {
    console.error('Google Ads campaign-comparison error:', e)
    const { error, message, status } = normalizeError(e, 'campaign_comparison_failed', 500)
    return NextResponse.json({ error, message }, { status })
  }
}
