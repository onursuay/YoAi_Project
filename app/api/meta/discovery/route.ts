import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'
import type { MetaApiError } from '@/lib/meta/client'
import { getDiscoveryCached, setDiscoveryCached, type CachedPatch } from '@/lib/meta/discoveryCache'

export const dynamic = 'force-dynamic'

const DISCOVERY_CAMPAIGN_NAME = 'Discovery validation (ignore)'

function normalizeObjective(input: string): string {
  const key = (input || '').trim().toUpperCase()
  const map: Record<string, string> = {
    AWARENESS: 'OUTCOME_AWARENESS',
    TRAFFIC: 'OUTCOME_TRAFFIC',
    ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
    LEADS: 'OUTCOME_LEADS',
    APP_PROMOTION: 'OUTCOME_APP_PROMOTION',
    SALES: 'OUTCOME_SALES',
    OUTCOME_AWARENESS: 'OUTCOME_AWARENESS',
    OUTCOME_TRAFFIC: 'OUTCOME_TRAFFIC',
    OUTCOME_ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
    OUTCOME_LEADS: 'OUTCOME_LEADS',
    OUTCOME_APP_PROMOTION: 'OUTCOME_APP_PROMOTION',
    OUTCOME_SALES: 'OUTCOME_SALES',
  }
  return map[key] || input
}

function buildCacheKey(body: {
  objective: string
  conversionGroup?: string
  destinationType?: string
  messagingDestinations?: Record<string, boolean>
  optimizationGoal?: string
}): string {
  const parts = [
    normalizeObjective(String(body.objective || '')),
    String(body.conversionGroup ?? ''),
    String(body.destinationType ?? ''),
    body.messagingDestinations ? JSON.stringify(body.messagingDestinations) : '',
    String(body.optimizationGoal ?? ''),
  ]
  return parts.join('|')
}

function parseMetaError(error: MetaApiError): CachedPatch {
  const msg = (error.error_user_msg ?? error.message ?? '').toString()
  const title = (error.error_user_title ?? '').toString()
  const requiredFieldsAdded: string[] = []
  let invalidCombination = false

  if (/Must specify True or False in (\w+)/i.test(msg)) {
    const m = msg.match(/Must specify True or False in (\w+)/i)
    if (m?.[1]) requiredFieldsAdded.push(m[1])
  }
  if (/Missing or invalid parameter/i.test(msg) && /(\w+)/.test(msg)) {
    const paramMatch = msg.match(/(?:parameter\s+)?['"]?(\w+)['"]?/i)
    if (paramMatch?.[1]) requiredFieldsAdded.push(paramMatch[1])
  }
  if (/destination_type|destination type/i.test(msg) || /optimization_goal|optimization goal/i.test(msg)) {
    invalidCombination = true
  }
  if (/invalid.*combination|uyumsuz|not valid for/i.test(msg)) {
    invalidCombination = true
  }

  return {
    requiredFieldsAdded: [...new Set(requiredFieldsAdded)],
    invalidCombination: invalidCombination || undefined,
    notes: [title, msg].filter(Boolean).join(' — '),
    meta_error: error as unknown as Record<string, unknown>,
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      objective,
      conversionGroup,
      destinationType,
      messagingDestinations,
      optimizationGoal,
      hasCampaignBudget,
      draftFields,
    } = body

    const cacheKey = buildCacheKey({
      objective,
      conversionGroup,
      destinationType,
      messagingDestinations,
      optimizationGoal,
    })

    const cached = await getDiscoveryCached(cacheKey)
    if (cached) {
      return NextResponse.json({ ok: true, specPatch: cached, fromCache: true })
    }

    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    const normalizedObjective = normalizeObjective(String(objective || 'OUTCOME_TRAFFIC'))
    const destType = String(destinationType || 'website').toUpperCase()
    const optGoal = String(optimizationGoal || 'LINK_CLICKS')
    const pageId = draftFields?.pageId || ''

    const campaignForm = new URLSearchParams()
    campaignForm.set('name', DISCOVERY_CAMPAIGN_NAME)
    campaignForm.set('objective', normalizedObjective)
    campaignForm.set('status', 'PAUSED')
    campaignForm.set('buying_type', 'AUCTION')
    campaignForm.set('is_adset_budget_sharing_enabled', hasCampaignBudget ? 'true' : 'false')
    // special_ad_categories: NONE için parametreyi hiç gönderme (Meta Invalid parameter önlenir)

    const campaignRes = await metaClient.client.postForm(
      `/${metaClient.accountId}/campaigns`,
      campaignForm
    )

    if (!campaignRes.ok) {
      const patch = parseMetaError(campaignRes.error!)
      await setDiscoveryCached(cacheKey, patch)
      return NextResponse.json({ ok: true, specPatch: patch })
    }

    const campaignId = campaignRes.data?.id
    if (!campaignId) {
      await setDiscoveryCached(cacheKey, { requiredFieldsAdded: [], notes: 'No campaign id' })
      return NextResponse.json({ ok: true, specPatch: { requiredFieldsAdded: [], notes: 'No campaign id' } })
    }

    const adsetForm = new URLSearchParams()
    adsetForm.append('campaign_id', campaignId)
    adsetForm.append('name', 'Discovery adset (ignore)')
    adsetForm.append('status', 'PAUSED')
    adsetForm.append('billing_event', 'IMPRESSIONS')
    adsetForm.append('optimization_goal', optGoal)
    adsetForm.append('bid_strategy', 'LOWEST_COST_WITHOUT_CAP')
    adsetForm.append('targeting', JSON.stringify({ geo_locations: { countries: ['TR'] }, age_min: 18, age_max: 65 }))
    if (destType === 'WEBSITE') adsetForm.append('destination_type', 'WEBSITE')
    if (pageId) adsetForm.append('promoted_object', JSON.stringify({ page_id: pageId }))

    const adsetRes = await metaClient.client.postForm(`/${metaClient.accountId}/adsets`, adsetForm)

    if (!adsetRes.ok) {
      const patch = parseMetaError(adsetRes.error!)
      await setDiscoveryCached(cacheKey, patch)
      try {
        await metaClient.client.delete(`/${campaignId}`)
      } catch {
        /* best effort delete */
      }
      return NextResponse.json({ ok: true, specPatch: patch })
    }

    const adsetId = adsetRes.data?.id
    try {
      if (adsetId) await metaClient.client.delete(`/${adsetId}`)
      await metaClient.client.delete(`/${campaignId}`)
    } catch {
      /* best effort cleanup */
    }

    const successPatch: CachedPatch = { requiredFieldsAdded: [] }
    await setDiscoveryCached(cacheKey, successPatch)
    return NextResponse.json({ ok: true, specPatch: successPatch })
  } catch (error) {
    console.error('[Discovery] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Discovery hatası' },
      { status: 500 }
    )
  }
}
