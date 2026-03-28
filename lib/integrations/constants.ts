/**
 * Shared constants for integration providers.
 */

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export const GOOGLE_ANALYTICS_SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
]

export const GOOGLE_SEARCH_CONSOLE_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
]

export const GA_DATA_API_BASE = 'https://analyticsdata.googleapis.com/v1beta'
export const GA_ADMIN_API_BASE = 'https://analyticsadmin.googleapis.com/v1beta'
export const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3'

export const REPORT_CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

export const RETRY = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 1000,
  JITTER_MS: 200,
} as const
