import { buildGoogleAdsHeaders, searchGAds, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'
import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'

export interface UserList {
  resourceName: string
  id: string
  name: string
  description?: string
  type: string
  membershipLifeSpan: number
  sizeForDisplay?: number
  sizeRangeForDisplay: string
  accessReason?: string
  eligibleForSearch?: boolean
  eligibleForDisplay?: boolean
}

export async function listUserLists(ctx: Ctx): Promise<UserList[]> {
  // No type filter — returns ALL user lists to match Google Ads Audience Manager
  const query = `
    SELECT
      user_list.resource_name,
      user_list.id,
      user_list.name,
      user_list.description,
      user_list.type,
      user_list.membership_life_span,
      user_list.size_for_display,
      user_list.size_range_for_display,
      user_list.access_reason,
      user_list.eligible_for_search,
      user_list.eligible_for_display
    FROM user_list
    ORDER BY user_list.name
    LIMIT 500
  `
  const response = await searchGAds<any>(ctx, query)
  return response.map((row: any) => ({
    resourceName: row.userList.resourceName,
    id: String(row.userList.id),
    name: row.userList.name,
    description: row.userList.description,
    type: row.userList.type,
    membershipLifeSpan: row.userList.membershipLifeSpan,
    sizeForDisplay: row.userList.sizeForDisplay,
    sizeRangeForDisplay: row.userList.sizeRangeForDisplay ?? '',
    accessReason: row.userList.accessReason,
    eligibleForSearch: row.userList.eligibleForSearch,
    eligibleForDisplay: row.userList.eligibleForDisplay,
  }))
}

export async function createRemarketingList(
  ctx: Ctx,
  name: string,
  description: string,
  membershipLifeSpanDays = 30
): Promise<string> {
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/userLists:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({
      operations: [{ create: { name, description, membershipLifeSpan: membershipLifeSpanDays, remarketingUserList: {} } }],
    }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'createRemarketingList failed') }
  const data = await res.json()
  return data.results[0].resourceName
}
