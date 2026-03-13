import { NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { listCampaignLocations } from '@/lib/google-ads/locations'
import { listAdSchedule } from '@/lib/google-ads/adschedule'

/**
 * GET /api/integrations/google-ads/campaigns/[campaignId]/edit-data
 * Returns full campaign tree: campaign details + ad groups + ads (with RSA content) + keywords
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
  }

  let ctx
  try {
    ctx = await getGoogleAdsContext()
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'Auth failed' },
      { status: e.status || 401 }
    )
  }

  try {
    // 1. Campaign details
    const campaignQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.resource_name,
        campaign.status,
        campaign.campaign_budget,
        campaign_budget.amount_micros,
        campaign.bidding_strategy_type,
        campaign.advertising_channel_type,
        campaign.network_settings.target_google_search,
        campaign.network_settings.target_search_network,
        campaign.network_settings.target_content_network
      FROM campaign
      WHERE campaign.id = ${campaignId}
    `
    const campaignRows = await searchGAds<any>(ctx, campaignQuery)
    if (!campaignRows.length) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    const cr = campaignRows[0]
    const campaign = {
      id: String(cr.campaign.id),
      resourceName: cr.campaign.resourceName,
      name: cr.campaign.name,
      status: cr.campaign.status,
      budgetResourceName: cr.campaign.campaignBudget,
      dailyBudgetMicros: Number(cr.campaignBudget?.amountMicros ?? 0),
      dailyBudget: Number(cr.campaignBudget?.amountMicros ?? 0) / 1_000_000,
      biddingStrategy: cr.campaign.biddingStrategyType,
      channelType: cr.campaign.advertisingChannelType,
      networkSettings: {
        targetGoogleSearch: cr.campaign.networkSettings?.targetGoogleSearch ?? false,
        targetSearchNetwork: cr.campaign.networkSettings?.targetSearchNetwork ?? false,
        targetContentNetwork: cr.campaign.networkSettings?.targetContentNetwork ?? false,
      },
    }

    // 2. Ad groups for this campaign
    const adGroupQuery = `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.resource_name,
        ad_group.status,
        ad_group.cpc_bid_micros,
        ad_group.type
      FROM ad_group
      WHERE campaign.id = ${campaignId}
        AND ad_group.status != 'REMOVED'
      ORDER BY ad_group.name
    `
    const agRows = await searchGAds<any>(ctx, adGroupQuery)
    const adGroups = agRows.map((r: any) => ({
      id: String(r.adGroup.id),
      resourceName: r.adGroup.resourceName,
      name: r.adGroup.name,
      status: r.adGroup.status,
      cpcBidMicros: Number(r.adGroup.cpcBidMicros ?? 0),
      cpcBid: Number(r.adGroup.cpcBidMicros ?? 0) / 1_000_000,
      type: r.adGroup.type,
    }))

    // 3. Ads for this campaign with RSA content
    const adsQuery = `
      SELECT
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.ad.resource_name,
        ad_group_ad.ad.type,
        ad_group_ad.status,
        ad_group_ad.ad.final_urls,
        ad_group_ad.ad.responsive_search_ad.headlines,
        ad_group_ad.ad.responsive_search_ad.descriptions,
        ad_group_ad.ad.responsive_search_ad.path1,
        ad_group_ad.ad.responsive_search_ad.path2,
        ad_group.id,
        ad_group.name
      FROM ad_group_ad
      WHERE campaign.id = ${campaignId}
        AND ad_group_ad.status != 'REMOVED'
      ORDER BY ad_group.name, ad_group_ad.ad.name
    `
    const adRows = await searchGAds<any>(ctx, adsQuery)
    const ads = adRows.map((r: any) => {
      const rsa = r.adGroupAd?.ad?.responsiveSearchAd
      return {
        id: String(r.adGroupAd.ad.id),
        resourceName: r.adGroupAd.ad.resourceName,
        name: r.adGroupAd.ad.name || '',
        type: r.adGroupAd.ad.type,
        status: r.adGroupAd.status,
        adGroupId: String(r.adGroup.id),
        adGroupName: r.adGroup.name,
        finalUrls: r.adGroupAd.ad.finalUrls ?? [],
        headlines: (rsa?.headlines ?? []).map((h: any) => ({ text: h.text || '', pinnedField: h.pinnedField || null })),
        descriptions: (rsa?.descriptions ?? []).map((d: any) => ({ text: d.text || '', pinnedField: d.pinnedField || null })),
        path1: rsa?.path1 || '',
        path2: rsa?.path2 || '',
      }
    })

    // 4. Keywords per ad group
    const adGroupIds = adGroups.map((ag: any) => ag.id)
    let keywords: any[] = []
    if (adGroupIds.length > 0) {
      const kwQuery = `
        SELECT
          ad_group_criterion.resource_name,
          ad_group_criterion.criterion_id,
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group_criterion.status,
          ad_group_criterion.negative,
          ad_group_criterion.cpc_bid_micros,
          ad_group_criterion.quality_info.quality_score,
          ad_group.id
        FROM ad_group_criterion
        WHERE
          ad_group_criterion.type = 'KEYWORD'
          AND ad_group_criterion.status != 'REMOVED'
          AND campaign.id = ${campaignId}
        ORDER BY ad_group.id, ad_group_criterion.keyword.text
      `
      const kwRows = await searchGAds<any>(ctx, kwQuery)
      keywords = kwRows.map((r: any) => ({
        resourceName: r.adGroupCriterion.resourceName,
        id: String(r.adGroupCriterion.criterionId),
        text: r.adGroupCriterion.keyword.text,
        matchType: r.adGroupCriterion.keyword.matchType,
        status: r.adGroupCriterion.status,
        isNegative: r.adGroupCriterion.negative ?? false,
        cpcBidMicros: r.adGroupCriterion.cpcBidMicros,
        qualityScore: r.adGroupCriterion.qualityInfo?.qualityScore,
        adGroupId: String(r.adGroup.id),
      }))
    }

    // 5. Campaign-level negative keywords
    const campNegKwQuery = `
      SELECT
        campaign_criterion.resource_name,
        campaign_criterion.criterion_id,
        campaign_criterion.keyword.text,
        campaign_criterion.keyword.match_type
      FROM campaign_criterion
      WHERE
        campaign_criterion.type = 'KEYWORD'
        AND campaign_criterion.negative = true
        AND campaign.id = ${campaignId}
      ORDER BY campaign_criterion.keyword.text
    `
    let campaignNegativeKeywords: any[] = []
    try {
      const cnkRows = await searchGAds<any>(ctx, campNegKwQuery)
      campaignNegativeKeywords = cnkRows.map((r: any) => ({
        resourceName: r.campaignCriterion.resourceName,
        id: String(r.campaignCriterion.criterionId),
        text: r.campaignCriterion.keyword.text,
        matchType: r.campaignCriterion.keyword.matchType,
      }))
    } catch {
      // Campaign-level negative keywords might fail for some campaign types
    }

    // 6. Locations & ad schedule (parallel, non-blocking)
    const [locations, adSchedule] = await Promise.all([
      listCampaignLocations(ctx, campaignId).catch(() => []),
      listAdSchedule(ctx, campaignId).catch(() => []),
    ])

    return NextResponse.json({
      campaign,
      adGroups,
      ads,
      keywords,
      campaignNegativeKeywords,
      locations,
      adSchedule,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('edit-data error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to load campaign data' },
      { status: 500 }
    )
  }
}
