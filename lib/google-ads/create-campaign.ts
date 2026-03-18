import { buildGoogleAdsHeaders, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'
import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'

export type BiddingStrategy =
  | 'MAXIMIZE_CONVERSIONS'
  | 'MAXIMIZE_CLICKS'
  | 'TARGET_CPA'
  | 'TARGET_ROAS'
  | 'MANUAL_CPC'
  | 'TARGET_IMPRESSION_SHARE'

export type AdvertisingChannelType =
  | 'SEARCH'
  | 'DISPLAY'
  | 'VIDEO'
  | 'SHOPPING'
  | 'PERFORMANCE_MAX'
  | 'DEMAND_GEN'
  | 'MULTI_CHANNEL'
  | 'SMART'
  | 'LOCAL'

/** EU political advertising – tek noktadan mapping (campaign create). */
export type EuPoliticalAdvertising = 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING' | 'CONTAINS_EU_POLITICAL_ADVERTISING'

const DEFAULT_EU_POLITICAL_ADVERTISING: EuPoliticalAdvertising = 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'

// Ad group type per campaign type (Google Ads API requirement)
const AD_GROUP_TYPE_MAP: Record<AdvertisingChannelType, string> = {
  SEARCH: 'SEARCH_STANDARD',
  DISPLAY: 'DISPLAY_STANDARD',
  VIDEO: 'VIDEO_TRUE_VIEW_IN_STREAM',
  SHOPPING: 'SHOPPING_PRODUCT_ADS',
  PERFORMANCE_MAX: 'SEARCH_STANDARD', // PMax uses asset groups, not traditional ad groups
  DEMAND_GEN: 'DISPLAY_STANDARD',
  MULTI_CHANNEL: 'SEARCH_STANDARD',
  SMART: 'SMART_CAMPAIGN_ADS',
  LOCAL: 'SEARCH_STANDARD',
}

export interface CreateCampaignParams {
  campaignName: string
  advertisingChannelType?: AdvertisingChannelType
  dailyBudgetMicros: number
  biddingStrategy: BiddingStrategy
  targetCpaMicros?: number
  targetRoas?: number
  startDate?: string // yyyy-MM-dd
  endDate?: string   // yyyy-MM-dd
  adGroupName: string
  cpcBidMicros?: number
  cpcBidCeilingMicros?: number // campaign-level tavan CPC (for targetSpend)
  keywords: Array<{ text: string; matchType: 'EXACT' | 'PHRASE' | 'BROAD' }>
  negativeKeywords?: Array<{ text: string; matchType: 'EXACT' | 'PHRASE' | 'BROAD' }>
  finalUrl: string
  headlines: string[]    // 3-15 items
  descriptions: string[] // 2-4 items
  path1?: string
  path2?: string
  locationIds?: string[]
  negativeLocationIds?: string[]
  languageIds?: string[]
  networkSettings?: { targetGoogleSearch: boolean; targetSearchNetwork: boolean; targetContentNetwork: boolean }
  audienceIds?: string[]                 // deprecated: use audienceResourceNames
  audienceResourceNames?: string[]       // user_list full resource names (customers/X/userLists/Y)
  userInterestIds?: string[]             // user_interest IDs (affinity, in-market)
  detailedDemographicIds?: string[]      // extended_demographic taxonomy IDs (INT64)
  lifeEventIds?: string[]                // life_event taxonomy IDs (INT64)
  customAudienceIds?: string[]           // custom_audience IDs
  combinedAudienceIds?: string[]         // combined_audience IDs
  audienceMode?: 'OBSERVATION' | 'TARGETING'
  adSchedule?: Array<{ dayOfWeek: string; startHour: number; startMinute: string; endHour: number; endMinute: string }>
  /** AB siyasi reklam içeriği – verilmezse DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING kullanılır. */
  containsEuPoliticalAdvertising?: EuPoliticalAdvertising
}

export async function postMutate<T = any>(ctx: Ctx, resource: string, operations: unknown[]): Promise<T> {
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/${resource}:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations }),
  })
  const data = await res.json()
  if (!res.ok) {
    const googleError = data?.error
    const firstDetail = googleError?.details?.[0]?.errors?.[0]
    const msg = firstDetail
      ? `[${resource}] ${JSON.stringify(firstDetail.errorCode)} | ${firstDetail.message} | field: ${firstDetail.location?.fieldPathElements?.map((f: any) => f.fieldName).join('.') ?? 'n/a'}`
      : `[${resource}] ${googleError?.message ?? 'unknown error'} | status: ${res.status} | body: ${JSON.stringify(data)}`
    const err = new Error(msg) as Error & { status?: number; googleError?: unknown }
    err.status = res.status
    err.googleError = data
    throw err
  }
  return data
}

