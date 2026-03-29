/* ──────────────────────────────────────────────────────────
   YoAi Deep Analysis — shared types for Phase 1
   ────────────────────────────────────────────────────────── */

import type { ProblemTag, NormalizedInsights, CampaignTriple, ScoreResult } from '@/lib/meta/optimization/types'

export type Platform = 'Meta' | 'Google'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type InsightStatus = 'monitoring' | 'review_needed' | 'ready_for_approval'

/* ── Standardized Metrics (cross-platform) ── */
export interface StandardMetrics {
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  conversions: number
  roas: number | null
  reach?: number
  frequency?: number
  cpm?: number
}

/* ── Period Comparison ── */
export interface PeriodComparison {
  current: StandardMetrics
  previous: StandardMetrics
  changes: {
    spend: number | null       // percentage change
    impressions: number | null
    clicks: number | null
    ctr: number | null
    cpc: number | null
    conversions: number | null
    roas: number | null
  }
}

/* ── Ad-Level Insight ── */
export interface AdInsight {
  id: string
  name: string
  status: string
  platform: Platform
  format?: string // single_image, video, carousel, responsive_search_ad, etc.
  metrics: StandardMetrics
  qualityRanking?: string
  engagementRateRanking?: string
  conversionRateRanking?: string
}

/* ── Adset / Ad Group Level Insight ── */
export interface AdsetInsight {
  id: string
  name: string
  status: string
  platform: Platform
  optimizationGoal?: string
  destinationType?: string
  dailyBudget: number | null
  lifetimeBudget: number | null
  metrics: StandardMetrics
  ads: AdInsight[]
}

/* ── Campaign-Level Deep Insight ── */
export interface DeepCampaignInsight {
  id: string
  platform: Platform
  campaignName: string
  status: string
  effectiveStatus?: string
  objective: string
  // Meta-specific
  triple?: CampaignTriple
  normalizedInsights?: NormalizedInsights
  scoreResult?: ScoreResult
  // Universal
  metrics: StandardMetrics
  periodComparison?: PeriodComparison
  problemTags: ProblemTag[]
  score: number // 0-100
  riskLevel: RiskLevel
  adsets: AdsetInsight[]
  dailyBudget: number | null
  lifetimeBudget: number | null
  currency: string
  // Google-specific
  channelType?: string
  biddingStrategy?: string
  optimizationScore?: number | null
}

/* ── Google-Specific Problem Tags ── */
export type GoogleProblemTagId =
  | 'NO_DELIVERY'
  | 'INSUFFICIENT_DATA'
  | 'LOW_CTR'
  | 'HIGH_CPC'
  | 'LOW_CONVERSIONS'
  | 'LOW_ROAS'
  | 'LOW_QUALITY_SCORE'
  | 'IMPRESSION_SHARE_BUDGET_LOST'
  | 'IMPRESSION_SHARE_RANK_LOST'
  | 'AD_GROUP_IMBALANCE'
  | 'SINGLE_AD_GROUP_RISK'
  | 'LOW_OPT_SCORE'

export interface GoogleProblemTag {
  id: GoogleProblemTagId
  severity: 'critical' | 'warning' | 'info'
  evidence: Array<{
    metric: string
    value: number
    benchmark: number | null
    format: 'number' | 'currency' | 'percentage' | 'ratio'
    direction: 'above' | 'below' | 'neutral'
  }>
}

/* ── Cross-Platform Aggregated KPIs ── */
export interface AggregatedKpis {
  totalSpend: number
  totalImpressions: number
  totalClicks: number
  totalConversions: number
  weightedCtr: number
  weightedCpc: number
  avgRoas: number | null
  activeCampaigns: number
  platformBreakdown: {
    platform: Platform
    spend: number
    impressions: number
    clicks: number
    conversions: number
    campaignCount: number
  }[]
  periodComparison?: PeriodComparison
}

/* ── AI Summary (per campaign) ── */
export interface AISummary {
  campaignId: string
  summary: string          // Türkçe özet
  recommendation: string   // Türkçe öneri
  confidence: number       // 0-100
  insightStatus: InsightStatus
}

/* ── Recommended Action ── */
export interface DeepAction {
  id: string
  title: string
  reason: string
  expectedImpact: string
  requiresApproval: boolean
  priority: 'high' | 'medium' | 'low'
  campaignName: string
  campaignId: string
  platform: Platform
  targetEntityType: 'campaign' | 'adset' | 'ad_group' | 'ad'
  targetEntityId: string
  actionType: string // pause, increase_budget, decrease_budget, duplicate, refresh_creative
}

/* ── Action Draft (Approval Flow) ── */
export interface DeepActionDraft {
  id: string
  title: string
  description: string
  platform: string
  campaign: string
  campaignId: string
  createdAt: string
  type: 'budget' | 'creative' | 'targeting' | 'bid' | 'status'
  targetEntityType: string
  targetEntityId: string
}

/* ── Structural Issue (from platform knowledge engine) ── */
export interface StructuralIssue {
  id: string
  severity: 'critical' | 'warning' | 'info'
  category: string
  title: string
  description: string
  currentValue: string
  recommendedValue: string
  reasoning: string
  platform: Platform
  campaignId: string
  campaignName: string
}

/* ── Full Deep Analysis Result ── */
export interface DeepAnalysisResult {
  campaigns: DeepCampaignInsight[]
  kpis: AggregatedKpis
  aiSummaries: AISummary[]
  actions: DeepAction[]
  drafts: DeepActionDraft[]
  structuralIssues?: StructuralIssue[]
  lastAnalysis: string
  aiGenerated: boolean
  errors: string[]
  connectedPlatforms: Platform[]
}

/* ── Health Overview (enhanced) ── */
export interface DeepHealthOverview {
  connectedAccounts: { count: number; platforms: Platform[] }
  activeCampaigns: number
  totalAdsets: number
  totalAds: number
  activeAdsets: number
  activeAds: number
  criticalAlerts: number
  opportunities: number
  pendingApprovals: number
  draftActions: number
  kpis: AggregatedKpis
}
