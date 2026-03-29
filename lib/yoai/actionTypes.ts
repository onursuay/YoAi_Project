/* ──────────────────────────────────────────────────────────
   YoAi Action Types — Phase 2: One-Click Actions
   ────────────────────────────────────────────────────────── */

export type ActionType =
  | 'pause_campaign'
  | 'resume_campaign'
  | 'pause_adset'
  | 'resume_adset'
  | 'pause_ad'
  | 'resume_ad'
  | 'increase_budget'
  | 'decrease_budget'
  | 'duplicate_campaign'
  | 'duplicate_adset'
  | 'duplicate_ad'

export type EntityType = 'campaign' | 'adset' | 'ad_group' | 'ad'
export type Platform = 'Meta' | 'Google'

export interface ExecutableAction {
  actionType: ActionType
  platform: Platform
  entityType: EntityType
  entityId: string
  entityName: string
  campaignId?: string
  campaignName?: string
  adGroupId?: string // Google only — needed for ad mutations
  params?: {
    newBudget?: number
    budgetType?: 'daily' | 'lifetime'
  }
}

export interface ActionResult {
  ok: boolean
  actionType: ActionType
  entityId: string
  message: string
  error?: string
}

/* ── Map ActionType to human-readable Turkish label ── */
export const ACTION_LABELS: Record<ActionType, string> = {
  pause_campaign: 'Kampanyayı Duraklat',
  resume_campaign: 'Kampanyayı Devam Ettir',
  pause_adset: 'Reklam Setini Duraklat',
  resume_adset: 'Reklam Setini Devam Ettir',
  pause_ad: 'Reklamı Duraklat',
  resume_ad: 'Reklamı Devam Ettir',
  increase_budget: 'Bütçeyi Artır',
  decrease_budget: 'Bütçeyi Azalt',
  duplicate_campaign: 'Kampanyayı Kopyala',
  duplicate_adset: 'Reklam Setini Kopyala',
  duplicate_ad: 'Reklamı Kopyala',
}
