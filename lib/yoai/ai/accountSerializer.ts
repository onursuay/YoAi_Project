/* ──────────────────────────────────────────────────────────
   YoAlgoritma AI Engine — Account Data Serializer

   Single-pass (Batch API uyumlu) mod için hesap verisini Claude'a
   tek prompt'ta verilecek şekilde structured JSON formatına dönüştürür.
   Agentic loop sırasındaki tool çıktılarıyla aynı şekli korur ki
   Claude için kavramsal sürekliliği bozulmasın.
   ────────────────────────────────────────────────────────── */

import type { DeepCampaignInsight, AdsetInsight, AdInsight } from '@/lib/yoai/analysisTypes'
import type { AiPlatform } from './types'

export interface BenchmarkRule {
  good: number
  warn: number
  bad: number
  direction: 'higher_better' | 'lower_better'
}

export const BENCHMARKS: Record<string, BenchmarkRule> = {
  ctr:              { good: 2.0, warn: 1.0, bad: 0.5, direction: 'higher_better' },
  roas:             { good: 4.0, warn: 2.0, bad: 1.0, direction: 'higher_better' },
  conversion_rate:  { good: 5.0, warn: 2.0, bad: 1.0, direction: 'higher_better' },
  impression_share: { good: 80,  warn: 50,  bad: 30,  direction: 'higher_better' },
  cpc:              { good: 5,   warn: 15,  bad: 30,  direction: 'lower_better' },
  cpa:              { good: 50,  warn: 150, bad: 300, direction: 'lower_better' },
  frequency:        { good: 2.0, warn: 4.0, bad: 6.0, direction: 'lower_better' },
}

function round(n: number, d: number): number {
  if (!Number.isFinite(n)) return 0
  const f = Math.pow(10, d)
  return Math.round(n * f) / f
}

export function buildAccountOverview(
  platform: AiPlatform,
  accountId: string,
  campaigns: DeepCampaignInsight[],
  industry?: string,
) {
  const active = campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED')
  let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalConversions = 0
  let weightedRoas = 0, roasSpendTotal = 0
  for (const c of campaigns) {
    const m = c.metrics
    totalSpend += m.spend
    totalImpressions += m.impressions
    totalClicks += m.clicks
    totalConversions += m.conversions
    if (m.roas != null && m.spend > 0) {
      weightedRoas += m.roas * m.spend
      roasSpendTotal += m.spend
    }
  }
  return {
    platform,
    account_id: accountId,
    campaigns_total: campaigns.length,
    campaigns_active: active.length,
    spend_total: round(totalSpend, 2),
    impressions_total: totalImpressions,
    clicks_total: totalClicks,
    conversions_total: round(totalConversions, 2),
    ctr_weighted: totalImpressions > 0 ? round((totalClicks / totalImpressions) * 100, 3) : 0,
    cpc_weighted: totalClicks > 0 ? round(totalSpend / totalClicks, 2) : 0,
    roas_weighted: roasSpendTotal > 0 ? round(weightedRoas / roasSpendTotal, 3) : null,
    risk_distribution: {
      critical: campaigns.filter(c => c.riskLevel === 'critical').length,
      high:     campaigns.filter(c => c.riskLevel === 'high').length,
      medium:   campaigns.filter(c => c.riskLevel === 'medium').length,
      low:      campaigns.filter(c => c.riskLevel === 'low').length,
    },
    currency: campaigns[0]?.currency ?? 'TRY',
    industry: industry ?? null,
  }
}

export function buildCampaignsDetail(campaigns: DeepCampaignInsight[]) {
  return campaigns.map(c => ({
    id: c.id,
    name: c.campaignName,
    platform: c.platform,
    status: c.status,
    effective_status: c.effectiveStatus,
    objective: c.objective,
    score: c.score,
    risk_level: c.riskLevel,
    daily_budget: c.dailyBudget,
    lifetime_budget: c.lifetimeBudget,
    currency: c.currency,
    metrics: c.metrics,
    period_comparison: c.periodComparison,
    problem_tags: c.problemTags?.map(t => ({ id: t.id, severity: t.severity, evidence: t.evidence })) ?? [],
    channel_type: c.channelType,
    bidding_strategy: c.biddingStrategy,
    campaign_type_intelligence: c.campaignTypeIntelligence ? {
      doctrine_name: c.campaignTypeIntelligence.doctrineName,
      fit_score: c.campaignTypeIntelligence.doctrineFitScore,
      fit_severity: c.campaignTypeIntelligence.doctrineFitSeverity,
      matched_principles: c.campaignTypeIntelligence.matchedPrinciples,
      failure_signals: c.campaignTypeIntelligence.failureSignals,
    } : null,
    adsets: c.adsets.map((a: AdsetInsight) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      optimization_goal: a.optimizationGoal,
      destination_type: a.destinationType,
      daily_budget: a.dailyBudget,
      lifetime_budget: a.lifetimeBudget,
      metrics: a.metrics,
      ads: a.ads.map((ad: AdInsight) => ({
        id: ad.id,
        name: ad.name,
        status: ad.status,
        format: ad.format,
        quality_ranking: ad.qualityRanking,
        engagement_rate_ranking: ad.engagementRateRanking,
        conversion_rate_ranking: ad.conversionRateRanking,
        metrics: ad.metrics,
        creative_title: ad.creativeTitle,
        creative_body: ad.creativeBody,
        call_to_action: ad.callToActionType,
        link_url: ad.linkUrl,
      })),
    })),
  }))
}
