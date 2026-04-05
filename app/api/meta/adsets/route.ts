import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { metaGraphFetch } from '@/lib/metaGraph'
import {
  getListCacheKey,
  getListCached,
  setListCached,
  withLock,
  fetchWithBackoff,
  isRateLimitError,
  extractFbTraceId,
} from '@/lib/meta/listFetch'
import { getResultTypeFromOptimizationGoal, extractResultsCount } from '@/lib/meta/resultExtraction'

// No cache - always fresh data
export const dynamic = 'force-dynamic'

// Helper to safely read response text
async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return `Failed to read response body (status: ${response.status})`
  }
}

// Helper to safely parse JSON
function safeParseJSON(text: string): { success: true; data: any } | { success: false; error: string } {
  try {
    return { success: true, data: JSON.parse(text) }
  } catch (error) {
    const snippet = text.length > 200 ? text.substring(0, 200) + '...' : text
    return { success: false, error: `JSON parse failed: ${error instanceof Error ? error.message : 'Unknown'}. Snippet: ${snippet}` }
  }
}

// Helper to create error response with debug info
function createErrorResponse(
  ok: boolean,
  error: string,
  details: any,
  stage: 'validate' | 'fetch_meta' | 'parse_meta' | 'unknown',
  fbtrace_id?: string
) {
  const response: any = { ok, error, details, debug: { stage } }
  if (fbtrace_id) response.debug.fbtrace_id = fbtrace_id
  return response
}

