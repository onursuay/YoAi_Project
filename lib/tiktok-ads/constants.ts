/**
 * Shared TikTok Ads constants. Single source of truth for version, base URL, and cookie names.
 */

export const TIKTOK_ADS_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3'
export const TIKTOK_AUTH_URL = 'https://business-api.tiktok.com/portal/auth'
export const TIKTOK_TOKEN_URL = `${TIKTOK_ADS_API_BASE}/oauth2/access_token/`

/** Cookie names used for TikTok Ads session */
export const COOKIE = {
  ACCESS_TOKEN: 'tiktok_access_token',
  ADVERTISER_ID: 'tiktok_advertiser_id',
  ADVERTISER_NAME: 'tiktok_advertiser_name',
} as const

/** Default retry config for fetchWithRetry */
export const RETRY = {
  MAX_RETRIES: 4,
  BASE_DELAY_MS: 1000,
  JITTER_MS: 200,
} as const

/** Machine-readable log events for TikTok Ads DB persistence */
export const LOG_EVENTS = {
  DB_UPSERT_OK: 'TIKTOK_ADS_DB_UPSERT_OK',
  DB_BACKFILL_OK: 'TIKTOK_ADS_DB_BACKFILL_OK',
  DB_LOOKUP_OK: 'TIKTOK_ADS_DB_LOOKUP_OK',
  DB_LOOKUP_MISS: 'TIKTOK_ADS_DB_LOOKUP_MISS',
  DISCONNECT_OK: 'TIKTOK_ADS_DISCONNECT_OK',
} as const
