/* ──────────────────────────────────────────────────────────
   Meta Deep Fetcher — hierarchical campaign+adset+ad data
   Uses existing optimization engine for scoring & analysis.
   ────────────────────────────────────────────────────────── */

import { resolveMetaContext } from '@/lib/meta/context'
import { metaGraphFetch } from '@/lib/metaGraph'
import { normalizeInsights } from '@/lib/meta/optimization/insightsNormalizer'
import { runRuleEngine, type RuleContext } from '@/lib/meta/optimization/ruleEngine'
import { scoreCampaign } from '@/lib/meta/optimization/scoring'
import { resolveKpiTemplate } from '@/lib/meta/optimization/kpiRegistry'
import type { CampaignTriple, OptimizationAdset } from '@/lib/meta/optimization/types'
import type { DeepCampaignInsight, AdsetInsight, AdInsight, StandardMetrics } from './analysisTypes'

const MAX_CAMPAIGNS = 15

/* ── Helpers ── */
function toStdMetrics(n: ReturnType<typeof normalizeInsights>): StandardMetrics {
  const conversions = (n.actions['purchase'] ?? 0) +
    (n.actions['lead'] ?? 0) +
    (n.actions['offsite_conversion.fb_pixel_purchase'] ?? 0) +
    (n.actions['offsite_conversion.fb_pixel_lead'] ?? 0)
  return {
    spend: n.spend,
    impressions: n.impressions,
    clicks: n.clicks,
    ctr: n.ctr,
    cpc: n.cpc,
    conversions,
    roas: n.websitePurchaseRoas > 0 ? n.websitePurchaseRoas : null,
    reach: n.reach,
    frequency: n.frequency,
    cpm: n.cpm,
  }
}

function resolveTriple(campaign: any, adsets: any[]): CampaignTriple {
  const objective = campaign.objective || 'OUTCOME_TRAFFIC'
  const firstAdset = adsets[0]
  return {
    objective,
    optimizationGoal: firstAdset?.optimization_goal || 'LINK_CLICKS',
    destination: firstAdset?.destination_type || 'WEBSITE',
  }
}

function scoreToRisk(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 75) return 'low'
  if (score >= 50) return 'medium'
  if (score >= 25) return 'high'
  return 'critical'
}

