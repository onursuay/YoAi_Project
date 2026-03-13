import { searchGAds, buildGoogleAdsHeaders, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'
import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'

export type AudienceCriterionType = 'USER_LIST' | 'USER_INTEREST' | 'CUSTOM_AUDIENCE' | 'COMBINED_AUDIENCE'
export type AudienceSegmentCategory =
  | 'AFFINITY' | 'IN_MARKET' | 'DETAILED_DEMOGRAPHIC' | 'LIFE_EVENT'
  | 'USER_LIST' | 'CUSTOM_AUDIENCE' | 'COMBINED_AUDIENCE'

export interface ExistingAudienceCriterion {
  resourceName: string
  criterionId: string
  type: AudienceCriterionType
  displayName: string
  status: string
  bidModifier: number | null
  segmentResourceName: string
}

/* ── NAME RESOLUTION ── */

/**
 * Check if a display name is an unresolved internal key.
 * Patterns: "uservertical::80980", "userlist::12345", raw number "80980", empty string
 */
function isInternalDisplayName(name: string): boolean {
  if (!name) return true
  return name.includes('::') || /^\d+$/.test(name)
}

/**
 * SANITIZE: Guarantee no internal key ever reaches the UI.
 * Call this at every output boundary.
 */
export function sanitizeDisplayName(name: string | undefined | null): string {
  if (!name) return 'Bilinmeyen Segment'
  if (name.includes('::') || /^\d+$/.test(name)) return 'Bilinmeyen Segment'
  return name
}

/**
 * Extract the numeric ID from an internal key.
 * "uservertical::80980" → "80980"
 * "80980" → "80980"
 */
function extractIdFromInternalKey(name: string): string {
  if (name.includes('::')) return name.split('::').pop() || ''
  return name
}

/* ── Server-side user_interest name cache ──
 * Fetches ALL user interests (AFFINITY + IN_MARKET) on first call.
 * Cached in server memory — never expires during process lifetime.
 * User interest taxonomy is static, so this is safe. */
const userInterestNameCache = new Map<string, string>()
let uiCacheLoaded = false

async function ensureUserInterestCache(ctx: Ctx): Promise<void> {
  if (uiCacheLoaded) return
  uiCacheLoaded = true

  for (const taxonomyType of ['AFFINITY', 'IN_MARKET', 'LIFE_EVENT']) {
    const query = `
      SELECT user_interest.user_interest_id, user_interest.name
      FROM user_interest
      WHERE user_interest.taxonomy_type = '${taxonomyType}'
      LIMIT 2000
    `
    try {
      const rows = await searchGAds<any>(ctx, query)
      for (const r of rows) {
        const ui = r.userInterest ?? r.user_interest ?? {}
        const id = String(ui.userInterestId ?? ui.user_interest_id ?? '')
        const name = ui.name ?? ''
        if (id && name) userInterestNameCache.set(id, name)
      }
    } catch (e) {
      console.error(`[audience-criteria] Failed to load ${taxonomyType} user interests:`, e)
    }
  }
  console.log(`[audience-criteria] User interest name cache loaded: ${userInterestNameCache.size} entries`)
}

/**
 * Resolve user_interest IDs to human-readable names.
 * Uses the full taxonomy cache (fast, no per-call GAQL query).
 * Exported so audience-view routes can also use it.
 */
export async function resolveUserInterestNames(
  ctx: Ctx,
  ids: string[],
): Promise<Map<string, string>> {
  await ensureUserInterestCache(ctx)

  const result = new Map<string, string>()
  for (const id of ids) {
    const name = userInterestNameCache.get(id)
    if (name) result.set(id, name)
  }
  return result
}

/**
 * Enrich criteria list: resolve internal display names (uservertical::XXXXX)
 * to human-readable names using the cached user_interest taxonomy.
 * Any remaining internal keys are replaced with "Bilinmeyen Segment".
 */
async function enrichDisplayNames(ctx: Ctx, criteria: ExistingAudienceCriterion[]): Promise<void> {
  const hasUnresolved = criteria.some(c => isInternalDisplayName(c.displayName))
  if (!hasUnresolved) return

  await ensureUserInterestCache(ctx)

  for (const c of criteria) {
    if (isInternalDisplayName(c.displayName)) {
      // Try multiple ID sources to resolve the name
      const idFromKey = extractIdFromInternalKey(c.displayName)
      // Also try extracting ID from segmentResourceName (e.g., "customers/123/userInterests/80980" → "80980")
      const idFromResource = c.segmentResourceName?.split('/')?.pop() || ''
      const resolved = userInterestNameCache.get(idFromKey)
        || userInterestNameCache.get(c.criterionId)
        || userInterestNameCache.get(idFromResource)
      if (resolved) {
        c.displayName = resolved
      } else {
        console.warn(`[audience-criteria] Unresolved criterion: id=${c.criterionId}, type=${c.type}, displayName=${c.displayName}, segmentResource=${c.segmentResourceName}`)
        c.displayName = 'Bilinmeyen Segment'
      }
    }
  }
}

/* ── READ ── */

export async function listCampaignAudienceCriteria(ctx: Ctx, campaignId: string): Promise<ExistingAudienceCriterion[]> {
  const query = `
    SELECT
      campaign.id,
      campaign_criterion.resource_name,
      campaign_criterion.criterion_id,
      campaign_criterion.type,
      campaign_criterion.display_name,
      campaign_criterion.status,
      campaign_criterion.bid_modifier,
      campaign_criterion.user_list.user_list,
      campaign_criterion.user_interest.user_interest_category,
      campaign_criterion.custom_audience.custom_audience,
      campaign_criterion.combined_audience.combined_audience
    FROM campaign_criterion
    WHERE campaign.id = ${campaignId}
      AND campaign_criterion.type IN ('USER_LIST', 'USER_INTEREST', 'CUSTOM_AUDIENCE', 'COMBINED_AUDIENCE')
      AND campaign_criterion.status != 'REMOVED'
  `
  const rows = await searchGAds<any>(ctx, query)
  const criteria = rows.map(mapCampaignCriterion)
  await enrichDisplayNames(ctx, criteria)
  return criteria
}

export async function listAdGroupAudienceCriteria(ctx: Ctx, adGroupId: string): Promise<ExistingAudienceCriterion[]> {
  const query = `
    SELECT
      ad_group.id,
      ad_group_criterion.resource_name,
      ad_group_criterion.criterion_id,
      ad_group_criterion.type,
      ad_group_criterion.display_name,
      ad_group_criterion.status,
      ad_group_criterion.bid_modifier,
      ad_group_criterion.user_list.user_list,
      ad_group_criterion.user_interest.user_interest_category,
      ad_group_criterion.custom_audience.custom_audience,
      ad_group_criterion.combined_audience.combined_audience
    FROM ad_group_criterion
    WHERE ad_group.id = ${adGroupId}
      AND ad_group_criterion.type IN ('USER_LIST', 'USER_INTEREST', 'CUSTOM_AUDIENCE', 'COMBINED_AUDIENCE')
      AND ad_group_criterion.status != 'REMOVED'
  `
  const rows = await searchGAds<any>(ctx, query)
  const criteria = rows.map(mapAdGroupCriterion)
  await enrichDisplayNames(ctx, criteria)
  return criteria
}

function mapCampaignCriterion(r: any): ExistingAudienceCriterion {
  const c = r.campaignCriterion ?? r.campaign_criterion ?? {}
  return {
    resourceName: c.resourceName ?? c.resource_name ?? '',
    criterionId: String(c.criterionId ?? c.criterion_id ?? ''),
    type: c.type ?? '',
    displayName: c.displayName ?? c.display_name ?? '',
    status: c.status ?? 'ENABLED',
    bidModifier: c.bidModifier ?? c.bid_modifier ?? null,
    segmentResourceName: extractSegmentResource(c),
  }
}

function mapAdGroupCriterion(r: any): ExistingAudienceCriterion {
  const c = r.adGroupCriterion ?? r.ad_group_criterion ?? {}
  return {
    resourceName: c.resourceName ?? c.resource_name ?? '',
    criterionId: String(c.criterionId ?? c.criterion_id ?? ''),
    type: c.type ?? '',
    displayName: c.displayName ?? c.display_name ?? '',
    status: c.status ?? 'ENABLED',
    bidModifier: c.bidModifier ?? c.bid_modifier ?? null,
    segmentResourceName: extractSegmentResource(c),
  }
}

function extractSegmentResource(c: any): string {
  const ul = c.userList ?? c.user_list
  if (ul) return ul.userList ?? ul.user_list ?? ''
  const ui = c.userInterest ?? c.user_interest
  if (ui) return ui.userInterestCategory ?? ui.user_interest_category ?? ''
  const ca = c.customAudience ?? c.custom_audience
  if (ca) return ca.customAudience ?? ca.custom_audience ?? ''
  const comb = c.combinedAudience ?? c.combined_audience
  if (comb) return comb.combinedAudience ?? comb.combined_audience ?? ''
  return ''
}

/* ── WRITE ── */

type SegmentInput = { resourceName: string; category: AudienceSegmentCategory; id: string }

const CATEGORY_FIELD: Record<AudienceSegmentCategory, (rn: string) => Record<string, any>> = {
  USER_LIST:              (rn) => ({ userList: { userList: rn } }),
  AFFINITY:               (rn) => ({ userInterest: { userInterestCategory: rn } }),
  IN_MARKET:              (rn) => ({ userInterest: { userInterestCategory: rn } }),
  DETAILED_DEMOGRAPHIC:   (rn) => ({ userInterest: { userInterestCategory: rn } }),
  LIFE_EVENT:             (rn) => ({ userInterest: { userInterestCategory: rn } }),
  CUSTOM_AUDIENCE:        (rn) => ({ customAudience: { customAudience: rn } }),
  COMBINED_AUDIENCE:      (rn) => ({ combinedAudience: { combinedAudience: rn } }),
}

export async function addCampaignAudienceCriteria(
  ctx: Ctx,
  campaignResourceName: string,
  segments: SegmentInput[],
  bidOnly: boolean,
): Promise<void> {
  if (!segments.length) return
  const operations = segments.map(s => ({
    create: {
      campaign: campaignResourceName,
      ...CATEGORY_FIELD[s.category](s.resourceName),
      ...(bidOnly ? { bidOnly: true } : {}),
    },
  }))
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'addCampaignAudienceCriteria failed') }
}

export async function addAdGroupAudienceCriteria(
  ctx: Ctx,
  adGroupResourceName: string,
  segments: SegmentInput[],
  bidOnly: boolean,
): Promise<void> {
  if (!segments.length) return
  const operations = segments.map(s => ({
    create: {
      adGroup: adGroupResourceName,
      ...CATEGORY_FIELD[s.category](s.resourceName),
      ...(bidOnly ? { bidOnly: true } : {}),
    },
  }))
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroupCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'addAdGroupAudienceCriteria failed') }
}

export async function removeCampaignAudienceCriteria(ctx: Ctx, resourceNames: string[]): Promise<void> {
  if (!resourceNames.length) return
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations: resourceNames.map(rn => ({ remove: rn })) }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'removeCampaignAudienceCriteria failed') }
}

export async function removeAdGroupAudienceCriteria(ctx: Ctx, resourceNames: string[]): Promise<void> {
  if (!resourceNames.length) return
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroupCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations: resourceNames.map(rn => ({ remove: rn })) }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'removeAdGroupAudienceCriteria failed') }
}
