/**
 * Google Ads error normalization and UI-safe message helpers.
 */

export interface GoogleAdsApiError {
  error: string
  message: string
  status: number
  details?: unknown
}

/** Structured error response returned to frontend */
export interface StructuredErrorResponse {
  error: string
  userMessage: string
  technicalDetail: string
  status: number
}

/** User-safe Turkish messages keyed by internal error code */
const USER_MESSAGES: Record<string, string> = {
  ad_group_assets_failed: 'Bu reklam grubuna ait öğeler şu anda alınamadı.',
  assets_failed: 'Kampanya öğeleri şu anda alınamadı.',
  landing_pages_failed: 'Açılış sayfası verisi şu anda getirilemedi.',
  audience_view_failed: 'Hedef kitle verileri şu anda alınamadı.',
  ad_group_audience_failed: 'Reklam grubu hedef kitle verileri şu anda alınamadı.',
  auction_insights_failed: 'Gösterim payı verileri şu anda alınamadı.',
  placements_failed: 'Gösterilme yeri verileri şu anda alınamadı.',
  search_terms_failed: 'Arama terimleri verileri şu anda alınamadı.',
  audience_criteria_list_failed: 'Hedef kitle segment verileri şu anda alınamadı.',
  audience_criteria_add_failed: 'Hedef kitle segmentleri eklenirken bir hata oluştu.',
  audience_criteria_remove_failed: 'Hedef kitle segmentleri kaldırılırken bir hata oluştu.',
  demographics_list_failed: 'Demografi verileri şu anda alınamadı.',
  demographics_update_failed: 'Demografi verileri güncellenirken bir hata oluştu.',
  google_ads_error: 'Google Ads verisi alınırken bir hata oluştu.',
}

/**
 * Extract a UI-safe error message from a Google Ads API JSON response.
 * Drills into the nested error structure: data.error.details[0].errors[0].message
 */
export function extractGoogleAdsError(data: Record<string, unknown>): string {
  const err = data?.error as Record<string, unknown> | undefined
  if (!err) return (data?.message as string) ?? 'Unknown error'

  // Try nested detail message first (most specific)
  const details = err.details as Array<Record<string, unknown>> | undefined
  const firstDetail = details?.[0]
  const detailErrors = firstDetail?.errors as Array<Record<string, unknown>> | undefined
  const detailMsg = detailErrors?.[0]?.message as string | undefined
  if (detailMsg) return detailMsg

  // Fall back to top-level error message
  return (err.message as string) ?? 'Google Ads API error'
}

/**
 * Normalize any caught error into a consistent { error, message, status } shape.
 * Handles Error instances, Google Ads errors with status, and unknown values.
 */
export function normalizeError(
  e: unknown,
  fallbackCode = 'google_ads_error',
  fallbackStatus = 500
): GoogleAdsApiError {
  if (e instanceof Error) {
    const status = (e as Error & { status?: number }).status ?? fallbackStatus
    return { error: fallbackCode, message: e.message, status }
  }
  return { error: fallbackCode, message: 'Unknown error', status: fallbackStatus }
}

/**
 * Build a structured error response for the frontend.
 * Logs the full error server-side, returns user-safe message + technical detail.
 */
export function buildErrorResponse(
  e: unknown,
  errorCode: string,
  routeLabel: string,
  fallbackStatus = 500
): { body: StructuredErrorResponse; status: number } {
  const normalized = normalizeError(e, errorCode, fallbackStatus)

  // Server-side logging with full detail
  const googleError = (e as Error & { googleError?: unknown })?.googleError
  console.error(`[${routeLabel}]`, {
    code: errorCode,
    message: normalized.message,
    status: normalized.status,
    ...(googleError ? { googleAdsDetail: JSON.stringify(googleError, null, 2) } : {}),
  })

  const userMessage = USER_MESSAGES[errorCode] || USER_MESSAGES.google_ads_error
  const technicalDetail = normalized.message || 'Bilinmeyen hata'

  return {
    body: {
      error: errorCode,
      userMessage,
      technicalDetail,
      status: normalized.status,
    },
    status: normalized.status,
  }
}

/**
 * Parse a failed Google Ads API response into a standardized error.
 * Reads the response body and extracts the most specific error message.
 */
export async function parseGoogleAdsResponse(
  res: Response,
  fallbackCode = 'google_ads_error'
): Promise<GoogleAdsApiError> {
  const status = res.status >= 500 ? 502 : (res.status || 400)
  try {
    const data = await res.json()
    const message = extractGoogleAdsError(data as Record<string, unknown>)
    return { error: fallbackCode, message, status, details: data }
  } catch {
    const text = await res.text().catch(() => '')
    return { error: fallbackCode, message: text || res.statusText || 'API error', status }
  }
}
