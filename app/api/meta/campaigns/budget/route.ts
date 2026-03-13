import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'
import { toMetaMinorUnits } from '@/lib/meta/currency'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let campaignId: string | undefined
  let dailyBudget: number | undefined
  let lifetimeBudget: number | undefined
  
  try {
    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'No access token or ad account selected' },
        { status: 401 }
      )
    }

    // Parse request body safely
    let body: any = {}
    try {
      body = await request.json()
    } catch (parseError) {
      if (DEBUG) console.error('[Campaign Budget] Request body parse error:', parseError)
      return NextResponse.json(
        { ok: false, error: 'invalid_input', code: 'INVALID_REQUEST_BODY', message: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    campaignId = body.campaignId
    dailyBudget = body.dailyBudget !== undefined ? (typeof body.dailyBudget === 'string' ? parseFloat(body.dailyBudget) : body.dailyBudget) : undefined
    lifetimeBudget = body.lifetimeBudget !== undefined ? (typeof body.lifetimeBudget === 'string' ? parseFloat(body.lifetimeBudget) : body.lifetimeBudget) : undefined

    // Request body validation
    if (!campaignId || typeof campaignId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', code: 'MISSING_CAMPAIGN_ID', message: 'campaignId is required' },
        { status: 400 }
      )
    }

    // Validate budget: at least one must be provided and valid
    const budget = dailyBudget !== undefined ? dailyBudget : lifetimeBudget
    if (budget === undefined || !Number.isFinite(budget) || budget <= 0) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', code: 'INVALID_BUDGET', message: 'Valid budget value is required (must be > 0)' },
        { status: 400 }
      )
    }

    // Convert main unit to minor units using account currency
    const accountRes = await metaClient.client.get<{ currency?: string }>(`/${metaClient.accountId}`, { fields: 'currency' })
    const accountCurrency = accountRes.ok && typeof accountRes.data?.currency === 'string' ? accountRes.data.currency : 'USD'
    const budgetMinor = toMetaMinorUnits(budget, accountCurrency)
    const budgetMinorNum = parseInt(budgetMinor, 10)
    if (!Number.isFinite(budgetMinorNum) || budgetMinorNum <= 0) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', code: 'INVALID_BUDGET', message: 'Budget conversion to minor units failed' },
        { status: 400 }
      )
    }

    // Prepare Meta API call
    const formData = new URLSearchParams()
    if (dailyBudget !== undefined) {
      formData.append('daily_budget', budgetMinor)
    } else if (lifetimeBudget !== undefined) {
      formData.append('lifetime_budget', budgetMinor)
    }

    // Call Meta API
    const result = await metaClient.client.postForm(`/${campaignId}`, formData)

    if (!result.ok) {
      // Meta API error - parse details
      const metaError = result.error
      const metaMessage = metaError?.message || 'Failed to update campaign budget'
      const metaCode = metaError?.code
      const metaSubcode = metaError?.subcode
      const fbtraceId = metaError?.fbtrace_id

      if (DEBUG) console.error('[Campaign Budget] Meta API error:', {
        endpoint: `/api/meta/campaigns/budget`,
        campaignId,
        dailyBudget,
        lifetimeBudget,
        budgetMinor,
        metaCode,
        metaSubcode,
        metaMessage,
        fbtraceId,
      })

      // Determine HTTP status: Meta 400/403/429 -> 400, others -> 400 (never 502)
      const httpStatus = metaCode === 403 ? 403 :
                         metaCode === 400 ? 400 :
                         metaCode === 429 ? 429 : 400

      return NextResponse.json(
        {
          ok: false,
          error: metaError?.type === 'RateLimit' ? 'rate_limit_exceeded' :
                 metaCode === 403 ? 'permission_denied' :
                 metaCode === 400 ? 'validation_error' :
                 'meta_api_error',
          code: 'META_API_ERROR',
          message: metaMessage,
          meta: {
            message: metaMessage,
            code: metaCode,
            subcode: metaSubcode,
            fbtraceId,
          },
        },
        { status: httpStatus }
      )
    }

    // Success
    return NextResponse.json({
      ok: true,
      campaignId,
      budgetType: dailyBudget !== undefined ? 'daily' : 'lifetime',
      budget: budget,
      data: result.data,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    })
  } catch (error) {
    if (DEBUG) console.error('[Campaign Budget] Unexpected error:', {
      endpoint: `/api/meta/campaigns/budget`,
      campaignId,
      dailyBudget,
      lifetimeBudget,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        ok: false,
        error: 'server_error',
        code: 'SERVER_ERROR',
        message: 'Server error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