export async function GET(request: Request) {
  let stage: 'validate' | 'fetch_meta' | 'parse_meta' | 'unknown' = 'validate'
  
  try {
    // Parse query params safely
    let datePreset: string | null = null
    let since: string | null = null
    let until: string | null = null
    let after: string | null = null
    let adAccountIdParam: string | null = null
    
    try {
      const { searchParams } = new URL(request.url)
      datePreset = searchParams.get('date_preset')
      since = searchParams.get('since')
      until = searchParams.get('until')
      after = searchParams.get('after') || null
      adAccountIdParam = searchParams.get('adAccountId')
    } catch (error) {
      return NextResponse.json(
        createErrorResponse(
          false,
          'invalid_request',
          { message: 'Failed to parse request URL', error: error instanceof Error ? error.message : 'Unknown' },
          'validate'
        ),
        { status: 400 }
      )
    }

    // Validate required inputs early
    let cookieStore
    try {
      cookieStore = await cookies()
    } catch (error) {
      return NextResponse.json(
        createErrorResponse(
          false,
          'cookie_error',
          { message: 'Failed to read cookies', error: error instanceof Error ? error.message : 'Unknown' },
          'validate'
        ),
        { status: 500 }
      )
    }

    const accessToken = cookieStore.get('meta_access_token')
    const selectedAdAccountIdCookie = cookieStore.get('meta_selected_ad_account_id')

    if (!accessToken || !accessToken.value) {
      return NextResponse.json(
        createErrorResponse(false, 'missing_token', { message: 'Meta access token not found' }, 'validate'),
        { status: 401 }
      )
    }

    // adAccountId is required: prefer query param, fallback to cookie
    const selectedAdAccountId = adAccountIdParam || selectedAdAccountIdCookie?.value
    if (!selectedAdAccountId) {
      return NextResponse.json(
        createErrorResponse(
          false,
          'MISSING_AD_ACCOUNT_ID',
          { message: 'adAccountId is required in query params or cookies' },
          'validate'
        ),
        { status: 400 }
      )
    }

    // Check token expiration
    const expiresAtCookie = cookieStore.get('meta_access_expires_at')
    if (expiresAtCookie) {
      try {
        const expiresAt = parseInt(expiresAtCookie.value, 10)
        if (isNaN(expiresAt) || Date.now() >= expiresAt) {
          return NextResponse.json(
            createErrorResponse(false, 'token_expired', { message: 'Access token has expired' }, 'validate'),
            { status: 401 }
          )
        }
      } catch {
        // Invalid expiration cookie, continue
      }
    }

    // Normalize account ID
    const accountId = selectedAdAccountId.startsWith('act_')
      ? selectedAdAccountId
      : `act_${selectedAdAccountId.replace('act_', '')}`

    const cacheParams = { date_preset: datePreset || '', since: since || '', until: until || '', after: after || '' }
    const cacheKey = getListCacheKey('/adsets', cacheParams, accountId)
    const cached = getListCached(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'no-store, max-age=10' },
      })
    }

    // Guard: never send both date_preset and time_range simultaneously
    const safeSince = datePreset ? null : since
    const safeUntil = datePreset ? null : until

    // Build inline insights field
    stage = 'fetch_meta'
    const insightsFields = 'spend,impressions,clicks,ctr,cpc,actions,action_values,purchase_roas'
    let insightsModifier = ''
    if (safeSince && safeUntil) {
      insightsModifier = `insights.time_range(${JSON.stringify({ since: safeSince, until: safeUntil })}){${insightsFields}}`
    } else if (datePreset) {
      insightsModifier = `insights.date_preset(${datePreset}){${insightsFields}}`
    } else {
      insightsModifier = `insights.date_preset(maximum){${insightsFields}}`
    }
    console.log('[Meta AdSets] dateFilter:', { datePreset, since: safeSince, until: safeUntil, omittedDateParams: !datePreset && !safeSince && !safeUntil })

    const adsetParams: Record<string, string> = {
      fields: `id,name,status,effective_status,optimization_goal,daily_budget,lifetime_budget,campaign_id,${insightsModifier}`,
      limit: '50',
      effective_status: '["ACTIVE","PAUSED","PENDING_REVIEW","IN_PROCESS","PREAPPROVED","WITH_ISSUES","CAMPAIGN_PAUSED","ADSET_PAUSED"]',
    }
    if (after) adsetParams.after = after

    let adsetResponse: Response
    let adsetFbTraceId: string | undefined
    let adsetErrorData: any = null
    let adsetRetryAfterMs: number | undefined

    try {
      const fetchResult = await withLock(`act:${accountId}`, async () =>
        fetchWithBackoff(async () => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)
        try {
          const res = await metaGraphFetch(`/${accountId}/adsets`, accessToken.value, {
            params: adsetParams,
            signal: controller.signal,
          })
          clearTimeout(timeoutId)
          return res
        } catch (fetchError) {
          clearTimeout(timeoutId)
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            return new Response(null, { status: 504 })
          }
          throw fetchError
        }
      }, 3)
      )

      adsetResponse = fetchResult.response
      adsetErrorData = fetchResult.errorData
      adsetRetryAfterMs = fetchResult.retryAfterMs
    } catch (error) {
      return NextResponse.json(
        createErrorResponse(
          false,
          'fetch_failed',
          { message: 'Failed to fetch from Meta API', error: error instanceof Error ? error.message : 'Unknown' },
          'fetch_meta'
        ),
        { status: 502 }
      )
    }

    // Handle non-OK response safely
    if (!adsetResponse.ok) {
      let errorText = ''
      let parsed: { success: boolean; data?: any; error?: string } = { success: false }
      
      try {
        errorText = await safeReadText(adsetResponse)
        parsed = safeParseJSON(errorText)
      } catch {
        // Ignore read errors
      }

      const errorData = parsed.success ? parsed.data : (adsetErrorData || {})
      adsetFbTraceId = extractFbTraceId(errorData)
      const isRateLimit = adsetResponse.status === 429 || isRateLimitError(errorData)
      const isAuthError = adsetResponse.status === 401 || errorData.error?.code === 190 || [463, 467].includes(errorData.error?.error_subcode)
      const errBody = {
        ...createErrorResponse(
          false,
          isAuthError ? 'token_expired' : isRateLimit ? 'rate_limit_exceeded' : 'meta_api_error',
          {
            message: isRateLimit
              ? 'Meta rate limit reached. Please wait and retry.'
              : `Meta API returned ${adsetResponse.status}`,
            error: errorData.error || errorData,
            code: errorData.error?.code,
            subcode: errorData.error?.error_subcode,
          },
          'fetch_meta',
          adsetFbTraceId
        ),
        ...(isRateLimit && { retryAfterMs: adsetRetryAfterMs ?? 4000 }),
      }
      return NextResponse.json(errBody, { status: isAuthError ? 401 : isRateLimit ? 429 : 502 })
    }

    // Parse adset response safely
    stage = 'parse_meta'
    const adsetText = await safeReadText(adsetResponse)
    const adsetParsed = safeParseJSON(adsetText)
    
    if (!adsetParsed.success) {
      return NextResponse.json(
        createErrorResponse(
          false,
          'parse_error',
          { message: 'Failed to parse Meta API response', error: adsetParsed.error },
          'parse_meta'
        ),
        { status: 502 }
      )
    }

    const adsetData = adsetParsed.data
    const adsets = Array.isArray(adsetData?.data) ? adsetData.data : []
    
    if (adsets.length === 0) {
      return NextResponse.json({ ok: true, data: [], paging: {} }, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      })
    }

    // Enrich adsets with inline insights
    const enrichedAdsets = adsets.map((adset: any) => {
      try {
        const insight = adset?.insights?.data?.[0] || null
        const configuredStatus = adset?.status || 'ACTIVE'
        const effectiveStatus = adset?.effective_status || configuredStatus
        const dailyBudget = adset?.daily_budget ? parseFloat(String(adset.daily_budget)) / 100 : 0
        const lifetimeBudget = adset?.lifetime_budget ? parseFloat(String(adset.lifetime_budget)) / 100 : 0
        const budget = dailyBudget || lifetimeBudget

        const spend = insight?.spend ? parseFloat(String(insight.spend)) : 0
        const impressions = insight?.impressions ? parseInt(String(insight.impressions), 10) : 0
        const clicks = insight?.clicks ? parseInt(String(insight.clicks), 10) : 0
        const ctr = insight?.ctr ? parseFloat(String(insight.ctr)) : 0
        const cpc = insight?.cpc ? parseFloat(String(insight.cpc)) : 0

        let purchases = 0
        if (Array.isArray(insight?.actions)) {
          const purchaseAction = insight.actions.find(
            (a: any) => a?.action_type === 'purchase' || a?.action_type === 'omni_purchase'
          )
          if (purchaseAction?.value) {
            purchases = parseInt(String(purchaseAction.value), 10) || 0
          }
        }

        let roas = 0
        if (insight?.purchase_roas) {
          roas = parseFloat(String(insight.purchase_roas)) || 0
        } else if (Array.isArray(insight?.action_values) && spend > 0) {
          const purchaseValue = insight.action_values.find(
            (av: any) => av?.action_type === 'purchase' || av?.action_type === 'omni_purchase'
          )
          if (purchaseValue?.value) {
            roas = parseFloat(String(purchaseValue.value)) / spend
          }
        }

        const optimizationGoal = adset?.optimization_goal || ''
        const resultType = getResultTypeFromOptimizationGoal(optimizationGoal)
        const results = extractResultsCount(resultType, insight)

        return {
          id: adset?.id || '',
          name: adset?.name || 'Unnamed Ad Set',
          status: configuredStatus,
          effective_status: effectiveStatus,
          statusLabel: getStatusLabel(effectiveStatus),
          statusColor: getStatusColor(effectiveStatus),
          campaignId: adset?.campaign_id || '',
          optimizationGoal,
          resultType,
          results,
          budget,
          daily_budget: dailyBudget,
          lifetime_budget: lifetimeBudget,
          spent: spend,
          impressions,
          clicks,
          ctr,
          cpc,
          purchases,
          roas: roas > 0 ? roas : null,
        }
      } catch (error) {
        // Return minimal safe object if enrichment fails
        return {
          id: adset?.id || '',
          name: adset?.name || 'Unnamed Ad Set',
          status: adset?.status || 'ACTIVE',
          effective_status: adset?.effective_status || adset?.status || 'UNKNOWN',
          statusLabel: getStatusLabel(adset?.effective_status || adset?.status || 'UNKNOWN'),
          statusColor: getStatusColor(adset?.effective_status || adset?.status || 'UNKNOWN'),
          campaignId: adset?.campaign_id || '',
          budget: 0,
          daily_budget: 0,
          lifetime_budget: 0,
          spent: 0,
          impressions: 0,
          clicks: 0,
          ctr: 0,
          cpc: 0,
          purchases: 0,
          roas: null,
        }
      }
    })

    const result = {
      ok: true,
      data: enrichedAdsets,
      paging: adsetData?.paging?.cursors?.after ? { nextCursor: adsetData.paging.cursors.after } : {},
    }
    setListCached(cacheKey, result)

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (error) {
    console.error('Adsets fetch error:', error)
    return NextResponse.json(
      createErrorResponse(
        false,
        'unexpected_error',
        { message: 'An unexpected error occurred', error: error instanceof Error ? error.message : 'Unknown' },
        stage
      ),
      { status: 500 }
    )
  }
}

