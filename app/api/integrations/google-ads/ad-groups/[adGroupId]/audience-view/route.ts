import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { num, microsToUnits, getDefaultDateRange } from '@/lib/google-ads/helpers'
import { buildErrorResponse } from '@/lib/google-ads/errors'
import { resolveUserInterestNames, sanitizeDisplayName } from '@/lib/google-ads/audience-criteria'
import { translateAudienceName } from '@/lib/google-ads/audience-translations'

function buildQuery(adGroupId: string, from: string, to: string): string {
  return `
  SELECT
    ad_group.id,
    ad_group_audience_view.resource_name,
    ad_group_criterion.criterion_id,
    ad_group_criterion.display_name,
    ad_group_criterion.type,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    metrics.ctr,
    metrics.average_cpc
  FROM ad_group_audience_view
  WHERE ad_group.id = ${adGroupId}
    AND segments.date BETWEEN '${from}' AND '${to}'
  ORDER BY metrics.impressions DESC
  LIMIT 500
  `.trim()
}

export interface AdGroupAudienceRow {
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ adGroupId: string }> }) {
  try {
    const { adGroupId } = await params
    const ctx = await getGoogleAdsContext()

    const { searchParams } = new URL(req.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const { from, to } = fromParam && toParam
      ? { from: fromParam, to: toParam }
      : getDefaultDateRange()

    const rows = await searchGAds<any>(ctx, buildQuery(adGroupId, from, to))

    // Build initial audience list + collect unresolved IDs
    // NOTE: criterion_id ≠ user_interest_id — extract user_interest_id from display_name
    const idsToResolve: string[] = []
    const indexToUserInterestId = new Map<number, string>()
    const rawAudiences = rows.map((r: any, idx: number) => {
      const view = r.adGroupAudienceView ?? r.ad_group_audience_view ?? {}
      const criterion = r.adGroupCriterion ?? r.ad_group_criterion ?? {}
      const m = r.metrics ?? {}

      const criterionId = String(criterion.criterionId ?? criterion.criterion_id ?? '')
      const displayName = (criterion.displayName ?? criterion.display_name) || ''
      const type = criterion.type ?? ''

      if (isInternalKey(displayName) && type === 'USER_INTEREST') {
        // Extract user_interest_id from "uservertical::80980" or raw "80980"
        const userInterestId = displayName.includes('::')
          ? displayName.split('::').pop() || ''
          : displayName
        if (userInterestId) {
          idsToResolve.push(userInterestId)
          indexToUserInterestId.set(idx, userInterestId)
        }
      }

      return {
        criterionId,
        resourceName: view.resourceName ?? view.resource_name ?? '',
        displayName,
        type,
        impressions: num(m.impressions),
        clicks: num(m.clicks),
        cost: microsToUnits(num(m.costMicros ?? m.cost_micros)),
        conversions: num(m.conversions),
        ctr: num(m.ctr) * 100,
        cpc: microsToUnits(num(m.averageCpc ?? m.average_cpc)),
      }
    })

    // Resolve internal keys using cached user_interest taxonomy
    let nameMap = new Map<string, string>()
    if (idsToResolve.length > 0) {
      nameMap = await resolveUserInterestNames(ctx, idsToResolve)
    }

    // Get locale for translation
    const cookieStore = await cookies()
    const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr'

    // Build clean output — SANITIZE every displayName + translate to Turkish
    const audiences: AdGroupAudienceRow[] = rawAudiences.map((a, idx) => {
      let resolvedName = a.displayName
      const userInterestId = indexToUserInterestId.get(idx)
      if (userInterestId) {
        resolvedName = nameMap.get(userInterestId) || resolvedName
      }
      const sanitized = sanitizeDisplayName(resolvedName)
      const translated = sanitized === 'Bilinmeyen Segment' ? sanitized : translateAudienceName(sanitized, locale)
      return {
        resourceName: a.resourceName,
        displayName: translated,
        type: a.type,
        impressions: a.impressions,
        clicks: a.clicks,
        cost: a.cost,
        conversions: a.conversions,
        ctr: a.ctr,
        cpc: a.cpc,
      }
    })

    return NextResponse.json({ audiences, dateRange: { from, to } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'ad_group_audience_failed', 'AdGroupAudienceView')
    return NextResponse.json(body, { status })
  }
}
