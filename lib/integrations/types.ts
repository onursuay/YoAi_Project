/**
 * Shared types for all integration providers.
 * Provider-agnostic interfaces used by both frontend and backend.
 */

export type ProviderKey = 'meta_ads' | 'google_ads' | 'google_analytics' | 'google_search_console'

export type ConnectionStatus = 'active' | 'revoked' | 'error' | 'not_connected'

export interface ConnectionInfo {
  provider: ProviderKey
  connected: boolean
  status: ConnectionStatus
  accountName?: string
  accountId?: string
  lastSyncAt?: string
  error?: string
}

export interface ReportSummaryKpi {
  key: string
  value: number | string
  previousValue?: number | string
  changePercent?: number
  format?: 'number' | 'percent' | 'currency' | 'duration' | 'decimal'
}

export interface ReportDailySeries {
  date: string
  [metric: string]: string | number
}

export interface ReportTableRow {
  [key: string]: string | number
}

export interface ReportData {
  provider: ProviderKey
  kpis: ReportSummaryKpi[]
  dailySeries: ReportDailySeries[]
  tables: {
    key: string
    columns: { key: string; label: string; format?: string }[]
    rows: ReportTableRow[]
  }[]
  fetchedAt: string
}

export interface DateRange {
  from: string // YYYY-MM-DD
  to: string   // YYYY-MM-DD
}
