import { NextResponse } from 'next/server'
import { getGoogleAdsContext, GOOGLE_ADS_BASE, buildGoogleAdsHeaders } from '@/lib/googleAdsAuth'
import { normalizeError, parseGoogleAdsResponse } from '@/lib/google-ads/errors'
import { MICROS } from '@/lib/google-ads/constants'

/**
 * POST /api/integrations/google-ads/campaigns/[campaignId]/update
 * Body: { name?, budget?, startDate?, endDate?, biddingStrategy?, targetCpaMicros?, targetRoas?,
 *         networkSettings?: { targetSearchNetwork, targetContentNetwork } }
 * Updates campaign fields. Budget is updated via campaignBudgets:mutate separately.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params
  const cid = String(campaignId || '').replace(/-/g, '').trim()
  if (!cid) {
    return NextResponse.json({ error: 'invalid_id', message: 'campaignId is required' }, { status: 400 })
  }

  let body: {
    name?: string
    budget?: number
    startDate?: string
    endDate?: string
    biddingStrategy?: string
    targetCpaMicros?: number
    targetRoas?: number
    networkSettings?: { targetSearchNetwork?: boolean; targetContentNetwork?: boolean }
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body', message: 'JSON body required' }, { status: 400 })
  }

  try {
    const ctx = await getGoogleAdsContext()
    const headers = buildGoogleAdsHeaders(ctx)
    const results: string[] = []

    // 1. Campaign fields update
    const campaignUpdate: any = { resourceName: `customers/${ctx.customerId}/campaigns/${cid}` }
    const campaignMask: string[] = []

    if (body.name !== undefined && body.name.trim() !== '') {
      campaignUpdate.name = body.name.trim()
      campaignMask.push('name')
    }

    if (body.startDate) {
      campaignUpdate.startDate = body.startDate
      campaignMask.push('start_date')
    }

    if (body.endDate) {
      campaignUpdate.endDate = body.endDate
      campaignMask.push('end_date')
    }

    if (body.networkSettings) {
      campaignUpdate.networkSettings = {
        targetGoogleSearch: true,
        targetSearchNetwork: body.networkSettings.targetSearchNetwork ?? true,
        targetContentNetwork: body.networkSettings.targetContentNetwork ?? false,
      }
      campaignMask.push('network_settings.target_search_network', 'network_settings.target_content_network')
    }

    // Bidding strategy
    if (body.biddingStrategy) {
      switch (body.biddingStrategy) {
        case 'MAXIMIZE_CLICKS':
          campaignUpdate.targetSpend = {}
          campaignMask.push('target_spend')
          break
        case 'MAXIMIZE_CONVERSIONS':
          campaignUpdate.maximizeConversions = body.targetCpaMicros
            ? { targetCpaMicros: String(body.targetCpaMicros) }
            : {}
          campaignMask.push('maximize_conversions')
          break
        case 'TARGET_CPA':
          campaignUpdate.targetCpa = { targetCpaMicros: String(body.targetCpaMicros ?? 0) }
          campaignMask.push('target_cpa')
          break
        case 'TARGET_ROAS':
          campaignUpdate.targetRoas = { targetRoas: body.targetRoas ?? 0 }
          campaignMask.push('target_roas')
          break
        case 'MANUAL_CPC':
          campaignUpdate.manualCpc = { enhancedCpcEnabled: false }
          campaignMask.push('manual_cpc')
          break
        case 'TARGET_IMPRESSION_SHARE':
          campaignUpdate.targetImpressionShare = {
            location: 'ANYWHERE_ON_PAGE',
            locationFractionMicros: '1000000',
          }
          campaignMask.push('target_impression_share')
          break
      }
    }

    if (campaignMask.length > 0) {
      const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaigns:mutate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operations: [{ update: campaignUpdate, updateMask: campaignMask.join(',') }],
        }),
      })
      if (!res.ok) {
        const parsed = await parseGoogleAdsResponse(res, 'campaign_update_failed')
        return NextResponse.json({ error: parsed.error, message: parsed.message }, { status: parsed.status })
      }
      results.push('campaign')
    }

    // 2. Budget update (separate resource)
    if (body.budget !== undefined && Number.isFinite(body.budget) && body.budget >= 0) {
      // First find the budget resource name
      const searchRes = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/googleAds:search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: `SELECT campaign.id, campaign.campaign_budget FROM campaign WHERE campaign.id = ${cid} LIMIT 1`,
        }),
      })
      if (searchRes.ok) {
        const searchData = await searchRes.json().catch(() => ({}))
        const first = searchData.results?.[0]
        const budgetRn = first?.campaign?.campaignBudget ?? first?.campaign?.campaign_budget
        if (budgetRn) {
          const budgetRes = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignBudgets:mutate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              operations: [{
                update: { resourceName: budgetRn, amountMicros: String(Math.round(body.budget * MICROS)) },
                updateMask: 'amount_micros',
              }],
            }),
          })
          if (!budgetRes.ok) {
            const parsed = await parseGoogleAdsResponse(budgetRes, 'budget_update_failed')
            return NextResponse.json({ error: parsed.error, message: parsed.message }, { status: parsed.status })
          }
          results.push('budget')
        }
      }
    }

    if (results.length === 0) {
      return NextResponse.json({ error: 'no_changes', message: 'No fields to update' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, campaignId: cid, updated: results })
  } catch (e: unknown) {
    const { error, message, status: errStatus } = normalizeError(e, 'campaign_update_failed', 500)
    return NextResponse.json({ error, message }, { status: errStatus })
  }
}
