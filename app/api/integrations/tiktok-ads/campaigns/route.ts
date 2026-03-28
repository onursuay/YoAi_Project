import { NextResponse } from 'next/server'
import { getTikTokContext, tiktokApiRequest } from '@/lib/tiktokAdsAuth'

interface TikTokCampaign {
  campaign_id: string
  campaign_name: string
  objective_type: string
  budget: number
  budget_mode: string
  operation_status: string
}

interface TikTokReportRow {
  dimensions: { campaign_id: string }
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
  const showInactive = url.searchParams.get('showInactive') === '1'

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
    // 1) Fetch campaigns
    const filtering: Record<string, unknown> = {}
    if (!showInactive) {
      filtering.primary_status = 'STATUS_ENABLE'
    }

    const campaignData = await tiktokApiRequest<{ list: TikTokCampaign[]; page_info?: { total_number: number } }>(
      '/campaign/get/',
      ctx,
      {
        params: {
          advertiser_id: ctx.advertiserId,
          filtering: JSON.stringify(filtering),
          page_size: '200',
        },
      }
    )

    const campaignList = campaignData?.list || []

    // 2) Fetch reporting metrics for these campaigns
    let metricsMap = new Map<string, TikTokReportRow['metrics']>()

    if (campaignList.length > 0) {
      try {
        const reportData = await tiktokApiRequest<{ list: TikTokReportRow[] }>(
          '/report/integrated/get/',
          ctx,
          {
            method: 'GET',
            params: {
              advertiser_id: ctx.advertiserId,
              report_type: 'BASIC',
              dimensions: JSON.stringify(['campaign_id']),
              metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'conversion', 'reach']),
              data_level: 'AUCTION_CAMPAIGN',
              start_date: from,
              end_date: to,
              page_size: '200',
            },
          }
        )

        for (const row of reportData?.list || []) {
          metricsMap.set(row.dimensions.campaign_id, row.metrics)
        }
      } catch (err) {
        console.warn('[TikTok Campaigns] Report fetch failed, continuing without metrics:', err instanceof Error ? err.message : 'unknown')
      }
    }

    // 3) Merge campaigns with metrics
    const campaigns = campaignList.map((c) => {
      const m = metricsMap.get(c.campaign_id)
      const isEnabled = c.operation_status === 'ENABLE' || c.operation_status === 'CAMPAIGN_STATUS_ENABLE'
      return {
        campaignId: c.campaign_id,
        campaignName: c.campaign_name,
        objective: c.objective_type,
        status: c.operation_status,
        publishEnabled: isEnabled,
        budget: c.budget || 0,
        budgetMode: c.budget_mode,
        amountSpent: parseFloat(m?.spend || '0'),
        impressions: parseInt(m?.impressions || '0', 10),
        clicks: parseInt(m?.clicks || '0', 10),
        ctr: parseFloat(m?.ctr || '0'),
        cpc: parseFloat(m?.cpc || '0'),
        conversions: parseInt(m?.conversion || '0', 10),
        reach: parseInt(m?.reach || '0', 10),
      }
    })

    return NextResponse.json({ ok: true, campaigns })
  } catch (err) {
    console.error('[TikTok Campaigns] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
