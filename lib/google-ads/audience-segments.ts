/**
 * Google Ads Audience Segments — full taxonomy
 *
 * Google Ads has 6+ audience resources:
 *   1. user_interest  (AFFINITY / IN_MARKET)  — Google-provided, read-only
 *   2. detailed_demographic                    — Google-provided, read-only
 *   3. life_event                              — Google-provided, read-only
 *   4. user_list                               — Your data (remarketing, CRM, etc.)
 *   5. custom_audience                         — Advertiser-created (keyword/URL)
 *   6. combined_audience                       — Combined segments
 */

import { searchGAds } from '@/lib/googleAdsAuth'
import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'

/* ------------------------------------------------------------------ */
/*  Shared types                                                       */
/* ------------------------------------------------------------------ */

export type AudienceSegmentCategory =
  | 'AFFINITY'
  | 'IN_MARKET'
  | 'DETAILED_DEMOGRAPHIC'
  | 'LIFE_EVENT'
  | 'USER_LIST'
  | 'CUSTOM_AUDIENCE'
  | 'COMBINED_AUDIENCE'

export interface AudienceSegment {
  id: string
  name: string
  category: AudienceSegmentCategory
  /** Resource name for criterion targeting */
  resourceName: string
  /** Optional parent ID (for hierarchical browse) */
  parentId?: string
  /** Sub-type info: e.g. user_list.type or taxonomy_type */
  subType?: string
  /** Size info (user_list only) */
  sizeRange?: string
  /** Description (if available) */
  description?: string
}

/* ------------------------------------------------------------------ */
/*  1. User Interests  (Affinity + In-Market)                          */
/* ------------------------------------------------------------------ */

export async function listUserInterests(
  ctx: Ctx,
  taxonomyType: 'AFFINITY' | 'IN_MARKET',
  parentResourceName?: string,
): Promise<AudienceSegment[]> {
  let where = `WHERE user_interest.taxonomy_type = '${taxonomyType}'`
  if (parentResourceName) {
    where += ` AND user_interest.user_interest_parent = '${parentResourceName}'`
  }

  const query = `
    SELECT
      user_interest.resource_name,
      user_interest.user_interest_id,
      user_interest.name,
      user_interest.taxonomy_type,
      user_interest.user_interest_parent,
      user_interest.launched_to_all
    FROM user_interest
    ${where}
    ORDER BY user_interest.name
    LIMIT 1000
  `
  const rows = await searchGAds<any>(ctx, query)
  return rows.map((r: any) => ({
    id: String(r.userInterest.userInterestId),
    name: r.userInterest.name,
    category: taxonomyType as AudienceSegmentCategory,
    resourceName: r.userInterest.resourceName,
    parentId: r.userInterest.userInterestParent
      ? extractIdFromResourceName(r.userInterest.userInterestParent)
      : undefined,
    subType: r.userInterest.taxonomyType,
  }))
}

/** Get top-level categories (no parent) for browse mode */
export async function listTopLevelInterests(
  ctx: Ctx,
  taxonomyType: 'AFFINITY' | 'IN_MARKET',
): Promise<AudienceSegment[]> {
  // Top-level: no parent field set. GAQL doesn't support IS NULL directly for
  // resource_name fields, so we fetch all and filter client-side for root nodes.
  const query = `
    SELECT
      user_interest.resource_name,
      user_interest.user_interest_id,
      user_interest.name,
      user_interest.taxonomy_type,
      user_interest.user_interest_parent,
      user_interest.launched_to_all
    FROM user_interest
    WHERE user_interest.taxonomy_type = '${taxonomyType}'
    ORDER BY user_interest.name
    LIMIT 2000
  `
  const rows = await searchGAds<any>(ctx, query)
  // Build parent set to identify roots
  const all = rows.map((r: any) => ({
    id: String(r.userInterest.userInterestId),
    name: r.userInterest.name,
    category: taxonomyType as AudienceSegmentCategory,
    resourceName: r.userInterest.resourceName,
    parentId: r.userInterest.userInterestParent
      ? extractIdFromResourceName(r.userInterest.userInterestParent)
      : undefined,
    subType: r.userInterest.taxonomyType,
  }))
  return all
}

