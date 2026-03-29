/* ──────────────────────────────────────────────────────────
   Deep Analysis Orchestrator
   Fetches data from both platforms in parallel,
   runs deterministic analysis, then AI summarization.
   ────────────────────────────────────────────────────────── */

import { fetchMetaDeep } from './metaDeepFetcher'
import { fetchGoogleDeep } from './googleDeepFetcher'
import { summarizeWithAI } from './aiAnalysisSummarizer'
import type {
  DeepAnalysisResult,
  DeepCampaignInsight,
  AggregatedKpis,
  Platform,
  StandardMetrics,
  PeriodComparison,
} from './analysisTypes'

/* ── Aggregate KPIs across all campaigns ── */
function aggregateKpis(campaigns: DeepCampaignInsight[]): AggregatedKpis {
  let totalSpend = 0
  let totalImpressions = 0
  let totalClicks = 0
  let totalConversions = 0
  let totalRoasWeighted = 0
  let totalRoasSpend = 0

  const platformMap = new Map<Platform, { spend: number; impressions: number; clicks: number; conversions: number; count: number }>()

  for (const c of campaigns) {
    const m = c.metrics
    totalSpend += m.spend
    totalImpressions += m.impressions
    totalClicks += m.clicks
    totalConversions += m.conversions
    if (m.roas != null && m.spend > 0) {
      totalRoasWeighted += m.roas * m.spend
      totalRoasSpend += m.spend
    }

    const p = platformMap.get(c.platform) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, count: 0 }
    p.spend += m.spend
    p.impressions += m.impressions
    p.clicks += m.clicks
    p.conversions += m.conversions
    p.count += 1
    platformMap.set(c.platform, p)
  }

  const activeCampaigns = campaigns.filter(c =>
    c.status === 'ACTIVE' || c.status === 'ENABLED'
  ).length

  return {
    totalSpend,
    totalImpressions,
    totalClicks,
    totalConversions,
    weightedCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    weightedCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    avgRoas: totalRoasSpend > 0 ? totalRoasWeighted / totalRoasSpend : null,
    activeCampaigns,
    platformBreakdown: Array.from(platformMap.entries()).map(([platform, data]) => ({
      platform,
      spend: data.spend,
      impressions: data.impressions,
      clicks: data.clicks,
      conversions: data.conversions,
      campaignCount: data.count,
    })),
  }
}

/* ── Main Orchestrator ── */
export async function runDeepAnalysis(): Promise<DeepAnalysisResult> {
  const errors: string[] = []
  const connectedPlatforms: Platform[] = []

  // 1. Fetch data from both platforms in parallel
  const [metaResult, googleResult] = await Promise.all([
    fetchMetaDeep().catch(e => {
      console.error('[DeepAnalysis] Meta fetch failed:', e)
      return { campaigns: [] as DeepCampaignInsight[], errors: ['Meta veri çekme hatası'] }
    }),
    fetchGoogleDeep().catch(e => {
      console.error('[DeepAnalysis] Google fetch failed:', e)
      return { campaigns: [] as DeepCampaignInsight[], errors: ['Google Ads veri çekme hatası'] }
    }),
  ])

  errors.push(...metaResult.errors, ...googleResult.errors)

  if (metaResult.campaigns.length > 0) connectedPlatforms.push('Meta')
  if (googleResult.campaigns.length > 0) connectedPlatforms.push('Google')

  // 2. Combine campaigns, sort by spend
  const allCampaigns = [...metaResult.campaigns, ...googleResult.campaigns]
    .sort((a, b) => b.metrics.spend - a.metrics.spend)

  // 3. Aggregate KPIs
  const kpis = aggregateKpis(allCampaigns)

  // 4. Run AI summarization (on top campaigns only, to limit tokens)
  const topCampaigns = allCampaigns.slice(0, 15)
  const aiResult = await summarizeWithAI(topCampaigns)

  // 5. Merge AI summaries back into campaign insights
  // (summaries are separate for rendering flexibility)

  return {
    campaigns: allCampaigns,
    kpis,
    aiSummaries: aiResult.summaries,
    actions: aiResult.actions,
    drafts: aiResult.drafts,
    lastAnalysis: new Date().toISOString(),
    aiGenerated: aiResult.aiGenerated,
    errors,
    connectedPlatforms,
  }
}
