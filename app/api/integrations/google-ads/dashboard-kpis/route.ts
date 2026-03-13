import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { getMetric } from '@/lib/google-ads/helpers'
import { normalizeError } from '@/lib/google-ads/errors'

type Row = {
  segments?: Record<string, unknown> & { date?: string }
  metrics?: Record<string, unknown>
}

/**
 * GET /api/integrations/google-ads/dashboard-kpis?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Fetches daily metrics and returns totals + daily series + period-over-period % change (first half vs second half).
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') ?? ''
    const to = searchParams.get('to') ?? ''
    if (!from || !to) {
      return NextResponse.json({ error: 'from and to query params required (YYYY-MM-DD)' }, { status: 400 })
    }

    const query = `
      SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value, metrics.ctr
      FROM customer
      WHERE segments.date BETWEEN '${from}' AND '${to}'
      ORDER BY segments.date ASC
    `
    const rows = await searchGAds<Row>(ctx, query)

    const byDate = new Map<string, { cost: number; clicks: number; impressions: number; conversions: number; conversionsValue: number; ctr: number }>()
    for (const r of rows) {
      const d = (r.segments?.date as string) ?? ''
      if (!d) continue
      const cur = byDate.get(d) ?? { cost: 0, clicks: 0, impressions: 0, conversions: 0, conversionsValue: 0, ctr: 0 }
      cur.cost += getMetric(r.metrics, 'cost_micros') / 1e6
      cur.clicks += getMetric(r.metrics, 'clicks')
      cur.impressions += getMetric(r.metrics, 'impressions')
      cur.conversions += getMetric(r.metrics, 'conversions')
      cur.conversionsValue += getMetric(r.metrics, 'conversions_value')
      cur.ctr += getMetric(r.metrics, 'ctr')
      byDate.set(d, cur)
    }

    const sortedDates = Array.from(byDate.keys()).sort()
    const costSeries = sortedDates.map((d) => byDate.get(d)!.cost)
    const clicksSeries = sortedDates.map((d) => byDate.get(d)!.clicks)
    const impressionsSeries = sortedDates.map((d) => byDate.get(d)!.impressions)
    const conversionsSeries = sortedDates.map((d) => byDate.get(d)!.conversions)
    const conversionsValueSeries = sortedDates.map((d) => byDate.get(d)!.conversionsValue)
    const ctrSeries = sortedDates.map((d) => byDate.get(d)!.ctr)

    const totals = {
      cost: costSeries.reduce((a, b) => a + b, 0),
      clicks: clicksSeries.reduce((a, b) => a + b, 0),
      impressions: impressionsSeries.reduce((a, b) => a + b, 0),
      conversions: conversionsSeries.reduce((a, b) => a + b, 0),
      conversionsValue: conversionsValueSeries.reduce((a, b) => a + b, 0),
      avgCtr: 0,
    }
    totals.avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0

    const mid = Math.floor(sortedDates.length / 2)
    const firstHalf = sortedDates.slice(0, mid)
    const secondHalf = sortedDates.slice(mid)
    const sum = (dates: string[], key: 'cost' | 'clicks' | 'impressions' | 'conversions' | 'conversionsValue' | 'ctr') =>
      dates.reduce((acc, d) => acc + (byDate.get(d)?.[key] ?? 0), 0)
    const first = {
      cost: sum(firstHalf, 'cost'),
      clicks: sum(firstHalf, 'clicks'),
      impressions: sum(firstHalf, 'impressions'),
      conversions: sum(firstHalf, 'conversions'),
      conversionsValue: sum(firstHalf, 'conversionsValue'),
      ctr: firstHalf.length ? sum(firstHalf, 'ctr') / firstHalf.length : 0,
    }
    const second = {
      cost: sum(secondHalf, 'cost'),
      clicks: sum(secondHalf, 'clicks'),
      impressions: sum(secondHalf, 'impressions'),
      conversions: sum(secondHalf, 'conversions'),
      conversionsValue: sum(secondHalf, 'conversionsValue'),
      ctr: secondHalf.length ? sum(secondHalf, 'ctr') / secondHalf.length : 0,
    }
    const pct = (a: number, b: number): number => (b === 0 ? 0 : ((a - b) / b) * 100)
    const changes = {
      cost: pct(second.cost, first.cost),
      clicks: pct(second.clicks, first.clicks),
      impressions: pct(second.impressions, first.impressions),
      conversions: pct(second.conversions, first.conversions),
      conversionsValue: pct(second.conversionsValue, first.conversionsValue),
      ctr: pct(second.ctr, first.ctr),
    }

    return NextResponse.json(
      {
        totals: {
          cost: totals.cost,
          clicks: totals.clicks,
          impressions: totals.impressions,
          conversions: totals.conversions,
          conversionsValue: totals.conversionsValue,
          avgCtr: totals.avgCtr,
        },
        changes: {
          cost: changes.cost,
          clicks: changes.clicks,
          impressions: changes.impressions,
          conversions: changes.conversions,
          conversionsValue: changes.conversionsValue,
          ctr: changes.ctr,
        },
        dates: sortedDates,
        series: {
          cost: costSeries,
          clicks: clicksSeries,
          impressions: impressionsSeries,
          conversions: conversionsSeries,
          conversionsValue: conversionsValueSeries,
          ctr: ctrSeries,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: unknown) {
    console.error('dashboard-kpis error:', e)
    const { error, message, status } = normalizeError(e, 'dashboard_kpis_failed', 500)
    return NextResponse.json({ error, message }, { status })
  }
}
