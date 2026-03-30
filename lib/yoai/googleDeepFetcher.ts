/* ──────────────────────────────────────────────────────────
   Google Ads Deep Fetcher — hierarchical campaign+adgroup+ad data
   ────────────────────────────────────────────────────────── */

import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { computeDerivedMetrics } from '@/lib/google-ads/helpers'
import { runGoogleRuleEngine, type GoogleRuleContext } from './googleRuleEngine'
import type { DeepCampaignInsight, AdsetInsight, AdInsight, StandardMetrics, GoogleProblemTag } from './analysisTypes'
import type { ProblemTag } from '@/lib/meta/optimization/types'

const MAX_CAMPAIGNS = 15

/* ── Helpers ── */
function microsToUnits(micros: string | number | undefined): number {
  return micros != null ? Number(micros) / 1_000_000 : 0
}

function num(v: string | number | undefined): number {
  return Number(v ?? 0) || 0
}

function googleProblemToMeta(gp: GoogleProblemTag): ProblemTag {
  // Map Google problem tags to Meta format for unified rendering
  const metaIdMap: Record<string, string> = {
    NO_DELIVERY: 'NO_DELIVERY',
    INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
    LOW_CTR: 'LOW_CTR',
    HIGH_CPC: 'HIGH_CPC',
    LOW_CONVERSIONS: 'HIGH_CPA',
    LOW_ROAS: 'LOW_ROAS',
    LOW_QUALITY_SCORE: 'QUALITY_BELOW_AVERAGE',
    IMPRESSION_SHARE_BUDGET_LOST: 'BUDGET_UNDERUTILIZED',
    IMPRESSION_SHARE_RANK_LOST: 'LOW_CTR',
    AD_GROUP_IMBALANCE: 'ADSET_IMBALANCE',
    SINGLE_AD_GROUP_RISK: 'SINGLE_ADSET_RISK',
    LOW_OPT_SCORE: 'QUALITY_BELOW_AVERAGE',
  }
  return {
    id: (metaIdMap[gp.id] || 'LOW_CTR') as ProblemTag['id'],
    severity: gp.severity,
    evidence: gp.evidence,
  }
}

function scoreFromProblems(problems: GoogleProblemTag[], metrics: StandardMetrics): number {
  let score = 100
  for (const p of problems) {
    if (p.severity === 'critical') score -= 25
    else if (p.severity === 'warning') score -= 10
    else score -= 3
  }
  // Bonus for good CTR
  if (metrics.ctr > 5) score += 5
  // Bonus for conversions
  if (metrics.conversions > 10) score += 5
  return Math.max(0, Math.min(100, score))
}

function scoreToRisk(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 75) return 'low'
  if (score >= 50) return 'medium'
  if (score >= 25) return 'high'
  return 'critical'
}

/* ── Types for GAQL rows ── */
type CampaignRow = {
  campaign?: { id?: string; name?: string; status?: string; advertisingChannelType?: string; advertising_channel_type?: string; biddingStrategyType?: string; bidding_strategy_type?: string; optimizationScore?: number; optimization_score?: number; campaignBudget?: string; campaign_budget?: string }
  campaignBudget?: { amountMicros?: string; amount_micros?: string }
  campaign_budget?: { amountMicros?: string; amount_micros?: string }
  metrics?: Record<string, string | number | undefined>
}

type AdGroupRow = {
  adGroup?: { id?: string; name?: string; status?: string; cpcBidMicros?: string; cpc_bid_micros?: string }
  ad_group?: { id?: string; name?: string; status?: string; cpcBidMicros?: string; cpc_bid_micros?: string }
  campaign?: { id?: string }
  metrics?: Record<string, string | number | undefined>
}

type AdRow = {
  adGroupAd?: { ad?: { id?: string; name?: string; type?: string }; status?: string }
  ad_group_ad?: { ad?: { id?: string; name?: string; type?: string }; status?: string }
  adGroup?: { id?: string }
  ad_group?: { id?: string }
  campaign?: { id?: string }
  metrics?: Record<string, string | number | undefined>
}

