/**
 * Shared Google Ads constants. Single source of truth for version, base URL, and cookie names.
 */

export const GOOGLE_ADS_API_VERSION = process.env.GOOGLE_ADS_API_VERSION ?? 'v23'
export const GOOGLE_ADS_API_HOST = 'https://googleads.googleapis.com'
export const GOOGLE_ADS_BASE = `${GOOGLE_ADS_API_HOST}/${GOOGLE_ADS_API_VERSION}`
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

/** Cookie names used for Google Ads session */
export const COOKIE = {
  REFRESH_TOKEN: 'google_refresh_token',
  CUSTOMER_ID: 'google_ads_customer_id',
  LOGIN_CUSTOMER_ID: 'google_ads_login_customer_id',
  ACCOUNT_NAME: 'google_ads_account_name',
  CUSTOMER_NAME: 'google_ads_customer_name',
  IS_MANAGER: 'google_ads_is_manager',
} as const

/** Micros conversion factor: 1 currency unit = 1,000,000 micros */
export const MICROS = 1_000_000

/** Max rows for paginated GAQL search */
export const MAX_SEARCH_ROWS = 10_000

/** Default retry config for fetchWithRetry */
export const RETRY = {
  MAX_RETRIES: 4,
  BASE_DELAY_MS: 1000,
  JITTER_MS: 200,
} as const

/** Machine-readable log events for Google Ads DB persistence (no token in logs) */
export const LOG_EVENTS = {
  DB_UPSERT_OK: 'GOOGLE_ADS_DB_UPSERT_OK',
  DB_BACKFILL_OK: 'GOOGLE_ADS_DB_BACKFILL_OK',
  DB_LOOKUP_OK: 'GOOGLE_ADS_DB_LOOKUP_OK',
  DB_LOOKUP_MISS: 'GOOGLE_ADS_DB_LOOKUP_MISS',
  DISCONNECT_OK: 'GOOGLE_ADS_DISCONNECT_OK',
  ADMIN_CONTEXT_ENV: 'GOOGLE_ADS_ADMIN_CONTEXT_ENV',
  ADMIN_CONTEXT_DB: 'GOOGLE_ADS_ADMIN_CONTEXT_DB',
} as const