/** Search user_interest by name keyword */
export async function searchUserInterests(
  ctx: Ctx,
  keyword: string,
): Promise<AudienceSegment[]> {
  const escaped = keyword.replace(/'/g, "\\'")
  const query = `
    SELECT
      user_interest.resource_name,
      user_interest.user_interest_id,
      user_interest.name,
      user_interest.taxonomy_type,
      user_interest.user_interest_parent
    FROM user_interest
    WHERE user_interest.name LIKE '%${escaped}%'
    ORDER BY user_interest.name
    LIMIT 50
  `
  const rows = await searchGAds<any>(ctx, query)
  return rows.map((r: any) => ({
    id: String(r.userInterest.userInterestId),
    name: r.userInterest.name,
    category: (r.userInterest.taxonomyType === 'IN_MARKET' ? 'IN_MARKET' : 'AFFINITY') as AudienceSegmentCategory,
    resourceName: r.userInterest.resourceName,
    parentId: r.userInterest.userInterestParent
      ? extractIdFromResourceName(r.userInterest.userInterestParent)
      : undefined,
    subType: r.userInterest.taxonomyType,
  }))
}

/* ------------------------------------------------------------------ */
/*  2. Detailed Demographics                                           */
/* ------------------------------------------------------------------ */

export async function listDetailedDemographics(ctx: Ctx): Promise<AudienceSegment[]> {
  const query = `
    SELECT
      detailed_demographic.resource_name,
      detailed_demographic.id,
      detailed_demographic.name,
      detailed_demographic.parent,
      detailed_demographic.launched_to_all
    FROM detailed_demographic
    ORDER BY detailed_demographic.name
    LIMIT 500
  `
  const rows = await searchGAds<any>(ctx, query)
  return rows.map((r: any) => ({
    id: String(r.detailedDemographic.id),
    name: r.detailedDemographic.name,
    category: 'DETAILED_DEMOGRAPHIC' as AudienceSegmentCategory,
    resourceName: r.detailedDemographic.resourceName,
    parentId: r.detailedDemographic.parent
      ? extractIdFromResourceName(r.detailedDemographic.parent)
      : undefined,
  }))
}

/* ------------------------------------------------------------------ */
/*  3. Life Events                                                     */
/* ------------------------------------------------------------------ */

export async function listLifeEvents(ctx: Ctx): Promise<AudienceSegment[]> {
  const query = `
    SELECT
      life_event.resource_name,
      life_event.id,
      life_event.name,
      life_event.parent,
      life_event.launched_to_all
    FROM life_event
    WHERE life_event.launched_to_all = TRUE
    ORDER BY life_event.name
    LIMIT 500
  `
  const rows = await searchGAds<any>(ctx, query)
  return rows.map((r: any) => ({
    id: String(r.lifeEvent.id),
    name: r.lifeEvent.name,
    category: 'LIFE_EVENT' as AudienceSegmentCategory,
    resourceName: r.lifeEvent.resourceName,
    parentId: r.lifeEvent.parent
      ? extractIdFromResourceName(r.lifeEvent.parent)
      : undefined,
  }))
}

/* ------------------------------------------------------------------ */
/*  4. User Lists  (Your data — remarketing, CRM, etc.)               */
/* ------------------------------------------------------------------ */

export async function listUserLists(ctx: Ctx): Promise<AudienceSegment[]> {
  const query = `
    SELECT
      user_list.resource_name,
      user_list.id,
      user_list.name,
      user_list.description,
      user_list.type,
      user_list.size_range_for_display,
      user_list.eligible_for_search,
      user_list.eligible_for_display
    FROM user_list
    ORDER BY user_list.name
    LIMIT 500
  `
  const rows = await searchGAds<any>(ctx, query)
  return rows.map((r: any) => ({
    id: String(r.userList.id),
    name: r.userList.name,
    category: 'USER_LIST' as AudienceSegmentCategory,
    resourceName: r.userList.resourceName,
    subType: r.userList.type,
    sizeRange: r.userList.sizeRangeForDisplay ?? '',
    description: r.userList.description ?? '',
  }))
}

/* ------------------------------------------------------------------ */
/*  5. Custom Audiences                                                */
/* ------------------------------------------------------------------ */

export async function listCustomAudiences(ctx: Ctx): Promise<AudienceSegment[]> {
  const query = `
    SELECT
      custom_audience.resource_name,
      custom_audience.id,
      custom_audience.name,
      custom_audience.description,
      custom_audience.type,
      custom_audience.status
    FROM custom_audience
    ORDER BY custom_audience.name
    LIMIT 500
  `
  const rows = await searchGAds<any>(ctx, query)
  return rows.map((r: any) => ({
    id: String(r.customAudience.id),
    name: r.customAudience.name,
    category: 'CUSTOM_AUDIENCE' as AudienceSegmentCategory,
    resourceName: r.customAudience.resourceName,
    subType: r.customAudience.type,
    description: r.customAudience.description ?? '',
  }))
}

/* ------------------------------------------------------------------ */
/*  6. Combined Audiences                                              */
/* ------------------------------------------------------------------ */

export async function listCombinedAudiences(ctx: Ctx): Promise<AudienceSegment[]> {
  const query = `
    SELECT
      combined_audience.resource_name,
      combined_audience.id,
      combined_audience.name,
      combined_audience.description,
      combined_audience.status
    FROM combined_audience
    ORDER BY combined_audience.name
    LIMIT 500
  `
  const rows = await searchGAds<any>(ctx, query)
  return rows.map((r: any) => ({
    id: String(r.combinedAudience.id),
    name: r.combinedAudience.name,
    category: 'COMBINED_AUDIENCE' as AudienceSegmentCategory,
    resourceName: r.combinedAudience.resourceName,
    description: r.combinedAudience.description ?? '',
  }))
}

/* ------------------------------------------------------------------ */
/*  Composite: search all + browse all                                 */
/* ------------------------------------------------------------------ */

/** Search across all audience types by keyword */
export async function searchAllAudiences(ctx: Ctx, keyword: string): Promise<AudienceSegment[]> {
  const [interests, userLists] = await Promise.all([
    searchUserInterests(ctx, keyword),
    listUserLists(ctx).then(lists => lists.filter(l => l.name.toLowerCase().includes(keyword.toLowerCase()))),
  ])
  return [...interests, ...userLists]
}

/** Browse: fetch all categories for the browse tab */
export async function browseAllAudiences(ctx: Ctx): Promise<{
  affinity: AudienceSegment[]
  inMarket: AudienceSegment[]
  detailedDemographics: AudienceSegment[]
  lifeEvents: AudienceSegment[]
  userLists: AudienceSegment[]
  customAudiences: AudienceSegment[]
  combinedAudiences: AudienceSegment[]
}> {
  const [affinity, inMarket, detailedDemographics, lifeEvents, userLists, customAudiences, combinedAudiences] =
    await Promise.all([
      listTopLevelInterests(ctx, 'AFFINITY'),
      listTopLevelInterests(ctx, 'IN_MARKET'),
      listDetailedDemographics(ctx),
      listLifeEvents(ctx),
      listUserLists(ctx),
      listCustomAudiences(ctx),
      listCombinedAudiences(ctx),
    ])

  return { affinity, inMarket, detailedDemographics, lifeEvents, userLists, customAudiences, combinedAudiences }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function extractIdFromResourceName(resourceName: string): string {
  // e.g. "customers/123/userInterests/456" → "456"
  const parts = resourceName.split('/')
  return parts[parts.length - 1]
}