/* ── Main Fetch ── */
export async function fetchGoogleDeep(userId?: string): Promise<{ campaigns: DeepCampaignInsight[]; errors: string[]; connected: boolean }> {
  const errors: string[] = []
  const campaigns: DeepCampaignInsight[] = []

  let googleCtx
  try {
    // 1) Try cookie-based context first (works in browser, includes DB backfill)
    googleCtx = await getGoogleAdsContext()
  } catch (e) {
    // 2) Cookie-based failed (cron context or no session) — try DB lookup
    if (userId) {
      try {
        const { getConnection } = await import('@/lib/googleAdsConnectionStore')
        const { getGoogleAdsAccessToken } = await import('@/lib/googleAdsAuth')
        const dbCtx = await getConnection(userId)
        if (dbCtx?.refreshToken && dbCtx?.customerId) {
          const accessToken = await getGoogleAdsAccessToken(dbCtx.refreshToken)
          googleCtx = { accessToken, customerId: dbCtx.customerId, loginCustomerId: dbCtx.loginCustomerId, locale: 'tr' }
        }
      } catch (dbErr) {
        console.error('[GoogleDeepFetcher] DB fallback error:', dbErr)
      }
    }
    if (!googleCtx) {
      const err = e as { code?: string }
      if (err?.code === 'google_ads_not_connected') {
        return { campaigns, errors: [], connected: false }
      }
      return { campaigns, errors: ['Google Ads bağlantı hatası'], connected: false }
    }
  }

  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  const from = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)

  try {
    // 1. Fetch campaigns
    const campaignQuery = `
      SELECT campaign.id, campaign.name, campaign.status,
        campaign.advertising_channel_type, campaign.bidding_strategy_type,
        campaign.optimization_score, campaign.campaign_budget,
        campaign_budget.amount_micros,
        metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr,
        metrics.average_cpc, metrics.conversions, metrics.conversions_value,
        metrics.search_impression_share, metrics.search_budget_lost_impression_share,
        metrics.search_rank_lost_impression_share
      FROM campaign
      WHERE segments.date BETWEEN '${from}' AND '${to}'
        AND campaign.status = 'ENABLED'
      ORDER BY metrics.cost_micros DESC
      LIMIT ${MAX_CAMPAIGNS}
    `.trim()

    const campaignRows = await searchGAds<CampaignRow>(googleCtx, campaignQuery)

    // Aggregate by campaign ID
    const campaignMap = new Map<string, {
      id: string; name: string; status: string; channelType: string; biddingStrategy: string
      optScore: number | null; budgetMicros: number | null
      impressions: number; clicks: number; costMicros: number; conversions: number; conversionsValue: number
      impressionShareBudgetLost: number | null; impressionShareRankLost: number | null
    }>()

    for (const r of campaignRows) {
      const c = r.campaign
      const m = r.metrics
      const cb = r.campaignBudget ?? r.campaign_budget
      const id = c?.id ?? ''
      if (!id) continue

      const optRaw = c?.optimizationScore ?? c?.optimization_score
      const optScore = optRaw != null && Number.isFinite(Number(optRaw))
        ? Number(optRaw) <= 1 ? Number(optRaw) * 100 : Number(optRaw)
        : null

      const existing = campaignMap.get(id)
      if (existing) {
        existing.impressions += num(m?.impressions)
        existing.clicks += num(m?.clicks)
        existing.costMicros += num(m?.cost_micros ?? m?.costMicros)
        existing.conversions += num(m?.conversions)
        existing.conversionsValue += num(m?.conversions_value ?? m?.conversionsValue)
      } else {
        campaignMap.set(id, {
          id,
          name: c?.name ?? '',
          status: c?.status ?? 'UNKNOWN',
          channelType: c?.advertisingChannelType ?? c?.advertising_channel_type ?? 'SEARCH',
          biddingStrategy: c?.biddingStrategyType ?? c?.bidding_strategy_type ?? '',
          optScore,
          budgetMicros: cb?.amountMicros ?? cb?.amount_micros ? Number(cb?.amountMicros ?? cb?.amount_micros) : null,
          impressions: num(m?.impressions),
          clicks: num(m?.clicks),
          costMicros: num(m?.cost_micros ?? m?.costMicros),
          conversions: num(m?.conversions),
          conversionsValue: num(m?.conversions_value ?? m?.conversionsValue),
          impressionShareBudgetLost: m?.search_budget_lost_impression_share != null ? num(m.search_budget_lost_impression_share) * 100 : null,
          impressionShareRankLost: m?.search_rank_lost_impression_share != null ? num(m.search_rank_lost_impression_share) * 100 : null,
        })
      }
    }

    // 2. Fetch ad groups
    const campaignIds = Array.from(campaignMap.keys())
    if (campaignIds.length === 0) return { campaigns, errors, connected: true }

    const adGroupQuery = `
      SELECT ad_group.id, ad_group.name, ad_group.status,
        ad_group.cpc_bid_micros, campaign.id,
        metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr,
        metrics.average_cpc, metrics.conversions, metrics.conversions_value
      FROM ad_group
      WHERE segments.date BETWEEN '${from}' AND '${to}'
        AND ad_group.status = 'ENABLED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 200
    `.trim()

    const adGroupRows = await searchGAds<AdGroupRow>(googleCtx, adGroupQuery)

    // Group ad groups by campaign
    const adGroupsByCampaign = new Map<string, Map<string, { id: string; name: string; status: string; impressions: number; clicks: number; costMicros: number; conversions: number; conversionsValue: number }>>()

    for (const r of adGroupRows) {
      const ag = r.adGroup ?? r.ad_group
      const m = r.metrics
      const cId = r.campaign?.id ?? ''
      const agId = ag?.id ?? ''
      if (!cId || !agId) continue

      if (!adGroupsByCampaign.has(cId)) adGroupsByCampaign.set(cId, new Map())
      const map = adGroupsByCampaign.get(cId)!
      const existing = map.get(agId)
      if (existing) {
        existing.impressions += num(m?.impressions)
        existing.clicks += num(m?.clicks)
        existing.costMicros += num(m?.cost_micros ?? m?.costMicros)
        existing.conversions += num(m?.conversions)
        existing.conversionsValue += num(m?.conversions_value ?? m?.conversionsValue)
      } else {
        map.set(agId, {
          id: agId,
          name: ag?.name ?? '',
          status: ag?.status ?? 'UNKNOWN',
          impressions: num(m?.impressions),
          clicks: num(m?.clicks),
          costMicros: num(m?.cost_micros ?? m?.costMicros),
          conversions: num(m?.conversions),
          conversionsValue: num(m?.conversions_value ?? m?.conversionsValue),
        })
      }
    }

    // 3. Fetch ads
    const adQuery = `
      SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type,
        ad_group_ad.status, ad_group.id, campaign.id,
        metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr,
        metrics.average_cpc, metrics.conversions, metrics.conversions_value
      FROM ad_group_ad
      WHERE segments.date BETWEEN '${from}' AND '${to}'
        AND ad_group_ad.status = 'ENABLED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 300
    `.trim()

    const adRows = await searchGAds<AdRow>(googleCtx, adQuery)

    // Group ads by ad group
    const adsByAdGroup = new Map<string, AdInsight[]>()

    for (const r of adRows) {
      const adGroupAd = r.adGroupAd ?? r.ad_group_ad
      const ad = adGroupAd?.ad
      const agId = (r.adGroup ?? r.ad_group)?.id ?? ''
      const m = r.metrics
      if (!agId || !ad?.id) continue

      const amountSpent = microsToUnits(m?.cost_micros ?? m?.costMicros)
      const clicks = num(m?.clicks)
      const impressions = num(m?.impressions)

      const adInsight: AdInsight = {
        id: ad.id,
        name: ad.name || `Ad ${ad.id}`,
        status: adGroupAd?.status ?? 'UNKNOWN',
        platform: 'Google',
        format: ad.type || undefined,
        metrics: {
          spend: amountSpent,
          impressions,
          clicks,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpc: clicks > 0 ? amountSpent / clicks : 0,
          conversions: num(m?.conversions),
          roas: amountSpent > 0 && num(m?.conversions_value ?? m?.conversionsValue) > 0
            ? num(m?.conversions_value ?? m?.conversionsValue) / amountSpent
            : null,
        },
      }

      if (!adsByAdGroup.has(agId)) adsByAdGroup.set(agId, [])
      adsByAdGroup.get(agId)!.push(adInsight)
    }

    // 4. Build campaign insights
    for (const [, agg] of campaignMap) {
      const { amountSpent, cpc, ctr, roas } = computeDerivedMetrics(agg)

      const metrics: StandardMetrics = {
        spend: amountSpent,
        impressions: agg.impressions,
        clicks: agg.clicks,
        ctr,
        cpc,
        conversions: agg.conversions,
        roas,
      }

      // Build adset insights (ad groups)
      const agMap = adGroupsByCampaign.get(agg.id) ?? new Map()
      const adsetInsights: AdsetInsight[] = Array.from(agMap.values()).map((ag) => {
        const agDerived = computeDerivedMetrics(ag)
        return {
          id: ag.id,
          name: ag.name || 'Unnamed Ad Group',
          status: ag.status,
          platform: 'Google' as const,
          dailyBudget: null,
          lifetimeBudget: null,
          metrics: {
            spend: agDerived.amountSpent,
            impressions: ag.impressions,
            clicks: ag.clicks,
            ctr: agDerived.ctr,
            cpc: agDerived.cpc,
            conversions: ag.conversions,
            roas: agDerived.roas,
          },
          ads: adsByAdGroup.get(ag.id) ?? [],
        }
      })

      // Run Google rule engine
      const ruleCtx: GoogleRuleContext = {
        metrics,
        adGroupCount: agMap.size,
        adCount: adsetInsights.reduce((sum, as) => sum + as.ads.length, 0),
        optimizationScore: agg.optScore,
        biddingStrategy: agg.biddingStrategy,
        channelType: agg.channelType,
        impressionShareBudgetLost: agg.impressionShareBudgetLost ?? undefined,
        impressionShareRankLost: agg.impressionShareRankLost ?? undefined,
        dailyBudget: agg.budgetMicros != null ? agg.budgetMicros / 1_000_000 : null,
        currency: 'TRY',
      }

      const googleProblems = runGoogleRuleEngine(ruleCtx)
      const problemTags = googleProblems.map(googleProblemToMeta)
      const score = scoreFromProblems(googleProblems, metrics)

      campaigns.push({
        id: agg.id,
        platform: 'Google',
        campaignName: agg.name || 'Unnamed Campaign',
        status: agg.status,
        objective: agg.channelType,
        metrics,
        problemTags,
        score,
        riskLevel: scoreToRisk(score),
        adsets: adsetInsights,
        dailyBudget: agg.budgetMicros != null ? agg.budgetMicros / 1_000_000 : null,
        lifetimeBudget: null,
        currency: 'TRY',
        channelType: agg.channelType,
        biddingStrategy: agg.biddingStrategy,
        optimizationScore: agg.optScore,
      })
    }
  } catch (e) {
    console.error('[GoogleDeepFetcher] Error:', e)
    errors.push('Google Ads veri çekme hatası')
  }

  campaigns.sort((a, b) => b.metrics.spend - a.metrics.spend)

  return { campaigns, errors, connected: true }
}
