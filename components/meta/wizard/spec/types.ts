/**
 * Full-scope objective-aware spec types.
 * Single source of truth for wizard fields, visibility, required, resets.
 */

export type ObjectiveKey =
  | 'AWARENESS'
  | 'TRAFFIC'
  | 'ENGAGEMENT'
  | 'LEADS'
  | 'APP_PROMOTION'
  | 'SALES'

export type StepKey = 'CAMPAIGN' | 'ADSET' | 'AD'

export type FieldKey = string

/** Map objective key to Meta API objective id */
export const OBJECTIVE_KEY_TO_API: Record<ObjectiveKey, string> = {
  AWARENESS: 'OUTCOME_AWARENESS',
  TRAFFIC: 'OUTCOME_TRAFFIC',
  ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
  LEADS: 'OUTCOME_LEADS',
  APP_PROMOTION: 'OUTCOME_APP_PROMOTION',
  SALES: 'OUTCOME_SALES',
}

/** Map Meta API objective to key */
export const API_TO_OBJECTIVE_KEY: Record<string, ObjectiveKey> = {
  OUTCOME_AWARENESS: 'AWARENESS',
  OUTCOME_TRAFFIC: 'TRAFFIC',
  OUTCOME_ENGAGEMENT: 'ENGAGEMENT',
  OUTCOME_LEADS: 'LEADS',
  OUTCOME_APP_PROMOTION: 'APP_PROMOTION',
  OUTCOME_SALES: 'SALES',
}

// ── Rule expressions (JSON-logic style) ───────────────────────────────────

export type RuleExpr =
  | { any: RuleExpr[] }
  | { all: RuleExpr[] }
  | { eq: [string, unknown] }
  | { in: [string, unknown[]] }
  | { exists: string }
  | { not: RuleExpr }

// ── Field mapping to payload ──────────────────────────────────────────────

export type Level = 'campaign' | 'adset' | 'ad'

export interface FieldMap {
  level: Level
  param: string
}

// ── Spec field ─────────────────────────────────────────────────────────────

export type ControlType = 'text' | 'number' | 'select' | 'toggle' | 'radio' | 'multiselect'

export interface SpecFieldUi {
  labelKey: string
  helpKey?: string
  control: ControlType
  options?: { value: string; labelKey: string }[]
}

export interface SpecField {
  key: FieldKey
  ui: SpecFieldUi
  default?: unknown
  map?: FieldMap
  validators?: string[]
  /** When to show this field */
  visibility?: RuleExpr[]
  /** When this field is required */
  required?: RuleExpr[]
  resets?: ResetRule[]
}

export interface ResetRule {
  when: RuleExpr
  clear: FieldKey[]
}

// ── Step & objective spec ──────────────────────────────────────────────────

export interface StepSpec {
  stepKey: StepKey
  fields: SpecField[]
}

export interface ObjectiveSpec {
  objectiveKey: ObjectiveKey
  steps: StepSpec[]
  /** Conversion location / engagement type / performance goal select key (e.g. adset.conversionLocation) */
  primaryDestinationKey?: FieldKey
  primaryDestinationOptions?: { value: string; labelKey: string; capabilityGate?: string }[]
}

// ── Wizard state shape (paths used in rules) ───────────────────────────────

export interface SpecWizardState {
  campaign: {
    name?: string
    objective?: string
    appId?: string
    appStoreUrl?: string
    ios14Campaign?: boolean
    advantagePlusApp?: boolean
    budgetOptimization?: string
    specialAdCategories?: string[]
  }
  adset: {
    name?: string
    pageId?: string
    conversionLocation?: string
    optimizationGoal?: string
    pixelId?: string
    customEventType?: string
    appId?: string
    appStoreUrl?: string
    catalogId?: string
    productSetId?: string
    appStore?: string
    attributionModel?: string
    instagramAccountId?: string
    budget?: number
    budgetType?: string
  }
  ad: {
    name?: string
    primaryText?: string
    websiteUrl?: string
    leadFormId?: string
    chatGreeting?: string
    phoneNumber?: string
    callToAction?: string
  }
}
