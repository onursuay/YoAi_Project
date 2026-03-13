// ============================================================
// YoAi Strateji Modülü — TypeScript Tipleri
// ============================================================

export type InstanceStatus =
  | 'DRAFT'
  | 'COLLECTING'
  | 'ANALYZING'
  | 'GENERATING_PLAN'
  | 'READY_FOR_REVIEW'
  | 'APPLYING'
  | 'RUNNING'
  | 'NEEDS_ACTION'
  | 'FAILED'

export type JobType = 'analyze' | 'generate_plan' | 'apply' | 'pull_metrics' | 'optimize'
export type JobStatus = 'queued' | 'running' | 'success' | 'failed'
export type TaskCategory = 'setup' | 'creative' | 'audience' | 'campaign' | 'measurement' | 'optimization'
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'
export type GoalType = 'awareness' | 'traffic' | 'engagement' | 'leads' | 'app' | 'sales'

export interface StrategyInstance {
  id: string
  ad_account_id: string
  title: string
  brand: string | null
  goal_type: GoalType | null
  time_horizon_days: number
  monthly_budget_try: number | null
  channel_meta: boolean
  channel_google: boolean
  status: InstanceStatus
  current_phase: 1 | 2 | 3
  data_quality_score: number
  missing_items: string[]
  last_error: ErrorDetail | null
  created_at: string
  updated_at: string
}

export interface StrategyInput {
  id: string
  strategy_instance_id: string
  payload: InputPayload
  created_at: string
  updated_at: string
}

export interface InputPayload {
  goal_type: GoalType
  product: string
  industry: string
  industry_custom?: string
  avg_basket?: number
  margin_pct?: number
  ltv?: number
  geographies: string[]
  language: string
  monthly_budget_try: number
  currency: string
  time_horizon_days: number
  channels: { meta: boolean; google: boolean; tiktok: boolean }
  integrations: {
    pixel: 'green' | 'yellow' | 'red'
    analytics: 'green' | 'yellow' | 'red'
    crm: 'green' | 'yellow' | 'red'
  }
}

export interface Blueprint {
  kpi_targets: {
    cpa_range: [number, number]
    roas_range: [number, number]
    ctr_range: [number, number]
    cvr_range: [number, number]
  }
  funnel_split: { tofu: number; mofu: number; bofu: number }
  channel_mix: { meta: number; google: number }
  personas: Persona[]
  creative_themes: CreativeTheme[]
  experiment_backlog: Experiment[]
  risks: Risk[]
  tasks_seed: TaskSeed[]
}

export interface Persona {
  name: string
  pain: string
  promise: string
  proof: string
}

export interface CreativeTheme {
  theme: string
  hook: string
  offer: string
  format: 'video' | 'image' | 'ugc'
}

export interface Experiment {
  hypothesis: string
  metric: string
  test: string
  priority: 'high' | 'med' | 'low'
}

export interface Risk {
  risk: string
  mitigation: string
}

export interface TaskSeed {
  title: string
  category: TaskCategory
  priority: 'high' | 'med' | 'low'
}

export interface StrategyOutput {
  id: string
  strategy_instance_id: string
  blueprint: Blueprint
  version: number
  created_at: string
}

export interface StrategyTask {
  id: string
  strategy_instance_id: string
  title: string
  category: TaskCategory
  status: TaskStatus
  assignee: string | null
  evidence_urls: string[]
  due_date: string | null
  created_at: string
  updated_at: string
}

export interface SyncJob {
  id: string
  strategy_instance_id: string
  job_type: JobType
  status: JobStatus
  progress: number
  attempts: number
  max_attempts: number
  next_run_at: string | null
  result: Record<string, unknown> | null
  last_error: ErrorDetail | null
  created_at: string
  updated_at: string
}

export interface MetricsSnapshot {
  id: string
  strategy_instance_id: string
  range_days: number
  spend_try: number
  clicks: number
  impressions: number
  conversions: number
  roas: number
  cpa_try: number | null
  ctr: number | null
  created_at: string
}

export interface ErrorDetail {
  code: string
  message: string
  timestamp: string
  details?: Record<string, unknown>
}

// KPI Bar verileri
export interface KPIData {
  total_budget: number
  remaining_budget: number
  spend: number
  clicks: number
  roas: number
}
