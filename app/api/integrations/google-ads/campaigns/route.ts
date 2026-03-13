import { NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { getDefaultDateRange, computeDerivedMetrics } from '@/lib/google-ads/helpers'
import { normalizeError } from '@/lib/google-ads/errors'

function buildCampaignsQuery(from: string, to: string, showInactive: boolean): string {
  const statusFilter = showInactive ? '' : " AND campaign.status = 'ENABLED'"
  return `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign.optimization_score,
    campaign.campaign_budget,
    campaign_budget.amount_micros,
    campaign_budget.explicitly_shared,
    metrics.impressions,
    metrics.clicks,
    metrics.ctr,
    metrics.average_cpc,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value
  FROM campaign
  WHERE segments.date BETWEEN '${from}' AND '${to}'${statusFilter}
  ORDER BY metrics.cost_micros DESC
  LIMIT 200
`.trim()
}

type Status = 'ENABLED' | 'PAUSED' | 'REMOVED' | string

export interface GoogleCampaignRow {
  publishEnabled: boolean
  status: Status
  optScorePct: number | null
  campaignId: string
  campaignName: string
  campaignBudgetResourceName: string | null
  budget: number | null
  isSharedBudget: boolean
  amountSpent: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  conversions: number
  roas: number | null
}

/**
 * GET /api/integrations/google-ads/campaigns?from=&to=&showInactive=0|1
 * Returns campaigns for the selected customer with Meta-style normalized rows.
 */
export async function GET(request: Request) {
  try {
    const ctx = await getGoogleAdsContext()

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const showInactiveParam = searchParams.get('showInactive')
    const showInactive = showInactiveParam === '1' || showInactiveParam === 'true'
    const { from, to } =
      fromParam && toParam
        ? { from: fromParam, to: toParam }
        : getDefaultDateRange()
    const campaignsQuery = buildCampaignsQuery(from, to, showInactive)

    type Row = {
      campaign?: {
        id?: string
        name?: string
        status?: string
        optimizationScore?: number
        optimization_score?: number
        campaignBudget?: string
        campaign_budget?: string
      }
      campaignBudget?: { amountMicros?: string; amount_micros?: string; explicitlyShared?: boolean; explicitly_shared?: boolean }
      campaign_budget?: { amountMicros?: string; amount_micros?: string; explicitlyShared?: boolean; explicitly_shared?: boolean }
      metrics?: {
        costMicros?: string | number
        cost_micros?: string | number
        impressions?: string | number
        clicks?: string | number
        ctr?: number
        averageCpc?: string | number
        average_cpc?: string | number
        conversions?: string | number
        conversions_value?: string | number
        conversionsValue?: string | number
      }
    }

    const rows = await searchGAds<Row>(ctx, campaignsQuery)

    const byId = new Map<
      string,
      {
        id: string
        name: string
        status: string
        optScore: number | null
        campaignBudgetRn: string | null
        budgetMicros: number | null
        isSharedBudget: boolean
        impressions: number
        clicks: number
        costMicros: number
        conversions: number
        conversionsValue: number
      }
    >()

    for (const r of rows) {
      const c = r.campaign
      const m = r.metrics
      const cb = r.campaignBudget ?? r.campaign_budget
      const id = c?.id ?? ''
      if (!id) continue

      const optRaw = c?.optimizationScore ?? c?.optimization_score
      const optScore =
        optRaw != null && Number.isFinite(Number(optRaw))
          ? Number(optRaw) <= 1
            ? Number(optRaw) * 100
            : Number(optRaw)
          : null

      const budgetMicrosRaw = cb?.amountMicros ?? cb?.amount_micros
      const budgetMicros =
        budgetMicrosRaw != null ? Number(budgetMicrosRaw) : null
      const campaignBudgetRn =
        c?.campaignBudget ?? c?.campaign_budget ?? null
      const isSharedBudget = cb?.explicitlyShared ?? cb?.explicitly_shared ?? false

      const impressions = Number(m?.impressions ?? 0)
      const clicks = Number(m?.clicks ?? 0)
      const costMicros = Number(m?.costMicros ?? m?.cost_micros ?? 0)
      const conversions = Number(m?.conversions ?? 0)
      const conversionsValue = Number(
        m?.conversions_value ?? m?.conversionsValue ?? 0
      )

      const existing = byId.get(id)
      if (existing) {
        existing.impressions += impressions
        existing.clicks += clicks
        existing.costMicros += costMicros
        existing.conversions += conversions
        existing.conversionsValue += conversionsValue
      } else {
        byId.set(id, {
          id,
          name: c?.name ?? '',
          status: c?.status ?? 'UNKNOWN',
          optScore,
          campaignBudgetRn,
          budgetMicros,
          isSharedBudget,
          impressions,
          clicks,
          costMicros,
          conversions,
          conversionsValue,
        })
      }
    }

    const campaigns: GoogleCampaignRow[] = Array.from(byId.values()).map(
      (agg) => {
        const { amountSpent, cpc, ctr, roas } = computeDerivedMetrics(agg)
        const budget =
          agg.budgetMicros != null ? agg.budgetMicros / 1_000_000 : null

        return {
          publishEnabled: agg.status === 'ENABLED',
          status: agg.status as Status,
          optScorePct: agg.optScore,
          campaignId: agg.id,
          campaignName: agg.name,
          campaignBudgetResourceName: agg.campaignBudgetRn,
          budget,
          isSharedBudget: agg.isSharedBudget,
          amountSpent,
          impressions: agg.impressions,
          clicks: agg.clicks,
          ctr,
          cpc,
          conversions: agg.conversions,
          roas,
        }
      }
    )

    return NextResponse.json(
      { campaigns },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: unknown) {
    const { error, message, status } = normalizeError(e, 'campaigns_fetch_failed', 401)
    return NextResponse.json({ error, message }, { status })
  }
}
