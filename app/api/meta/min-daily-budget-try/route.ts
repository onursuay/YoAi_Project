import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'
import { getMinDailyBudgetTry } from '@/lib/meta/minDailyBudget'
import { getFxRatesForMinBudget } from '@/lib/fx/usdTry'

export const dynamic = 'force-dynamic'

/**
 * GET /api/meta/min-daily-budget-try
 *   ?optimizationGoal=LINK_CLICKS
 *   &objective=OUTCOME_TRAFFIC          (cache key)
 *   &bidMode=auto|cap                   (cache key)
 *
 * 200: { ok:true, minDailyBudgetTry: number }
 * 503: { ok:false, error:{ message:"min_budget_unavailable" } }
 *
 * Uses shared lib/fx/usdTry (origin-independent, env fallback).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const optimizationGoal = searchParams.get('optimizationGoal') || 'LINK_CLICKS'
    const objective = searchParams.get('objective') || 'OUTCOME_TRAFFIC'
    const bidMode = searchParams.get('bidMode') || 'auto'

    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json({ ok: false, error: { message: 'missing_token' } }, { status: 401 })
    }

    const accountRes = await metaClient.client.get<{ currency?: string }>(
      `/${metaClient.accountId}`,
      { fields: 'currency' },
    )
    if (!accountRes.ok || !accountRes.data?.currency) {
      console.error('[min-daily-budget-try] Cannot determine account currency')
      return NextResponse.json(
        { ok: false, error: { message: 'min_budget_unavailable' } },
        { status: 503 },
      )
    }
    const accountCurrency = accountRes.data.currency

    const fxRates = await getFxRatesForMinBudget(accountCurrency)
    if (!fxRates.ok) {
      return NextResponse.json(
        { ok: false, error: { message: 'min_budget_unavailable' } },
        { status: 503 },
      )
    }

    const result = await getMinDailyBudgetTry({
      client: metaClient.client,
      adAccountId: metaClient.accountId,
      currency: accountCurrency,
      objective,
      optimizationGoal,
      bidMode,
      fxRate: fxRates.fxRate,
      usdTryRate: fxRates.usdTryRate,
    })

    if (!result.ok) {
      console.error('[min-daily-budget-try] Helper error:', result.error)
      return NextResponse.json(
        { ok: false, error: { message: 'min_budget_unavailable' } },
        { status: 503 },
      )
    }

    return NextResponse.json({
      ok: true,
      minDailyBudgetTry: result.minDailyBudgetTry,
      approxUsd: 1,
      fx: {
        usdTry: fxRates.usdTryRate,
        asOf: new Date().toISOString(),
        source: 'lib/fx/usdTry',
      },
      reason: 'META_MIN_DAILY_BUDGET',
    })
  } catch (err) {
    console.error('[min-daily-budget-try] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { ok: false, error: { message: 'min_budget_unavailable' } },
      { status: 503 },
    )
  }
}