export async function createFullCampaign(ctx: Ctx, params: CreateCampaignParams) {
  const channelType: AdvertisingChannelType = params.advertisingChannelType ?? 'SEARCH'

  // 1. Campaign Budget
  const budgetData = await postMutate(ctx, 'campaignBudgets', [{
    create: {
      name: `${params.campaignName} Budget ${Date.now()}`,
      amountMicros: params.dailyBudgetMicros,
      deliveryMethod: 'STANDARD',
    },
  }])
  const budgetResourceName: string = budgetData.results[0].resourceName

  // 2. Campaign — bidding strategy
  const biddingField: Record<string, unknown> = {}
  if (params.biddingStrategy === 'MANUAL_CPC') {
    biddingField.manualCpc = { enhancedCpcEnabled: false }
  } else if (params.biddingStrategy === 'MAXIMIZE_CLICKS') {
    biddingField.targetSpend = params.cpcBidCeilingMicros
      ? { cpcBidCeilingMicros: params.cpcBidCeilingMicros }
      : {}
  } else if (params.biddingStrategy === 'MAXIMIZE_CONVERSIONS') {
    biddingField.maximizeConversions = params.targetCpaMicros ? { targetCpaMicros: String(params.targetCpaMicros) } : {}
  } else if (params.biddingStrategy === 'TARGET_CPA') {
    biddingField.targetCpa = { targetCpaMicros: params.targetCpaMicros ?? 0 }
  } else if (params.biddingStrategy === 'TARGET_ROAS') {
    biddingField.targetRoas = { targetRoas: params.targetRoas ?? 1 }
  } else if (params.biddingStrategy === 'TARGET_IMPRESSION_SHARE') {
    biddingField.targetImpressionShare = {
      location: 'TOP_OF_PAGE',
      locationFractionMicros: '700000',
      cpcBidCeilingMicros: params.cpcBidCeilingMicros ? String(params.cpcBidCeilingMicros) : '5000000',
    }
  }

  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} 00:00:00`

  const containsEuPoliticalAdvertising: EuPoliticalAdvertising =
    params.containsEuPoliticalAdvertising ?? DEFAULT_EU_POLITICAL_ADVERTISING

  // Network settings — only for SEARCH campaigns per Google Ads API (docs Section 2.3)
  const networkSettings = channelType === 'SEARCH' ? {
    targetGoogleSearch: params.networkSettings?.targetGoogleSearch ?? true,
    targetSearchNetwork: params.networkSettings?.targetSearchNetwork ?? true,
    targetContentNetwork: params.networkSettings?.targetContentNetwork ?? false,
    targetPartnerSearchNetwork: false,
  } : undefined

  const campaignData = await postMutate(ctx, 'campaigns', [{
    create: {
      name: params.campaignName,
      advertisingChannelType: channelType,
      campaignBudget: budgetResourceName,
      status: 'ENABLED',
      containsEuPoliticalAdvertising,
      ...(networkSettings && { networkSettings }),
      startDateTime: params.startDate ? params.startDate.replace(/-/g, '-') + ' 00:00:00' : fmt(tomorrow),
      ...(params.endDate && { endDateTime: params.endDate + ' 23:59:59' }),
      ...biddingField,
    },
  }])
  const campaignResourceName: string = campaignData.results[0].resourceName

  // 3a. Location targeting (optional)
  if (params.locationIds?.length) {
    await postMutate(ctx, 'campaignCriteria', params.locationIds.map(id => ({
      create: {
        campaign: campaignResourceName,
        location: { geoTargetConstant: `geoTargetConstants/${id}` },
      },
    })))
  }

  // 3b. Negative location targeting (optional)
  if (params.negativeLocationIds?.length) {
    await postMutate(ctx, 'campaignCriteria', params.negativeLocationIds.map(id => ({
      create: {
        campaign: campaignResourceName,
        negative: true,
        location: { geoTargetConstant: `geoTargetConstants/${id}` },
      },
    })))
  }

  // 4. Ad Group
  const adGroupType = AD_GROUP_TYPE_MAP[channelType] ?? 'SEARCH_STANDARD'
  const adGroupData = await postMutate(ctx, 'adGroups', [{
    create: {
      name: params.adGroupName,
      campaign: campaignResourceName,
      status: 'ENABLED',
      type: adGroupType,
      ...(params.cpcBidMicros && { cpcBidMicros: params.cpcBidMicros }),
    },
  }])
  const adGroupResourceName: string = adGroupData.results[0].resourceName

  // 5. Keywords (for SEARCH campaigns)
  if (params.keywords.length > 0) {
    await postMutate(ctx, 'adGroupCriteria', params.keywords.map(kw => ({
      create: {
        adGroup: adGroupResourceName,
        status: 'ENABLED',
        keyword: { text: kw.text, matchType: kw.matchType },
        ...(params.cpcBidMicros && { cpcBidMicros: params.cpcBidMicros }),
      },
    })))
  }

  // 6. Negative keywords (campaign-level)
  if (params.negativeKeywords?.length) {
    await postMutate(ctx, 'campaignCriteria', params.negativeKeywords.map(kw => ({
      create: {
        campaign: campaignResourceName,
        negative: true,
        keyword: { text: kw.text, matchType: kw.matchType },
      },
    })))
  }

  // 7. RSA Ad (for SEARCH campaigns)
  if (channelType === 'SEARCH' && params.headlines.length >= 3) {
    await postMutate(ctx, 'adGroupAds', [{
      create: {
        adGroup: adGroupResourceName,
        status: 'ENABLED',
        ad: {
          finalUrls: [params.finalUrl],
          responsiveSearchAd: {
            headlines: params.headlines.slice(0, 15).map(text => ({ text })),
            descriptions: params.descriptions.slice(0, 4).map(text => ({ text })),
            ...(params.path1 && { path1: params.path1 }),
            ...(params.path2 && { path2: params.path2 }),
          },
        },
      },
    }])
  }

  // 8. Language targeting (optional)
  if (params.languageIds?.length) {
    await postMutate(ctx, 'campaignCriteria', params.languageIds.map(id => ({
      create: {
        campaign: campaignResourceName,
        language: { languageConstant: `languageConstants/${id}` },
      },
    })))
  }

  // 9a–9f. Audience targeting. Note: Observation vs Targeting (bid_only) is set via
  // campaign.targeting_setting / ad_group.targeting_setting, not on individual criteria.
  const userListResourceNames = params.audienceResourceNames ?? (params.audienceIds?.map(id => `customers/${ctx.customerId}/userLists/${id}`) ?? [])
  if (userListResourceNames.length > 0) {
    for (const rn of userListResourceNames) {
      const m = rn.match(/^customers\/(\d+)\/userLists\/\d+$/)
      if (!m) {
        throw new Error(`Invalid user list resource format: ${rn}`)
      }
      const listCustomerId = m[1]
      if (listCustomerId !== ctx.customerId) {
        throw new Error('Selected user list does not belong to the active Google Ads customer')
      }
    }
    await postMutate(ctx, 'campaignCriteria', userListResourceNames.map(rn => ({
      create: {
        campaign: campaignResourceName,
        userList: { userList: rn },
      },
    })))
  }

  if (params.userInterestIds?.length) {
    await postMutate(ctx, 'campaignCriteria', params.userInterestIds.map(id => ({
      create: {
        campaign: campaignResourceName,
        userInterest: { userInterestCategory: `customers/${ctx.customerId}/userInterests/${id}` },
      },
    })))
  }

  if (params.detailedDemographicIds?.length) {
    await postMutate(ctx, 'campaignCriteria', params.detailedDemographicIds.map(id => ({
      create: {
        campaign: campaignResourceName,
        extendedDemographic: { extendedDemographicId: String(id) },
      },
    })))
  }

  if (params.lifeEventIds?.length) {
    await postMutate(ctx, 'campaignCriteria', params.lifeEventIds.map(id => ({
      create: {
        campaign: campaignResourceName,
        lifeEvent: { lifeEventId: String(id) },
      },
    })))
  }

  if (params.customAudienceIds?.length) {
    await postMutate(ctx, 'campaignCriteria', params.customAudienceIds.map(id => ({
      create: {
        campaign: campaignResourceName,
        customAudience: { customAudience: `customers/${ctx.customerId}/customAudiences/${id}` },
      },
    })))
  }

  if (params.combinedAudienceIds?.length) {
    await postMutate(ctx, 'campaignCriteria', params.combinedAudienceIds.map(id => ({
      create: {
        campaign: campaignResourceName,
        combinedAudience: { combinedAudience: `customers/${ctx.customerId}/combinedAudiences/${id}` },
      },
    })))
  }

  // 10. Ad schedule (optional)
  if (params.adSchedule?.length) {
    await postMutate(ctx, 'campaignCriteria', params.adSchedule.map(s => ({
      create: {
        campaign: campaignResourceName,
        adSchedule: {
          dayOfWeek: s.dayOfWeek,
          startHour: s.startHour,
          startMinute: s.startMinute,
          endHour: s.endHour,
          endMinute: s.endMinute,
        },
      },
    })))
  }

  return { campaignResourceName, adGroupResourceName }
}
