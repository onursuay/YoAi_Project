import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { getDefaultDateRange, num, microsToUnits, computeDerivedMetrics } from '@/lib/google-ads/helpers'
import { normalizeError } from '@/lib/google-ads/errors'

function buildDetailQuery(campaignId: string, from: string, to: string): string {
  return `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign.serving_status,
    campaign.optimization_score,
    campaign.campaign_budget,
    campaign_budget.amount_micros,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value,
    metrics.ctr,
    metrics.average_cpc
  FROM campaign
  WHERE campaign.id = ${campaignId}
    AND segments.date BETWEEN '${from}' AND '${to}'
  `.trim()
}

function buildDiagnosticsQuery(campaignId: string): string {
  return `
  SELECT
    campaign.id,
    campaign.serving_status,
    campaign.bidding_strategy_type,
    campaign_budget.amount_micros,
    campaign_budget.explicitly_shared
  FROM campaign
  WHERE campaign.id = ${campaignId}
  LIMIT 1
  `.trim()
}

function buildAdStrengthQuery(campaignId: string): string {
  return `
  SELECT
    ad_group_ad.ad.responsive_search_ad.headlines,
    ad_group_ad.ad.responsive_search_ad.descriptions,
    ad_group_ad.ad.type,
    ad_group_ad.policy_summary.approval_status
  FROM ad_group_ad
  WHERE campaign.id = ${campaignId}
    AND ad_group_ad.status != 'REMOVED'
  LIMIT 50
  `.trim()
}

export async function GET(req: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const ctx = await getGoogleAdsContext()
    const campaignId = params.campaignId

    const { searchParams } = new URL(req.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const { from, to } = fromParam && toParam
      ? { from: fromParam, to: toParam }
      : getDefaultDateRange()

    const [metricsRows, diagRows, adRows] = await Promise.all([
      searchGAds<any>(ctx, buildDetailQuery(campaignId, from, to)),
      searchGAds<any>(ctx, buildDiagnosticsQuery(campaignId)),
      searchGAds<any>(ctx, buildAdStrengthQuery(campaignId)).catch(() => []),
    ])

    // Aggregate metrics across date segments
    let impressions = 0, clicks = 0, costMicros = 0, conversions = 0, conversionsValue = 0
    let campaignName = ''
    let status = ''
    let optScore: number | null = null
    let budgetMicros: number | null = null

    for (const r of metricsRows) {
      const c = r.campaign
      const m = r.metrics
      if (!campaignName && c?.name) campaignName = c.name
      if (!status && c?.status) status = c.status
      if (optScore === null) {
        const raw = c?.optimizationScore ?? c?.optimization_score
        if (raw != null && Number.isFinite(Number(raw))) {
          optScore = Number(raw) <= 1 ? Number(raw) * 100 : Number(raw)
        }
      }
      const cb = r.campaignBudget ?? r.campaign_budget
      if (budgetMicros === null && cb) {
        const bm = cb.amountMicros ?? cb.amount_micros
        if (bm != null) budgetMicros = Number(bm)
      }
      impressions += num(m?.impressions)
      clicks += num(m?.clicks)
      costMicros += num(m?.costMicros ?? m?.cost_micros)
      conversions += num(m?.conversions)
      conversionsValue += num(m?.conversions_value ?? m?.conversionsValue)
    }

    const derived = computeDerivedMetrics({ costMicros, clicks, impressions, conversionsValue })

    // Diagnostics from non-date-segmented query
    const diag = diagRows[0]
    const diagCampaign = diag?.campaign
    const diagBudget = diag?.campaignBudget ?? diag?.campaign_budget
    const servingStatus = diagCampaign?.servingStatus ?? diagCampaign?.serving_status ?? 'UNKNOWN'
    const biddingStrategyType = diagCampaign?.biddingStrategyType ?? diagCampaign?.bidding_strategy_type ?? 'UNKNOWN'
    const budgetShared = diagBudget?.explicitlyShared ?? diagBudget?.explicitly_shared ?? false

    // Ad diagnostics
    let totalAds = 0
    let disapprovedAds = 0
    let lowAssetAds = 0
    for (const row of adRows) {
      const ad = row.adGroupAd ?? row.ad_group_ad
      if (!ad) continue
      totalAds++
      const approvalStatus = ad.policySummary?.approvalStatus ?? ad.policy_summary?.approval_status
      if (approvalStatus === 'DISAPPROVED' || approvalStatus === 'AREA_OF_INTEREST_ONLY') {
        disapprovedAds++
      }
      const rsa = ad.ad?.responsiveSearchAd ?? ad.ad?.responsive_search_ad
      if (rsa) {
        const headlines = Array.isArray(rsa.headlines) ? rsa.headlines.length : 0
        const descriptions = Array.isArray(rsa.descriptions) ? rsa.descriptions.length : 0
        if (headlines < 3 || descriptions < 2) lowAssetAds++
      }
    }

    // Build diagnostics signals
    const diagnostics: Array<{ type: 'warning' | 'info' | 'error'; code: string; message: string }> = []

    if (servingStatus === 'ENDED') {
      diagnostics.push({ type: 'info', code: 'campaign_ended', message: 'Kampanya sona erdi.' })
    } else if (servingStatus === 'PENDING') {
      diagnostics.push({ type: 'info', code: 'campaign_pending', message: 'Kampanya henüz başlamadı.' })
    } else if (servingStatus === 'SUSPENDED') {
      diagnostics.push({ type: 'error', code: 'campaign_suspended', message: 'Kampanya askıya alındı.' })
    }

    // Budget limited heuristic: if spend >= 90% of daily budget over the period
    if (budgetMicros != null && budgetMicros > 0) {
      const days = Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000))
      const totalBudgetMicros = budgetMicros * days
      if (costMicros > 0 && costMicros >= totalBudgetMicros * 0.9) {
        diagnostics.push({ type: 'warning', code: 'budget_limited', message: 'Kampanya bütçe sınırına yakın çalışıyor.' })
      }
    }

    if (disapprovedAds > 0) {
      diagnostics.push({ type: 'error', code: 'ads_disapproved', message: `${disapprovedAds} reklam onaylanmadı.` })
    }

    if (lowAssetAds > 0) {
      diagnostics.push({ type: 'warning', code: 'low_assets', message: `${lowAssetAds} reklam yetersiz başlık/açıklama içeriyor.` })
    }

    if (conversions === 0 && clicks > 50) {
      diagnostics.push({ type: 'warning', code: 'no_conversions', message: 'Tıklama var ama dönüşüm takibi sıfır — dönüşüm etiketini kontrol edin.' })
    }

    return NextResponse.json({
      campaign: {
        id: campaignId,
        name: campaignName,
        status,
        servingStatus,
        biddingStrategyType,
        optimizationScore: optScore,
        budget: budgetMicros != null ? microsToUnits(budgetMicros) : null,
        budgetShared,
      },
      metrics: {
        impressions,
        clicks,
        cost: derived.amountSpent,
        conversions,
        conversionsValue,
        ctr: derived.ctr,
        cpc: derived.cpc,
        roas: derived.roas,
      },
      diagnostics,
      adSummary: { totalAds, disapprovedAds, lowAssetAds },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const { error, message, status } = normalizeError(e, 'campaign_detail_failed', 500)
    return NextResponse.json({ error, message }, { status })
  }
}
