import { NextResponse } from 'next/server'
import { getGoogleAdsContext, GOOGLE_ADS_BASE, buildGoogleAdsHeaders } from '@/lib/googleAdsAuth'
import { normalizeError, parseGoogleAdsResponse } from '@/lib/google-ads/errors'
import { MICROS } from '@/lib/google-ads/constants'

const BUDGET_QUERY =
  'SELECT campaign.id, campaign.campaign_budget FROM campaign WHERE campaign.id = '

/**
 * POST /api/integrations/google-ads/campaigns/[campaignId]/budget
 * Body: { amount: number } (currency units, e.g. 1000.50)
 * Updates campaign budget amount via Google Ads API CampaignBudgetService.MutateCampaignBudgets.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params
  const cid = String(campaignId || '').replace(/-/g, '').trim()
  if (!cid) {
    return NextResponse.json(
      { error: 'invalid_campaign_id', message: 'campaignId is required' },
      { status: 400 }
    )
  }

  let body: { amount?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'JSON body with amount (number) required' },
      { status: 400 }
    )
  }

  const amount = typeof body.amount === 'number' ? body.amount : parseFloat(String(body.amount ?? ''))
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json(
      { error: 'invalid_amount', message: 'amount must be a non-negative number' },
      { status: 400 }
    )
  }

  const amountMicros = Math.round(amount * MICROS)

  try {
    const ctx = await getGoogleAdsContext()
    const headers = buildGoogleAdsHeaders(ctx)

    const searchUrl = `${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/googleAds:search`
    const searchRes = await fetch(searchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: BUDGET_QUERY + cid + ' LIMIT 1',
      }),
    })

    if (!searchRes.ok) {
      const parsed = await parseGoogleAdsResponse(searchRes, 'campaign_lookup_failed')
      return NextResponse.json(
        { error: parsed.error, message: parsed.message },
        { status: parsed.status }
      )
    }

    const searchData = await searchRes.json().catch(() => ({}))
    const results = searchData.results || []
    const first = results[0]
    const campaignBudgetRn =
      first?.campaign?.campaignBudget ?? first?.campaign?.campaign_budget ?? null

    if (!campaignBudgetRn) {
      return NextResponse.json(
        {
          error: 'no_budget',
          message: 'Campaign has no linked budget or budget is not editable',
        },
        { status: 400 }
      )
    }

    const mutateUrl = `${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignBudgets:mutate`
    const mutateRes = await fetch(mutateUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operations: [
          {
            update: {
              resourceName: campaignBudgetRn,
              amountMicros: String(amountMicros),
            },
            updateMask: 'amount_micros',
          },
        ],
      }),
    })

    if (!mutateRes.ok) {
      const parsed = await parseGoogleAdsResponse(mutateRes, 'budget_update_failed')
      return NextResponse.json(
        { error: parsed.error, message: parsed.message },
        { status: parsed.status }
      )
    }

    return NextResponse.json({
      ok: true,
      campaignId: cid,
      amount,
      amountMicros,
    })
  } catch (e: unknown) {
    const { error, message, status: errStatus } = normalizeError(e, 'budget_update_failed', 401)
    return NextResponse.json({ error, message }, { status: errStatus })
  }
}
