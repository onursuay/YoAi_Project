/* ──────────────────────────────────────────────────────────
   YoAi Command Center — shared types
   ────────────────────────────────────────────────────────── */

export type Platform = 'Meta' | 'Google'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type InsightStatus = 'monitoring' | 'review_needed' | 'ready_for_approval'
export type ActionPriority = 'high' | 'medium' | 'low'
export type ActionDraftType = 'budget' | 'creative' | 'targeting' | 'bid'

/* ── Health / Overview ── */
export interface HealthOverview {
  connectedAccounts: { count: number; platforms: string[] }
  activeCampaigns: number
  criticalAlerts: number
  opportunities: number
  pendingApprovals: number
  draftActions: number
}

/* ── Campaign Insight ── */
export interface CampaignInsight {
  id: string
  platform: Platform
  campaignName: string
  objective: string
  summary: string
  riskLevel: RiskLevel
  recommendation: string
  confidence: number
  status: InsightStatus
  metrics?: {
    spend?: number
    impressions?: number
    clicks?: number
    ctr?: number
    cpc?: number
    roas?: number | null
    conversions?: number
  }
}

/* ── Recommended Action ── */
export interface RecommendedAction {
  id: string
  title: string
  reason: string
  expectedImpact: string
  requiresApproval: boolean
  priority: ActionPriority
  campaignName?: string
  platform?: Platform
}

/* ── Action Draft (Approval Flow) ── */
export interface ActionDraft {
  id: string
  title: string
  description: string
  platform: string
  campaign: string
  createdAt: string
  type: ActionDraftType
}

/* ── Full Command Center Response ── */
export interface CommandCenterData {
  health: HealthOverview
  insights: CampaignInsight[]
  actions: RecommendedAction[]
  drafts: ActionDraft[]
  lastAnalysis: string
  aiGenerated: boolean
  errors: string[]
}
