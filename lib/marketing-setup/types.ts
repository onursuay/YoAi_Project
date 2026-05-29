// Shared types for the Marketing Setup wizard. Pure types — safe on client + server.

import type { StandardEventKey, SetupStepName } from './constants'

export type MarketingSetupStatus = 'pending' | 'running' | 'done' | 'error'
export type StepStatus = 'pending' | 'running' | 'done' | 'error'

// ─── Site scan ───────────────────────────────────────────────────────────────
export interface DetectedAction {
  /** The standard event this action maps to. */
  event: StandardEventKey
  /** Where it was found (page URL or element description). */
  source: string
  /** How the action was detected (cta | form | ecommerce | checkout | modal | video | search). */
  via: string
  /** 0..1 detection confidence. */
  confidence: number
}

export interface RecommendedEvent {
  event: StandardEventKey
  /** Number of pages/signals that suggested this event. */
  hits: number
  confidence: number
}

export interface SiteScanResult {
  siteUrl: string
  pagesScanned: number
  detectedActions: DetectedAction[]
  recommendedEvents: RecommendedEvent[]
  scannedAt: string
  /** Site sayfa sınırına takıldıysa (yalnız ilk N sayfa tarandı) true. */
  truncated?: boolean
}

// ─── Persisted row (marketing_setups) ────────────────────────────────────────
export interface MarketingSetupRow {
  id: string
  user_id: string
  site_url: string
  site_scan_result: SiteScanResult | null
  selected_events: StandardEventKey[] | null
  gtm_container_id: string | null
  gtm_public_id: string | null
  gtm_workspace_id: string | null
  gtm_snippet_head: string | null
  gtm_snippet_body: string | null
  ga4_property_id: string | null
  ga4_measurement_id: string | null
  ga4_data_stream_id: string | null
  meta_pixel_id: string | null
  meta_ad_account_id: string | null
  google_ads_customer_id: string | null
  search_console_property: string | null
  google_token_scopes: string | null
  status: MarketingSetupStatus
  created_at: string
  updated_at: string
}

/** Public (token-free) view of a setup, safe to send to the client. */
export type MarketingSetupPublic = Omit<MarketingSetupRow, never>

// ─── Deployment step results ─────────────────────────────────────────────────
export interface DeployStepResult {
  step: SetupStepName
  status: StepStatus
  result?: Record<string, unknown>
  error?: string | null
}

// ─── Connection status (Step 2) ──────────────────────────────────────────────
export interface ConnectionStatus {
  meta: { connected: boolean; adAccountId: string | null; adAccountName: string | null; pixelId: string | null }
  googleAds: { connected: boolean; customerId: string | null; customerName: string | null }
  ga4: { connected: boolean; propertyId: string | null }
  gsc: { connected: boolean; siteUrl: string | null }
  setupConsent: { connected: boolean; scopes: string[] }
}
