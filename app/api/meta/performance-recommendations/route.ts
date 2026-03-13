import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { metaGraphFetch } from '@/lib/metaGraph'
import { metaFetchWithRateLimit, isRateLimitError, extractFbTraceId } from '@/lib/meta/rateLimit'
import { getCacheKey, getCached, setCached } from '@/lib/meta/cache'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'

type PerfRecItem = {
  id: string
  title: string
  message: string
  type: string
  entityId: string | number | null
  entityType: string
  impact: string | null
  defaultAction: unknown
  createdTime: string | null
  status: string
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('meta_access_token')
    const selectedAdAccountId = cookieStore.get('meta_selected_ad_account_id')

    if (!accessToken?.value) {
      return NextResponse.json({
        ok: false,
        error: 'missing_token',
        message: 'Access token is missing',
      }, { status: 200 }) // Return 200 with ok:false instead of 401
    }

    if (!selectedAdAccountId?.value) {
      return NextResponse.json({
        ok: false,
        error: 'no_ad_account_selected',
        message: 'No ad account selected',
      }, { status: 200 })
    }

    // Check token expiration if available
    const expiresAtCookie = cookieStore.get('meta_access_expires_at')
    if (expiresAtCookie) {
      const expiresAt = parseInt(expiresAtCookie.value, 10)
      if (Date.now() >= expiresAt) {
        return NextResponse.json({
          ok: false,
          error: 'token_expired',
          message: 'Access token has expired',
        }, { status: 200 })
      }
    }

    const { searchParams } = new URL(request.url)
    const adAccountId = searchParams.get('adAccountId')

    if (!adAccountId) {
      return NextResponse.json({
        ok: false,
        error: 'adAccountId_required',
        message: 'adAccountId is required',
      }, { status: 200 })
    }

    // Ensure ad_account_id starts with 'act_'
    const accountId = adAccountId.startsWith('act_')
      ? adAccountId
      : `act_${adAccountId.replace('act_', '')}`

    // Check cache first
    const cacheKey = getCacheKey('meta', accountId, 'default', 'performance_recommendations')
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json({ ok: true, ...cached })
    }

    // Fetch with rate-limit aware retry
    let response: Response
    let errorDataParsed: any = null
    
    try {
      const result = await metaFetchWithRateLimit(
        () => metaGraphFetch(
          `/${accountId}/performance_recommendations`,
          accessToken.value,
          {
            params: {
              fields: 'id,recommendation_type,recommendation_title,recommendation_message,level,entity_id,entity_type,impact,default_action,created_time,status',
              limit: '200',
            },
          }
        ),
        3
      )
      
      response = result.response
      errorDataParsed = result.errorData || null
    } catch (fetchError) {
      return NextResponse.json({
        ok: false,
        error: 'meta_api_error',
        message: 'Failed to fetch performance recommendations',
        details: fetchError instanceof Error ? fetchError.message : 'Unknown error',
        code: undefined,
        subcode: undefined,
        fbtrace_id: undefined,
      }, { status: 200 })
    }

    // Handle non-OK response
    if (!response.ok) {
      // Use errorData from metaFetchWithRateLimit (already parsed)
      const errorData = errorDataParsed || { error: { message: `HTTP ${response.status}` } }
      const fbtraceId = extractFbTraceId(errorData)
      const isRateLimit = isRateLimitError(errorData)

      return NextResponse.json({
        ok: false,
        error: isRateLimit ? 'rate_limit_exceeded' : 'meta_api_error',
        message: isRateLimit
          ? 'Meta rate limit reached. Please wait and retry.'
          : 'Failed to fetch performance recommendations',
        details: errorData?.error || errorData,
        code: errorData?.error?.code,
        subcode: errorData?.error?.error_subcode,
        fbtrace_id: fbtraceId,
      }, { status: 200 }) // Always return 200 with ok:false
    }

    // Parse successful response
    let data: any = {}
    try {
      const text = await response.text()
      if (text) {
        data = JSON.parse(text)
      }
    } catch (parseError) {
      return NextResponse.json({
        ok: false,
        error: 'meta_api_error',
        message: 'Failed to parse Meta API response',
        details: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        code: undefined,
        subcode: undefined,
        fbtrace_id: undefined,
      }, { status: 200 })
    }

    const rawItems = data?.data || []

    // Defensive normalization
    const items: PerfRecItem[] = (Array.isArray(rawItems) ? rawItems : []).map((item: any) => ({
      id: item.id || '',
      title: item.recommendation_title || item.title || item.name || '',
      message: item.recommendation_message || item.message || item.description || '',
      type: item.recommendation_type || item.type || '',
      entityId: item.entity_id || item.object_id || null,
      entityType: item.entity_type || item.level || 'ACCOUNT',
      impact: item.impact || null,
      defaultAction: item.default_action || null,
      createdTime: item.created_time || null,
      status: item.status || 'ACTIVE',
    }))

    // Generate summary
    const byCampaignId: Record<string, number> = {}
    items.forEach((item: PerfRecItem) => {
      if (item.entityType === 'CAMPAIGN' && item.entityId) {
        const campaignId = String(item.entityId)
        byCampaignId[campaignId] = (byCampaignId[campaignId] || 0) + 1
      }
    })

    const result = {
      ok: true,
      items,
      summary: {
        total: items.length,
        byCampaignId,
      },
    }

    // Cache result
    setCached(cacheKey, result)

    return NextResponse.json(result)
  } catch (error) {
    if (DEBUG) console.error('Performance recommendations fetch error:', error)
      return NextResponse.json({
        ok: false,
        error: 'meta_api_error',
        message: 'An unexpected error occurred while fetching performance recommendations',
        details: error instanceof Error ? error.message : 'Unknown error',
        code: undefined,
        subcode: undefined,
        fbtrace_id: undefined,
      }, { status: 200 }) // Always return 200 with ok:false, never 502
  }
}