function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    'ACTIVE': 'Aktif', 'PAUSED': 'Duraklatıldı', 'ARCHIVED': 'Arşivlendi', 'DELETED': 'Silindi',
    'DISAPPROVED': 'Reddedildi', 'PREAPPROVED': 'Ön Onaylı', 'PENDING_REVIEW': 'İnceleme Bekliyor',
    'PENDING_BILLING_INFO': 'Faturalama Bekliyor', 'CAMPAIGN_PAUSED': 'Duraklatıldı',
    'ADGROUP_PAUSED': 'Duraklatıldı', 'WITH_ISSUES': 'Sorunlu',
  }
  return statusMap[status] || status
}

function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    'ACTIVE': 'bg-green-100 text-green-800', 'PAUSED': 'bg-yellow-100 text-yellow-800',
    'ARCHIVED': 'bg-gray-100 text-gray-800', 'DELETED': 'bg-red-100 text-red-800',
    'DISAPPROVED': 'bg-red-100 text-red-800', 'PREAPPROVED': 'bg-blue-100 text-blue-800',
    'PENDING_REVIEW': 'bg-yellow-100 text-yellow-800', 'PENDING_BILLING_INFO': 'bg-yellow-100 text-yellow-800',
    'CAMPAIGN_PAUSED': 'bg-yellow-100 text-yellow-800', 'ADGROUP_PAUSED': 'bg-yellow-100 text-yellow-800',
    'WITH_ISSUES': 'bg-red-100 text-red-800',
  }
  return colorMap[status] || 'bg-gray-100 text-gray-800'
}
