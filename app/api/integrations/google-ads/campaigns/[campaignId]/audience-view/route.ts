import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { num, microsToUnits, getDefaultDateRange } from '@/lib/google-ads/helpers'
import { buildErrorResponse } from '@/lib/google-ads/errors'
import { resolveUserInterestNames, sanitizeDisplayName } from '@/lib/google-ads/audience-criteria'
import { translateAudienceName } from '@/lib/google-ads/audience-translations'

function buildMetricsQuery(campaignId: string, from: string, to: string): string {
  return `
  SELECT
    campaign.id,
    campaign_audience_view.resource_name,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    metrics.ctr,
    metrics.average_cpc
  FROM campaign_audience_view
  WHERE campaign.id = ${campaignId}
    AND segments.date BETWEEN '${from}' AND '${to}'
  ORDER BY metrics.impressions DESC
  LIMIT 500
  `.trim()
}

function buildCriterionLookupQuery(campaignId: string): string {
  return `
  SELECT
    campaign_criterion.criterion_id,
    campaign_criterion.display_name,
    campaign_criterion.type
  FROM campaign_criterion
  WHERE campaign.id = ${campaignId}
    AND campaign_criterion.type IN ('USER_LIST', 'USER_INTEREST', 'CUSTOM_AUDIENCE', 'COMBINED_AUDIENCE')
  `.trim()
}

export interface AudienceViewRow {
  resourceName: string
  displayName: string
  type: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
  ctr: number
  cpc: number
}

function isInternalKey(name: string): boolean {
  if (!name) return true
  return name.includes('::') || /^\d+$/.test(name)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  try {
    const { campaignId } = await params
    const ctx = await getGoogleAdsContext()

    const { searchParams } = new URL(req.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const { from, to } = fromParam && toParam
      ? { from: fromParam, to: toParam }
      : getDefaultDateRange()

    // Fetch metrics + criterion display names in parallel
    const [metricsRows, criteriaRows] = await Promise.all([
      searchGAds<any>(ctx, buildMetricsQuery(campaignId, from, to)),
      searchGAds<any>(ctx, buildCriterionLookupQuery(campaignId)),
    ])

    // Build criterion_id → { displayName, type } map
    const criterionMap = new Map<string, { displayName: string; type: string }>()
    for (const r of criteriaRows) {
      const c = r.campaignCriterion ?? r.campaign_criterion ?? {}
      const id = String(c.criterionId ?? c.criterion_id ?? '')
      if (id) {
        criterionMap.set(id, {
          displayName: c.displayName ?? c.display_name ?? '',
          type: c.type ?? '',
        })
      }
    }

    // Resolve internal keys (uservertical::XXXXX) using cached user_interest taxonomy
    // NOTE: criterion_id ≠ user_interest_id — extract user_interest_id from display_name
    const idsToResolve: string[] = []
    const criterionToUserInterestId = new Map<string, string>()
    for (const [id, info] of criterionMap) {
      if (isInternalKey(info.displayName) && info.type === 'USER_INTEREST') {
        // Extract user_interest_id from "uservertical::80980" or raw "80980"
        const userInterestId = info.displayName.includes('::')
          ? info.displayName.split('::').pop() || ''
          : info.displayName
        if (userInterestId) {
          idsToResolve.push(userInterestId)
          criterionToUserInterestId.set(id, userInterestId)
        }
      }
    }
    if (idsToResolve.length > 0) {
      const nameMap = await resolveUserInterestNames(ctx, idsToResolve)
      for (const [criterionId, userInterestId] of criterionToUserInterestId) {
        const resolved = nameMap.get(userInterestId)
        if (resolved) {
          const info = criterionMap.get(criterionId)!
          criterionMap.set(criterionId, { ...info, displayName: resolved })
        }
      }
    }

    // Get locale for translation
    const cookieStore = await cookies()
    const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr'

    const audiences: AudienceViewRow[] = metricsRows.map((r: any) => {
      const view = r.campaignAudienceView ?? r.campaign_audience_view ?? {}
      const m = r.metrics ?? {}

      const resName: string = view.resourceName ?? view.resource_name ?? ''
      const criterionId = resName.split('~').pop() || ''
      const enrichment = criterionMap.get(criterionId)

      // Sanitize internal keys, then translate to Turkish
      const sanitized = sanitizeDisplayName(enrichment?.displayName)
      const translated = sanitized === 'Bilinmeyen Segment' ? sanitized : translateAudienceName(sanitized, locale)

      return {
        resourceName: resName,
        displayName: translated,
        type: enrichment?.type || '',
        impressions: num(m.impressions),
        clicks: num(m.clicks),
        cost: microsToUnits(num(m.costMicros ?? m.cost_micros)),
        conversions: num(m.conversions),
        ctr: num(m.ctr) * 100,
        cpc: microsToUnits(num(m.averageCpc ?? m.average_cpc)),
      }
    })

    return NextResponse.json({ audiences, dateRange: { from, to } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'audience_view_failed', 'AudienceView')
    return NextResponse.json(body, { status })
  }
}
