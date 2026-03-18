import { NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { postMutate } from '@/lib/google-ads/create-campaign'
import { normalizeError } from '@/lib/google-ads/errors'

/**
 * POST /api/integrations/google-ads/campaigns/[campaignId]/duplicate
 * Duplicates a campaign with all ad groups, ads, keywords, and targeting.
 * New campaign is created in PAUSED state with "(Kopya)" suffix.
 */
export async function POST(
  _request: Request,
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

  try {
    const ctx = await getGoogleAdsContext()

    // 1. Fetch campaign details
    const [campaign] = await searchGAds<any>(ctx, `
      SELECT
        campaign.name,
        campaign.advertising_channel_type,
        campaign.bidding_strategy_type,
        campaign.campaign_budget,
        campaign.network_settings.target_google_search,
        campaign.network_settings.target_search_network,
        campaign.network_settings.target_content_network,
        campaign.manual_cpc.enhanced_cpc_enabled,
        campaign.maximize_conversions.target_cpa_micros,
        campaign.target_cpa.target_cpa_micros,
        campaign.target_roas.target_roas,
        campaign.target_spend.cpc_bid_ceiling_micros,
        campaign_budget.amount_micros
      FROM campaign
      WHERE campaign.id = ${cid}
      LIMIT 1
    `)
    if (!campaign) {
      return NextResponse.json({ error: 'not_found', message: 'Campaign not found' }, { status: 404 })
    }

    // 2. Fetch campaign criteria (locations, languages, audiences, schedule)
    const criteria = await searchGAds<any>(ctx, `
      SELECT
        campaign_criterion.resource_name,
        campaign_criterion.type,
        campaign_criterion.negative,
        campaign_criterion.location.geo_target_constant,
        campaign_criterion.language.language_constant,
        campaign_criterion.user_list.user_list,
        campaign_criterion.user_interest.user_interest_category,
        campaign_criterion.custom_audience.custom_audience,
        campaign_criterion.combined_audience.combined_audience,
        campaign_criterion.life_event.life_event_id,
        campaign_criterion.extended_demographic.extended_demographic_id,
        campaign_criterion.ad_schedule.day_of_week,
        campaign_criterion.ad_schedule.start_hour,
        campaign_criterion.ad_schedule.start_minute,
        campaign_criterion.ad_schedule.end_hour,
        campaign_criterion.ad_schedule.end_minute,
        campaign_criterion.keyword.text,
        campaign_criterion.keyword.match_type
      FROM campaign_criterion
      WHERE campaign.id = ${cid}
      LIMIT 500
    `)

    // 3. Fetch ad groups
    const adGroups = await searchGAds<any>(ctx, `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.type,
        ad_group.cpc_bid_micros
      FROM ad_group
      WHERE campaign.id = ${cid}
        AND ad_group.status != 'REMOVED'
      LIMIT 100
    `)

    // 4. For each ad group, fetch keywords and ads
    const adGroupData: Array<{
      ag: any
      keywords: any[]
      ads: any[]
    }> = []

    for (const ag of adGroups) {
      const agId = ag.adGroup.id
      const [keywords, ads] = await Promise.all([
        searchGAds<any>(ctx, `
          SELECT
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group_criterion.cpc_bid_micros,
            ad_group_criterion.negative
          FROM ad_group_criterion
          WHERE ad_group.id = ${agId}
            AND ad_group_criterion.type = 'KEYWORD'
            AND ad_group_criterion.status != 'REMOVED'
          LIMIT 500
        `),
        searchGAds<any>(ctx, `
          SELECT
            ad_group_ad.ad.responsive_search_ad.headlines,
            ad_group_ad.ad.responsive_search_ad.descriptions,
            ad_group_ad.ad.responsive_search_ad.path1,
            ad_group_ad.ad.responsive_search_ad.path2,
            ad_group_ad.ad.final_urls,
            ad_group_ad.ad.type
          FROM ad_group_ad
          WHERE ad_group.id = ${agId}
            AND ad_group_ad.status != 'REMOVED'
          LIMIT 50
        `),
      ])
      adGroupData.push({ ag, keywords, ads })
    }

    // ── Create new campaign ──────────────────────────────────────

    // 5a. Create budget
    const budgetAmountMicros = campaign.campaignBudget?.amountMicros ?? '1000000'
    const budgetData = await postMutate(ctx, 'campaignBudgets', [{
      create: {
        name: `${campaign.campaign.name} (Kopya) Budget ${Date.now()}`,
        amountMicros: budgetAmountMicros,
        deliveryMethod: 'STANDARD',
      },
    }])
    const newBudgetRn: string = budgetData.results[0].resourceName

    // 5b. Create campaign
    const biddingField: Record<string, unknown> = {}
    const bst = campaign.campaign.biddingStrategyType
    if (bst === 'MANUAL_CPC') {
      biddingField.manualCpc = { enhancedCpcEnabled: campaign.campaign.manualCpc?.enhancedCpcEnabled ?? false }
    } else if (bst === 'TARGET_SPEND' || bst === 'MAXIMIZE_CLICKS') {
      biddingField.targetSpend = campaign.campaign.targetSpend?.cpcBidCeilingMicros
        ? { cpcBidCeilingMicros: campaign.campaign.targetSpend.cpcBidCeilingMicros }
        : {}
    } else if (bst === 'MAXIMIZE_CONVERSIONS') {
      biddingField.maximizeConversions = campaign.campaign.maximizeConversions?.targetCpaMicros
        ? { targetCpaMicros: campaign.campaign.maximizeConversions.targetCpaMicros }
        : {}
    } else if (bst === 'TARGET_CPA') {
      biddingField.targetCpa = { targetCpaMicros: campaign.campaign.targetCpa?.targetCpaMicros ?? 0 }
    } else if (bst === 'TARGET_ROAS') {
      biddingField.targetRoas = { targetRoas: campaign.campaign.targetRoas?.targetRoas ?? 1 }
    }

    const ns = campaign.campaign.networkSettings
    const networkSettings = ns ? {
      targetGoogleSearch: ns.targetGoogleSearch ?? true,
      targetSearchNetwork: ns.targetSearchNetwork ?? true,
      targetContentNetwork: ns.targetContentNetwork ?? false,
      targetPartnerSearchNetwork: false,
    } : undefined

    const campaignData = await postMutate(ctx, 'campaigns', [{
      create: {
        name: `${campaign.campaign.name} (Kopya)`,
        advertisingChannelType: campaign.campaign.advertisingChannelType ?? 'SEARCH',
        campaignBudget: newBudgetRn,
        status: 'PAUSED',
        ...(networkSettings && { networkSettings }),
        ...biddingField,
      },
    }])
    const newCampaignRn: string = campaignData.results[0].resourceName

    // 5c. Copy criteria (locations, languages, audiences, schedule, negative keywords)
    const criteriaOps = criteria
      .map((c: any) => {
        const cr = c.campaignCriterion
        const op: Record<string, unknown> = { campaign: newCampaignRn }
        if (cr.negative) op.negative = true

        if (cr.type === 'LOCATION' && cr.location?.geoTargetConstant) {
          op.location = { geoTargetConstant: cr.location.geoTargetConstant }
        } else if (cr.type === 'LANGUAGE' && cr.language?.languageConstant) {
          op.language = { languageConstant: cr.language.languageConstant }
        } else if (cr.type === 'USER_LIST' && cr.userList?.userList) {
          op.userList = { userList: cr.userList.userList }
        } else if (cr.type === 'USER_INTEREST' && cr.userInterest?.userInterestCategory) {
          op.userInterest = { userInterestCategory: cr.userInterest.userInterestCategory }
        } else if (cr.type === 'CUSTOM_AUDIENCE' && cr.customAudience?.customAudience) {
          op.customAudience = { customAudience: cr.customAudience.customAudience }
        } else if (cr.type === 'COMBINED_AUDIENCE' && cr.combinedAudience?.combinedAudience) {
          op.combinedAudience = { combinedAudience: cr.combinedAudience.combinedAudience }
        } else if (cr.type === 'LIFE_EVENT' && cr.lifeEvent?.lifeEventId != null) {
          op.lifeEvent = { lifeEventId: String(cr.lifeEvent.lifeEventId ?? cr.lifeEvent.life_event_id) }
        } else if (cr.type === 'EXTENDED_DEMOGRAPHIC' && cr.extendedDemographic?.extendedDemographicId != null) {
          op.extendedDemographic = { extendedDemographicId: String(cr.extendedDemographic.extendedDemographicId ?? cr.extendedDemographic.extended_demographic_id) }
        } else if (cr.type === 'AD_SCHEDULE' && cr.adSchedule) {
          op.adSchedule = {
            dayOfWeek: cr.adSchedule.dayOfWeek,
            startHour: cr.adSchedule.startHour,
            startMinute: cr.adSchedule.startMinute,
            endHour: cr.adSchedule.endHour,
            endMinute: cr.adSchedule.endMinute,
          }
        } else if (cr.type === 'KEYWORD' && cr.keyword?.text) {
          op.keyword = { text: cr.keyword.text, matchType: cr.keyword.matchType }
        } else {
          return null
        }
        return { create: op }
      })
      .filter(Boolean)

    if (criteriaOps.length > 0) {
      await postMutate(ctx, 'campaignCriteria', criteriaOps)
    }

    // 5d. Copy ad groups + keywords + ads
    for (const { ag, keywords, ads } of adGroupData) {
      const agData = await postMutate(ctx, 'adGroups', [{
        create: {
          name: ag.adGroup.name,
          campaign: newCampaignRn,
          status: 'ENABLED',
          type: ag.adGroup.type ?? 'SEARCH_STANDARD',
          ...(ag.adGroup.cpcBidMicros && { cpcBidMicros: ag.adGroup.cpcBidMicros }),
        },
      }])
      const newAgRn: string = agData.results[0].resourceName

      // Keywords
      const positiveKws = keywords.filter((k: any) => !k.adGroupCriterion?.negative)
      const negativeKws = keywords.filter((k: any) => k.adGroupCriterion?.negative)

      if (positiveKws.length > 0) {
        await postMutate(ctx, 'adGroupCriteria', positiveKws.map((k: any) => ({
          create: {
            adGroup: newAgRn,
            status: 'ENABLED',
            keyword: {
              text: k.adGroupCriterion.keyword.text,
              matchType: k.adGroupCriterion.keyword.matchType,
            },
            ...(k.adGroupCriterion.cpcBidMicros && { cpcBidMicros: k.adGroupCriterion.cpcBidMicros }),
          },
        })))
      }

      if (negativeKws.length > 0) {
        await postMutate(ctx, 'adGroupCriteria', negativeKws.map((k: any) => ({
          create: {
            adGroup: newAgRn,
            negative: true,
            keyword: {
              text: k.adGroupCriterion.keyword.text,
              matchType: k.adGroupCriterion.keyword.matchType,
            },
          },
        })))
      }

      // Ads (RSA)
      for (const adRow of ads) {
        const ad = adRow.adGroupAd?.ad
        if (!ad) continue
        const rsa = ad.responsiveSearchAd
        if (rsa) {
          await postMutate(ctx, 'adGroupAds', [{
            create: {
              adGroup: newAgRn,
              status: 'ENABLED',
              ad: {
                finalUrls: ad.finalUrls ?? [],
                responsiveSearchAd: {
                  headlines: rsa.headlines ?? [],
                  descriptions: rsa.descriptions ?? [],
                  ...(rsa.path1 && { path1: rsa.path1 }),
                  ...(rsa.path2 && { path2: rsa.path2 }),
                },
              },
            },
          }])
        }
      }
    }

    return NextResponse.json({ ok: true, campaignId: cid, newCampaignResourceName: newCampaignRn })
  } catch (e: unknown) {
    const { error, message, status: errStatus } = normalizeError(e, 'campaign_duplicate_failed', 500)
    return NextResponse.json({ error, message }, { status: errStatus })
  }
}