/* ── Main Fetch ── */
export async function fetchMetaDeep(): Promise<{ campaigns: DeepCampaignInsight[]; errors: string[] }> {
  const errors: string[] = []
  const campaigns: DeepCampaignInsight[] = []

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return { campaigns, errors: ['Meta bağlantısı bulunamadı'] }
  }

  try {
    // 1. Fetch campaigns with inline adset + ad insights (nested expansion)
    const insightsFields = 'spend,impressions,clicks,ctr,cpc,reach,frequency,cpm,actions,action_values,cost_per_action_type,purchase_roas,quality_ranking,engagement_rate_ranking,conversion_rate_ranking'
    const adFields = `id,name,status,effective_status,insights.date_preset(last_7d){${insightsFields}}`
    const adsetFields = `id,name,status,optimization_goal,destination_type,daily_budget,lifetime_budget,insights.date_preset(last_7d){${insightsFields}},ads.limit(20){${adFields}}`
    const campaignFields = `id,name,status,effective_status,objective,daily_budget,lifetime_budget,insights.date_preset(last_7d){${insightsFields}},adsets.limit(30){${adsetFields}}`

    const params: Record<string, string> = {
      fields: campaignFields,
      limit: String(MAX_CAMPAIGNS),
      effective_status: '["ACTIVE","PAUSED","WITH_ISSUES"]',
    }

    const response = await metaGraphFetch(
      `/${ctx.accountId}/campaigns`,
      ctx.userAccessToken,
      { params },
    )

    if (!response.ok) {
      errors.push('Meta kampanya verisi alınamadı')
      return { campaigns, errors }
    }

    const data = await response.json().catch(() => ({ data: [] }))
    const rawCampaigns = data.data || []

    // 2. Process each campaign
    for (const raw of rawCampaigns) {
      const rawAdsets = raw.adsets?.data || []
      const campaignInsightRaw = raw.insights?.data?.[0]
      const normalizedCampaignInsights = normalizeInsights(campaignInsightRaw)
      const triple = resolveTriple(raw, rawAdsets)
      const kpiTemplate = resolveKpiTemplate(triple)

      // Build OptimizationAdset[] for rule engine
      const optAdsets: OptimizationAdset[] = rawAdsets.map((as: any) => {
        const asInsightRaw = as.insights?.data?.[0]
        return {
          id: as.id,
          name: as.name || 'Unnamed',
          status: as.status || 'UNKNOWN',
          optimizationGoal: as.optimization_goal || '',
          destinationType: as.destination_type || '',
          dailyBudget: as.daily_budget != null ? parseFloat(as.daily_budget) / 100 : null,
          lifetimeBudget: as.lifetime_budget != null ? parseFloat(as.lifetime_budget) / 100 : null,
          insights: normalizeInsights(asInsightRaw),
        }
      })

      // Run rule engine
      const dailyBudget = raw.daily_budget != null ? parseFloat(raw.daily_budget) / 100 : null
      const lifetimeBudget = raw.lifetime_budget != null ? parseFloat(raw.lifetime_budget) / 100 : null

      const ruleCtx: RuleContext = {
        insights: normalizedCampaignInsights,
        template: kpiTemplate,
        triple,
        adsets: optAdsets,
        dailyBudget,
        lifetimeBudget,
        campaignStatus: raw.effective_status || raw.status,
        currency: 'TRY',
      }

      const problemTags = runRuleEngine(ruleCtx)
      const scoreResult = scoreCampaign(normalizedCampaignInsights, kpiTemplate)
      const score = scoreResult.score

      // Build adset insights with ad-level data
      const adsetInsights: AdsetInsight[] = rawAdsets.map((as: any) => {
        const asInsightRaw = as.insights?.data?.[0]
        const asNorm = normalizeInsights(asInsightRaw)
        const rawAds = as.ads?.data || []

        const adInsights: AdInsight[] = rawAds.map((ad: any) => {
          const adInsightRaw = ad.insights?.data?.[0]
          const adNorm = normalizeInsights(adInsightRaw)
          return {
            id: ad.id,
            name: ad.name || 'Unnamed Ad',
            status: ad.effective_status || ad.status || 'UNKNOWN',
            platform: 'Meta' as const,
            metrics: toStdMetrics(adNorm),
            qualityRanking: adNorm.qualityRanking || undefined,
            engagementRateRanking: adNorm.engagementRateRanking || undefined,
            conversionRateRanking: adNorm.conversionRateRanking || undefined,
          }
        })

        return {
          id: as.id,
          name: as.name || 'Unnamed Adset',
          status: as.status || 'UNKNOWN',
          platform: 'Meta' as const,
          optimizationGoal: as.optimization_goal || '',
          destinationType: as.destination_type || '',
          dailyBudget: as.daily_budget != null ? parseFloat(as.daily_budget) / 100 : null,
          lifetimeBudget: as.lifetime_budget != null ? parseFloat(as.lifetime_budget) / 100 : null,
          metrics: toStdMetrics(asNorm),
          ads: adInsights,
        }
      })

      campaigns.push({
        id: raw.id,
        platform: 'Meta',
        campaignName: raw.name || 'Unnamed Campaign',
        status: raw.status || 'UNKNOWN',
        effectiveStatus: raw.effective_status,
        objective: raw.objective || '',
        triple,
        normalizedInsights: normalizedCampaignInsights,
        scoreResult,
        metrics: toStdMetrics(normalizedCampaignInsights),
        problemTags,
        score,
        riskLevel: scoreToRisk(score),
        adsets: adsetInsights,
        dailyBudget,
        lifetimeBudget,
        currency: 'TRY',
      })
    }
  } catch (e) {
    console.error('[MetaDeepFetcher] Error:', e)
    errors.push('Meta veri çekme hatası')
  }

  // Sort by spend descending
  campaigns.sort((a, b) => b.metrics.spend - a.metrics.spend)

  return { campaigns, errors }
}
