import type { ObjectiveId } from '@/lib/meta/spec/objectiveSpec'

// === Triple Classification ===
export interface CampaignTriple {
  objective: ObjectiveId
  optimizationGoal: string
  destination: string
}

// === Normalized Insights ===
export interface NormalizedInsights {
  // Base delivery
  spend: number
  impressions: number
  reach: number
  frequency: number
  cpm: number
  cpc: number
  ctr: number
  clicks: number
  inlineLinkClicks: number
  uniqueClicks: number
  uniqueCtr: number
  // Actions — flat map: action_type -> value
  actions: Record<string, number>
  // Cost per action — flat map: action_type -> cost
  costPerAction: Record<string, number>
  // Action values — flat map: action_type -> monetary value
  actionValues: Record<string, number>
  // Video
  videoThruplayWatched: number
  videoAvgTimeWatched: number
  videoP25: number
  videoP50: number
  videoP75: number
  videoP100: number
  // Rankings (raw string from Meta: BELOW_AVERAGE_10, AVERAGE, ABOVE_AVERAGE, etc.)
  qualityRanking: string
  engagementRateRanking: string
  conversionRateRanking: string
  // Conversion
  websitePurchaseRoas: number
  // Brand
  estimatedAdRecallers: number
  costPerEstimatedAdRecaller: number
}

// === KPI Metric Definition ===
export interface KpiMetricDef {
  /** Metric key in NormalizedInsights, or 'actions'/'costPerAction'/'actionValues' for action-based */
  key: string
  /** For action-based metrics, the action_type to look up */
  actionType?: string
  /** Display format */
  format: 'number' | 'currency' | 'percentage' | 'ratio' | 'ranking'
  /** If true, higher values are better (used for scoring direction) */
  higherIsBetter: boolean
  /** i18n key for metric label */
  labelKey: string
}

// === Alert Rule ===
export interface AlertRule {
  id: string
  condition: 'below_threshold' | 'above_threshold' | 'ranking_poor' | 'trend_declining'
  /** Metric key to check — supports dot notation for action-based (e.g. 'actions.purchase') */
  metricKey: string
  /** Action type for action-based metrics */
  actionType?: string
  threshold?: number
  severity: 'info' | 'warning' | 'critical'
  /** i18n message key */
  messageKey: string
}

// === Corrective Action ===
export interface CorrectiveAction {
  id: string
  triggerAlertId: string
  scope: 'campaign' | 'adset' | 'ad'
  actionType: 'pause' | 'resume' | 'reduce_budget' | 'increase_budget' | 'refresh_creative' | 'broaden_audience' | 'narrow_targeting'
  /** i18n label key */
  labelKey: string
  /** i18n description key */
  descriptionKey: string
  riskLevel: 'low' | 'medium' | 'high'
}

// === KPI Template ===
export interface KpiTemplate {
  id: string
  northStar: KpiMetricDef
  efficiency: KpiMetricDef[]
  volume: KpiMetricDef[]
  diagnostics: KpiMetricDef[]
  alerts: AlertRule[]
  correctiveActions: CorrectiveAction[]
}

// === Scoring ===
export type ScoreStatus = 'excellent' | 'good' | 'average' | 'poor' | 'critical' | 'insufficient_data'

export interface GateResult {
  passed: boolean
  score: number // 0-100
  label: string
}

export interface Alert {
  id: string
  severity: 'info' | 'warning' | 'critical'
  messageKey: string
  metricKey: string
  currentValue: number
  threshold?: number
  correctiveActions: CorrectiveAction[]
}

export interface ScoreResult {
  score: number // 0-100
  status: ScoreStatus
  gateResults: {
    delivery: GateResult
    efficiency: GateResult
    quality: GateResult
    saturation: GateResult
  }
  reasons: string[]
  alerts: Alert[]
}

// === Enriched Campaign for UI ===
export interface OptimizationCampaign {
  id: string
  name: string
  status: string
  effectiveStatus: string
  triple: CampaignTriple
  insights: NormalizedInsights
  adsets: OptimizationAdset[]
  kpiTemplate: KpiTemplate
  scoreResult: ScoreResult
  dailyBudget: number | null
  lifetimeBudget: number | null
  currency: string
}

export interface OptimizationAdset {
  id: string
  name: string
  status: string
  optimizationGoal: string
  destinationType: string
  dailyBudget: number | null
  lifetimeBudget: number | null
  insights: NormalizedInsights
}

// === ChangeSet (Write-Back) ===
export interface ChangeSet {
  id: string
  entityType: 'campaign' | 'adset' | 'ad'
  entityId: string
  entityName: string
  changeType: 'status' | 'budget' | 'duplicate_adset'
  oldValue: string | number
  newValue: string | number
  riskLevel: 'low' | 'medium' | 'high'
  status: 'pending' | 'applied' | 'rolled_back' | 'failed'
  timestamp: number
}

// === Magic Scan Types ===

export type ProblemTagId =
  | 'NO_DELIVERY'
  | 'INSUFFICIENT_DATA'
  | 'HIGH_CPL'
  | 'HIGH_CPA'
  | 'HIGH_CPM'
  | 'HIGH_CPC'
  | 'LOW_CTR'
  | 'LOW_ROAS'
  | 'NEGATIVE_ROAS'
  | 'HIGH_FREQUENCY'
  | 'CRITICAL_FREQUENCY'
  | 'QUALITY_BELOW_AVERAGE'
  | 'ENGAGEMENT_BELOW_AVERAGE'
  | 'CONVERSION_BELOW_AVERAGE'
  | 'LPV_DROP'
  | 'FUNNEL_BOTTLENECK'
  | 'BUDGET_UNDERUTILIZED'
  | 'ADSET_IMBALANCE'
  | 'SINGLE_ADSET_RISK'

export interface MetricEvidence {
  metric: string
  value: number
  benchmark: number | null
  format: 'number' | 'currency' | 'percentage' | 'ratio'
  direction: 'above' | 'below' | 'neutral'
}

export interface ProblemTag {
  id: ProblemTagId
  severity: 'critical' | 'warning' | 'info'
  evidence: MetricEvidence[]
}

export type RecommendationCategory = 'AUTO_APPLY_SAFE' | 'REVIEW_REQUIRED' | 'TASK'

export interface Recommendation {
  id: string
  title: string
  problemTag: ProblemTagId
  evidence: MetricEvidence[]
  rootCause: string
  action: string
  risk: 'low' | 'medium' | 'high'
  expectedImpact: string
  confidence: number
  category: RecommendationCategory
  changeSet?: ChangeSet
}

export interface MagicScanResult {
  campaignId: string
  campaignName: string
  currency: string
  timestamp: number
  problemTags: ProblemTag[]
  recommendations: Recommendation[]
  aiGenerated: boolean
}
