import { NextRequest, NextResponse } from 'next/server'
import { metaGraphFetch } from '@/lib/metaGraph'
import { resolveMetaContext } from '@/lib/meta/context'
import { metaFetchWithRateLimit } from '@/lib/meta/rateLimit'

/**
 * GET /api/meta/campaign-comparison?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns active campaign performance with week-over-week and month-over-month comparisons.
 */
export async function GET(req: NextRequest) {
  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ error: 'missing_token' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to required' }, { status: 400 })
  }

  try {
    const accountId = ctx.accountId

    // Calculate comparison periods
    const currentFrom = new Date(from)
    const currentTo = new Date(to)
    const daysDiff = Math.ceil((currentTo.getTime() - currentFrom.getTime()) / (1000 * 60 * 60 * 24))

    // Previous week: 7 days before the current "from"
    const prevWeekTo = new Date(currentFrom)
    prevWeekTo.setDate(prevWeekTo.getDate() - 1)
    const prevWeekFrom = new Date(prevWeekTo)
    prevWeekFrom.setDate(prevWeekFrom.getDate() - 6)

    // Previous month: 30 days before the current "from"
    const prevMonthTo = new Date(currentFrom)
    prevMonthTo.setDate(prevMonthTo.getDate() - 1)
    const prevMonthFrom = new Date(prevMonthTo)
    prevMonthFrom.setDate(prevMonthFrom.getDate() - 29)

    // Last 7 days of current period
    const currentWeekFrom = new Date(currentTo)
    currentWeekFrom.setDate(currentWeekFrom.getDate() - 6)

    // Last 30 days of current period
    const currentMonthFrom = new Date(currentTo)
    currentMonthFrom.setDate(currentMonthFrom.getDate() - 29)

    const fmt = (d: Date) => d.toISOString().split('T')[0]

    // Fetch campaigns with insights for all periods in parallel
    const fields = 'campaign_name,spend,impressions,clicks,ctr,cpc,reach,actions,purchase_roas'
    const buildParams = (since: string, until: string): Record<string, string> => ({
      fields: `name,status,objective,insights.time_range(${JSON.stringify({ since, until })}).fields(${fields})`,
      filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }]),
      limit: '100',
    })

    const periods = [
      { key: 'currentWeek', from: fmt(currentWeekFrom), to: fmt(currentTo) },
      { key: 'prevWeek', from: fmt(prevWeekFrom), to: fmt(prevWeekTo) },
      { key: 'currentMonth', from: fmt(currentMonthFrom), to: fmt(currentTo) },
      { key: 'prevMonth', from: fmt(prevMonthFrom), to: fmt(prevMonthTo) },
    ]

    const results = await Promise.all(
      periods.map(async (period) => {
        try {
          const params = buildParams(period.from, period.to)
          const { response } = await metaFetchWithRateLimit(
            () => metaGraphFetch(`/${accountId}/campaigns`, ctx.userAccessToken, { params }),
            2
          )
          if (!response.ok) return { key: period.key, campaigns: [] }
          const data = await response.json().catch(() => ({ data: [] }))
          return { key: period.key, campaigns: data.data || [] }
        } catch {
          return { key: period.key, campaigns: [] }
        }
      })
    )

    const periodData: Record<string, any[]> = {}
    for (const r of results) {
      periodData[r.key] = r.campaigns
    }

    // Parse campaign insights
    const parseCampaigns = (campaigns: any[]) => {
      const map: Record<string, any> = {}
      for (const c of campaigns) {
        const insights = c.insights?.data?.[0]
        if (!insights) continue
        const actions = insights.actions || []
        const purchaseAction = actions.find((a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')
        const purchases = purchaseAction ? parseInt(purchaseAction.value || '0', 10) : 0
        let roas = 0
        if (insights.purchase_roas) {
          if (Array.isArray(insights.purchase_roas) && insights.purchase_roas[0]?.value) {
            roas = parseFloat(insights.purchase_roas[0].value)
          } else if (typeof insights.purchase_roas === 'number') {
            roas = insights.purchase_roas
          }
        }
        map[c.id] = {
          id: c.id,
          name: c.name,
          status: c.status,
          objective: c.objective,
          spend: parseFloat(insights.spend || '0'),
          impressions: parseInt(insights.impressions || '0', 10),
          clicks: parseInt(insights.clicks || '0', 10),
          ctr: parseFloat(insights.ctr || '0'),
          cpc: parseFloat(insights.cpc || '0'),
          reach: parseInt(insights.reach || '0', 10),
          purchases,
          roas,
        }
      }
      return map
    }

    const currentWeekData = parseCampaigns(periodData.currentWeek || [])
    const prevWeekData = parseCampaigns(periodData.prevWeek || [])
    const currentMonthData = parseCampaigns(periodData.currentMonth || [])
    const prevMonthData = parseCampaigns(periodData.prevMonth || [])

    // Build comparison result
    const pct = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100

    // Get all campaign IDs from current periods
    const allIds = new Set([...Object.keys(currentWeekData), ...Object.keys(currentMonthData)])
    const campaigns: any[] = []

    for (const id of allIds) {
      const cw = currentWeekData[id]
      const pw = prevWeekData[id]
      const cm = currentMonthData[id]
      const pm = prevMonthData[id]
      const current = cw || cm
      if (!current) continue

      campaigns.push({
        id,
        name: current.name,
        status: current.status,
        objective: current.objective,
        weekly: {
          current: cw || null,
          previous: pw || null,
          changes: cw ? {
            spend: pct(cw.spend, pw?.spend || 0),
            impressions: pct(cw.impressions, pw?.impressions || 0),
            clicks: pct(cw.clicks, pw?.clicks || 0),
            ctr: pct(cw.ctr, pw?.ctr || 0),
            reach: pct(cw.reach, pw?.reach || 0),
            purchases: pct(cw.purchases, pw?.purchases || 0),
            roas: pct(cw.roas, pw?.roas || 0),
          } : null,
        },
        monthly: {
          current: cm || null,
          previous: pm || null,
          changes: cm ? {
            spend: pct(cm.spend, pm?.spend || 0),
            impressions: pct(cm.impressions, pm?.impressions || 0),
            clicks: pct(cm.clicks, pm?.clicks || 0),
            ctr: pct(cm.ctr, pm?.ctr || 0),
            reach: pct(cm.reach, pm?.reach || 0),
            purchases: pct(cm.purchases, pm?.purchases || 0),
            roas: pct(cm.roas, pm?.roas || 0),
          } : null,
        },
      })
    }

    // Sort by current week spend descending
    campaigns.sort((a, b) => (b.weekly.current?.spend || 0) - (a.weekly.current?.spend || 0))

    return NextResponse.json({ campaigns, fetchedAt: new Date().toISOString() })
  } catch (error) {
    console.error('Meta campaign-comparison error:', error)
    return NextResponse.json(
      { error: 'server_error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
