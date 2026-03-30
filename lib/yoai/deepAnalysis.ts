/* ──────────────────────────────────────────────────────────
   Deep Analysis Orchestrator
   Fetches data from both platforms in parallel,
   runs deterministic analysis, then AI summarization.
   ────────────────────────────────────────────────────────── */

import { fetchMetaDeep } from './metaDeepFetcher'
import { fetchGoogleDeep } from './googleDeepFetcher'
import { summarizeWithAI } from './aiAnalysisSummarizer'
import { runStructuralAnalysis } from './platformKnowledge'
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
      return { campaigns: [] as DeepCampaignInsight[], errors: ['Meta veri çekme hatası'], connected: false }
    }),
    fetchGoogleDeep().catch(e => {
      console.error('[DeepAnalysis] Google fetch failed:', e)
      return { campaigns: [] as DeepCampaignInsight[], errors: ['Google Ads veri çekme hatası'], connected: false }
    }),
  ])

  errors.push(...metaResult.errors, ...googleResult.errors)

  // Use connection status (has credentials), not campaign count.
  // Old logic: campaigns.length > 0 → missed platforms with 0 active campaigns.
  if (metaResult.connected) connectedPlatforms.push('Meta')
  if (googleResult.connected) connectedPlatforms.push('Google')

  // 2. Combine campaigns, sort by spend
  const allCampaigns = [...metaResult.campaigns, ...googleResult.campaigns]
    .sort((a, b) => b.metrics.spend - a.metrics.spend)

  // 3. Aggregate KPIs
  const kpis = aggregateKpis(allCampaigns)

  // 4. Run structural analysis (objective, bidding, destination mismatches)
  const structuralAnalysis = runStructuralAnalysis(allCampaigns)

  // 5. Run AI summarization (includes structural issues in context)
  const topCampaigns = allCampaigns.slice(0, 15)
  const aiResult = await summarizeWithAI(topCampaigns)

  // 6. Merge structural issues into actions
  const structuralActions = structuralAnalysis.issues.map((issue, i) => ({
    id: `structural_${i}`,
    title: issue.title,
    reason: issue.description,
    expectedImpact: `${issue.currentValue} → ${issue.recommendedValue}`,
    requiresApproval: true,
    priority: issue.severity === 'critical' ? 'high' as const : issue.severity === 'warning' ? 'medium' as const : 'low' as const,
    campaignName: issue.campaignName,
    campaignId: issue.campaignId,
    platform: issue.platform,
    targetEntityType: 'campaign' as const,
    targetEntityId: issue.campaignId,
    actionType: issue.category,
  }))

  const allActions = [...structuralActions, ...aiResult.actions]

  return {
    campaigns: allCampaigns,
    kpis,
    aiSummaries: aiResult.summaries,
    actions: allActions,
    drafts: aiResult.drafts,
    structuralIssues: structuralAnalysis.issues,
    lastAnalysis: new Date().toISOString(),
    aiGenerated: aiResult.aiGenerated,
    errors,
    connectedPlatforms,
  }
}
