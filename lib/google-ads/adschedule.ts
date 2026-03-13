import { buildGoogleAdsHeaders, searchGAds, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'
import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'

type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'
type Minute = 'ZERO' | 'FIFTEEN' | 'THIRTY' | 'FORTY_FIVE'

export interface AdScheduleEntry {
  resourceName?: string
  dayOfWeek: DayOfWeek
  startHour: number
  startMinute: Minute
  endHour: number
  endMinute: Minute
  bidModifier?: number
}

export async function listAdSchedule(ctx: Ctx, campaignId: string): Promise<AdScheduleEntry[]> {
  const query = `
    SELECT
      campaign_criterion.resource_name,
      campaign_criterion.ad_schedule.day_of_week,
      campaign_criterion.ad_schedule.start_hour,
      campaign_criterion.ad_schedule.start_minute,
      campaign_criterion.ad_schedule.end_hour,
      campaign_criterion.ad_schedule.end_minute,
      campaign_criterion.bid_modifier
    FROM campaign_criterion
    WHERE
      campaign_criterion.type = 'AD_SCHEDULE'
      AND campaign.id = ${campaignId}
    ORDER BY campaign_criterion.ad_schedule.day_of_week
  `
  const response = await searchGAds<any>(ctx, query)
  return response.map((row: any) => ({
    resourceName: row.campaignCriterion.resourceName,
    dayOfWeek: row.campaignCriterion.adSchedule.dayOfWeek,
    startHour: row.campaignCriterion.adSchedule.startHour,
    startMinute: row.campaignCriterion.adSchedule.startMinute,
    endHour: row.campaignCriterion.adSchedule.endHour,
    endMinute: row.campaignCriterion.adSchedule.endMinute,
    bidModifier: row.campaignCriterion.bidModifier,
  }))
}

export async function replaceAdSchedule(
  ctx: Ctx,
  campaignResourceName: string,
  existingResourceNames: string[],
  newSchedule: AdScheduleEntry[]
): Promise<void> {
  const removeOps = existingResourceNames.map(rn => ({ remove: rn }))
  const createOps = newSchedule.map(s => ({
    create: {
      campaign: campaignResourceName,
      ...(s.bidModifier && { bidModifier: s.bidModifier }),
      adSchedule: {
        dayOfWeek: s.dayOfWeek,
        startHour: s.startHour,
        startMinute: s.startMinute,
        endHour: s.endHour,
        endMinute: s.endMinute,
      },
    },
  }))
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignCriteria:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations: [...removeOps, ...createOps] }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'replaceAdSchedule failed') }
}
