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
import { getResultTypeFromObjective, extractResultsCount } from '@/lib/meta/resultExtraction'

const DEBUG = process.env.NODE_ENV !== 'production'
// No cache - always fresh data
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const datePreset = searchParams.get('date_preset')
  const since = searchParams.get('since')
  const until = searchParams.get('until')
  const after = searchParams.get('after') || null
  const adAccountIdParam = searchParams.get('adAccountId')

  const cookieStore = await cookies()
  const accessToken = cookieStore.get('meta_access_token')
  const selectedAdAccountIdCookie = cookieStore.get('meta_selected_ad_account_id')

  if (!accessToken || !accessToken.value) {
    return NextResponse.json({ error: 'missing_token' }, { status: 401 })
  }

  // adAccountId is required: prefer query param, fallback to cookie
  const selectedAdAccountId = adAccountIdParam || selectedAdAccountIdCookie?.value
  if (!selectedAdAccountId) {
    return NextResponse.json(
      { 
        ok: false,
        error: 'MISSING_AD_ACCOUNT_ID',
        code: 'MISSING_AD_ACCOUNT_ID',
        message: 'adAccountId is required in query params or cookies'
      },
      { status: 400 }
    )
  }

  const expiresAtCookie = cookieStore.get('meta_access_expires_at')
  if (expiresAtCookie) {
    const expiresAt = parseInt(expiresAtCookie.value, 10)
    if (Date.now() >= expiresAt) {
      return NextResponse.json({ error: 'token_expired' }, { status: 401 })
    }
  }

  try {
    const accountId = selectedAdAccountId.startsWith('act_')
      ? selectedAdAccountId
      : `act_${selectedAdAccountId.replace('act_', '')}`

    const cacheParams = { date_preset: datePreset || '', since: since || '', until: until || '', after: after || '' }
    const cacheKey = getListCacheKey('/campaigns', cacheParams, accountId)
    const cached = getListCached(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'no-store, max-age=10' },
      })
    }

    // Guard: never send both date_preset and time_range simultaneously
    const safeSince = datePreset ? null : since
    const safeUntil = datePreset ? null : until

    // Build inline insights field — fetches campaign data + metrics in a single API call
    const insightsFields = 'spend,impressions,clicks,ctr,cpc,reach,actions,action_values,purchase_roas'
    let insightsModifier = ''
    if (safeSince && safeUntil) {
      insightsModifier = `insights.time_range(${JSON.stringify({ since: safeSince, until: safeUntil })}){${insightsFields}}`
    } else if (datePreset) {
      insightsModifier = `insights.date_preset(${datePreset}){${insightsFields}}`
    } else {
      insightsModifier = `insights.date_preset(maximum){${insightsFields}}`
    }
    if (DEBUG) console.log('[Meta Campaigns] dateFilter:', { datePreset, since: safeSince, until: safeUntil, omittedDateParams: !datePreset && !safeSince && !safeUntil })

    const campaignParams: Record<string, string> = {
      fields: `id,name,status,effective_status,objective,daily_budget,lifetime_budget,${insightsModifier}`,
      limit: '50',
      effective_status: '["ACTIVE","PAUSED","PENDING_REVIEW","IN_PROCESS","PREAPPROVED","WITH_ISSUES","CAMPAIGN_PAUSED","ADSET_PAUSED"]',
    }
    if (after) campaignParams.after = after

    const fetchResult = await withLock(`act:${accountId}`, async () => {
      const { response, errorData, retryAfterMs } = await fetchWithBackoff(
        () => metaGraphFetch(`/${accountId}/campaigns`, accessToken.value, { params: campaignParams }),
        3
      )
      return { response, errorData, retryAfterMs }
    })

    const { response: campaignResponse, errorData: campaignErrorData, retryAfterMs } = fetchResult

    if (!campaignResponse.ok) {
      const errorData = campaignErrorData || {}
      const fbtraceId = extractFbTraceId(errorData)
      const isRateLimit = campaignResponse.status === 429 || isRateLimitError(errorData)
      const isAuthError = campaignResponse.status === 401 || errorData.error?.code === 190 || [463, 467].includes(errorData.error?.error_subcode)

      return NextResponse.json(
        {
          ok: false,
          error: isAuthError ? 'token_expired' : isRateLimit ? 'rate_limit_exceeded' : 'meta_api_error',
          message: isRateLimit
            ? 'Meta rate limit reached. Please wait and retry.'
            : `Meta API returned ${campaignResponse.status}`,
          details: errorData.error || { message: `HTTP ${campaignResponse.status}` },
          code: errorData.error?.code,
          subcode: errorData.error?.error_subcode,
          fbtrace_id: fbtraceId,
          retryAfterMs: isRateLimit ? (retryAfterMs ?? 4000) : undefined,
        },
        { status: isAuthError ? 401 : isRateLimit ? 429 : 502 }
      )
    }

    const campaignData = await campaignResponse.json().catch(() => ({ data: [] }))
    const campaigns = campaignData.data || []
    if (campaigns.length === 0) {
      const emptyResult = { ok: true, data: [], paging: {} }
      return NextResponse.json(emptyResult, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      })
    }

    const enrichedCampaigns = campaigns.map((campaign: any) => {
      const insight = campaign.insights?.data?.[0] || null
      // status = configured status (ACTIVE/PAUSED) — toggle buna bağlı
      const configuredStatus = campaign.status || 'UNKNOWN'
      // effective_status = Meta'nın anlık durumu — sadece bilgi/rozet amaçlı
      const effectiveStatus = campaign.effective_status || configuredStatus
      const dailyBudget = campaign.daily_budget != null ? parseFloat(campaign.daily_budget) / 100 : null
      const lifetimeBudget = campaign.lifetime_budget != null ? parseFloat(campaign.lifetime_budget) / 100 : null
      
      // Use daily_budget if available, otherwise lifetime_budget, otherwise null
      const budget = dailyBudget != null ? dailyBudget : (lifetimeBudget != null ? lifetimeBudget : null)

      const spend = insight?.spend ? parseFloat(insight.spend) : 0
      const impressions = insight?.impressions ? parseInt(insight.impressions, 10) : 0
      const clicks = insight?.clicks ? parseInt(insight.clicks, 10) : 0
      const ctr = insight?.ctr ? parseFloat(insight.ctr) : 0
      const cpc = insight?.cpc ? parseFloat(insight.cpc) : 0
      const reach = insight?.reach ? parseInt(insight.reach, 10) : 0

      let purchases = 0
      let engagement = 0
      if (insight?.actions) {
        const purchaseAction = insight.actions.find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase')
        if (purchaseAction) purchases = parseInt(purchaseAction.value || '0', 10)
        const engagementAction = insight.actions.find((a: any) => a.action_type === 'post_engagement')
        if (engagementAction) engagement = parseInt(engagementAction.value || '0', 10)
      }

      let roas = 0
      if (insight?.purchase_roas) {
        roas = parseFloat(insight.purchase_roas)
      } else if (insight?.action_values && spend > 0) {
        const purchaseValue = insight.action_values.find((av: any) => av.action_type === 'purchase' || av.action_type === 'omni_purchase')
        if (purchaseValue) roas = parseFloat(purchaseValue.value || '0') / spend
      }

      const objective = campaign.objective || ''
      const resultType = getResultTypeFromObjective(objective)
      const results = extractResultsCount(resultType, insight)

      return {
        id: campaign.id,
        name: campaign.name || 'Unnamed Campaign',
        status: configuredStatus,
        effective_status: effectiveStatus,
        statusLabel: getStatusLabel(effectiveStatus),
        statusColor: getStatusColor(effectiveStatus),
        objective,
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
        reach,
        engagement,
        purchases,
        roas: roas > 0 ? roas : null,
      }
    })

    const result = {
      ok: true,
      data: enrichedCampaigns,
      paging: campaignData.paging?.cursors?.after ? { nextCursor: campaignData.paging.cursors.after } : {},
    }
    setListCached(cacheKey, result)

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (error) {
    if (DEBUG) console.error('Campaigns fetch error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: 'server_error',
        message: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    'ACTIVE': 'Aktif', 'PAUSED': 'Duraklatıldı', 'ARCHIVED': 'Arşivlendi', 'DELETED': 'Silindi',
    'IN_PROCESS': 'İşleniyor', 'DISAPPROVED': 'Reddedildi', 'PREAPPROVED': 'Ön Onaylı',
    'PENDING_REVIEW': 'İnceleme Bekliyor', 'PENDING_BILLING_INFO': 'Faturalama Bekliyor',
    'CAMPAIGN_PAUSED': 'Duraklatıldı', 'ADGROUP_PAUSED': 'Duraklatıldı', 'WITH_ISSUES': 'Sorunlu',
  }
  return statusMap[status] || status
}

function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    'ACTIVE': 'bg-green-100 text-green-800', 'PAUSED': 'bg-yellow-100 text-yellow-800',
    'ARCHIVED': 'bg-gray-100 text-gray-800', 'DELETED': 'bg-red-100 text-red-800',
    'IN_PROCESS': 'bg-blue-100 text-blue-800', 'DISAPPROVED': 'bg-red-100 text-red-800',
    'PREAPPROVED': 'bg-blue-100 text-blue-800', 'PENDING_REVIEW': 'bg-yellow-100 text-yellow-800',
    'PENDING_BILLING_INFO': 'bg-yellow-100 text-yellow-800', 'CAMPAIGN_PAUSED': 'bg-yellow-100 text-yellow-800',
    'ADGROUP_PAUSED': 'bg-yellow-100 text-yellow-800', 'WITH_ISSUES': 'bg-red-100 text-red-800',
  }
  return colorMap[status] || 'bg-gray-100 text-gray-800'
}
