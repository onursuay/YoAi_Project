import { NextResponse } from 'next/server'
import { getTikTokContext, tiktokApiRequest } from '@/lib/tiktokAdsAuth'

interface TikTokDailyRow {
  dimensions: { stat_time_day: string }
  metrics: {
    spend: string
    impressions: string
    clicks: string
    ctr: string
    cpc: string
    conversion: string
    reach: string
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to params required' }, { status: 400 })
  }

  let ctx
  try {
    ctx = await getTikTokContext()
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Not connected', code: e.code },
      { status: e.status || 401 }
    )
  }

  try {
    // Fetch daily breakdown
    const reportData = await tiktokApiRequest<{ list: TikTokDailyRow[] }>(
      '/report/integrated/get/',
      ctx,
      {
        method: 'GET',
        params: {
          advertiser_id: ctx.advertiserId,
          report_type: 'BASIC',
          dimensions: JSON.stringify(['stat_time_day']),
          metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'conversion', 'reach']),
          data_level: 'AUCTION_ADVERTISER',
          start_date: from,
          end_date: to,
          page_size: '365',
        },
      }
    )

    const rows = reportData?.list || []

    // Sort by date
    rows.sort((a, b) => a.dimensions.stat_time_day.localeCompare(b.dimensions.stat_time_day))

    // Build totals and series
    const dates: string[] = []
    const series = {
      cost: [] as number[],
      clicks: [] as number[],
      impressions: [] as number[],
      conversions: [] as number[],
      reach: [] as number[],
      ctr: [] as number[],
    }

    let totalCost = 0
    let totalClicks = 0
    let totalImpressions = 0
    let totalConversions = 0
    let totalReach = 0

    for (const row of rows) {
      const day = row.dimensions.stat_time_day.split(' ')[0] // "2026-03-01 00:00:00" -> "2026-03-01"
      const spend = parseFloat(row.metrics.spend || '0')
      const clicks = parseInt(row.metrics.clicks || '0', 10)
      const impressions = parseInt(row.metrics.impressions || '0', 10)
      const conversions = parseInt(row.metrics.conversion || '0', 10)
      const reach = parseInt(row.metrics.reach || '0', 10)
      const ctr = parseFloat(row.metrics.ctr || '0')

      dates.push(day)
      series.cost.push(spend)
      series.clicks.push(clicks)
      series.impressions.push(impressions)
      series.conversions.push(conversions)
      series.reach.push(reach)
      series.ctr.push(ctr)

      totalCost += spend
      totalClicks += clicks
      totalImpressions += impressions
      totalConversions += conversions
      totalReach += reach
    }

    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

    // Calculate period-over-period changes (split series in half)
    const mid = Math.floor(rows.length / 2)
    const firstHalf = rows.slice(0, mid)
    const secondHalf = rows.slice(mid)

    function sumMetric(arr: TikTokDailyRow[], key: keyof TikTokDailyRow['metrics']): number {
      return arr.reduce((s, r) => s + parseFloat(r.metrics[key] || '0'), 0)
    }

    function pctChange(prev: number, curr: number): number {
      if (prev === 0) return curr > 0 ? 100 : 0
      return ((curr - prev) / prev) * 100
    }

    const changes = {
      cost: pctChange(sumMetric(firstHalf, 'spend'), sumMetric(secondHalf, 'spend')),
      clicks: pctChange(sumMetric(firstHalf, 'clicks'), sumMetric(secondHalf, 'clicks')),
      impressions: pctChange(sumMetric(firstHalf, 'impressions'), sumMetric(secondHalf, 'impressions')),
      conversions: pctChange(sumMetric(firstHalf, 'conversion'), sumMetric(secondHalf, 'conversion')),
      reach: pctChange(sumMetric(firstHalf, 'reach'), sumMetric(secondHalf, 'reach')),
      ctr: 0,
    }

    return NextResponse.json({
      totals: {
        cost: totalCost,
        clicks: totalClicks,
        impressions: totalImpressions,
        conversions: totalConversions,
        reach: totalReach,
        avgCtr,
      },
      changes,
      dates,
      series,
    })
  } catch (err) {
    console.error('[TikTok KPIs] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
