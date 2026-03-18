/**
 * Post-create parity verification for Performance Max campaigns.
 * Verifies campaign, asset group, signals, and criteria via GAQL.
 */

import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'
import { searchGAds } from '@/lib/googleAdsAuth'

export interface PmaxVerifyResult {
  campaignExists: boolean
  campaignType: string | null
  assetGroupExists: boolean
  assetGroupLinked: boolean
  signalsCount: number
  locationCriteriaCount: number
  languageCriteriaCount: number
  adScheduleCriteriaCount: number
}

export async function verifyPmaxCreated(
  ctx: Ctx,
  campaignResourceName: string,
  assetGroupResourceName: string
): Promise<PmaxVerifyResult> {
  const result: PmaxVerifyResult = {
    campaignExists: false,
    campaignType: null,
    assetGroupExists: false,
    assetGroupLinked: false,
    signalsCount: 0,
    locationCriteriaCount: 0,
    languageCriteriaCount: 0,
    adScheduleCriteriaCount: 0,
  }

  const campaignQuery = `
    SELECT campaign.id, campaign.advertising_channel_type
    FROM campaign
    WHERE campaign.resource_name = '${campaignResourceName.replace(/'/g, "\\'")}'
  `
  const campaignRows = await searchGAds<{ campaign: { id: string; advertisingChannelType: string } }>(
    ctx,
    campaignQuery,
    { maxRows: 1 }
  )
  if (campaignRows.length > 0) {
    result.campaignExists = true
    result.campaignType = campaignRows[0].campaign?.advertisingChannelType ?? null
  }

  const assetGroupQuery = `
    SELECT asset_group.resource_name, asset_group.campaign
    FROM asset_group
    WHERE asset_group.resource_name = '${assetGroupResourceName.replace(/'/g, "\\'")}'
  `
  const agRows = await searchGAds<{ assetGroup: { resourceName: string; campaign: string } }>(
    ctx,
    assetGroupQuery,
    { maxRows: 1 }
  )
  if (agRows.length > 0) {
    result.assetGroupExists = true
    result.assetGroupLinked = agRows[0].assetGroup?.campaign === campaignResourceName
  }

  const signalsQuery = `
    SELECT asset_group_signal.resource_name
    FROM asset_group_signal
    WHERE asset_group_signal.asset_group = '${assetGroupResourceName.replace(/'/g, "\\'")}'
  `
  const signalRows = await searchGAds<{ assetGroupSignal: { resourceName: string } }>(
    ctx,
    signalsQuery,
    { maxRows: 100 }
  )
  result.signalsCount = signalRows.length

  const criteriaQuery = `
    SELECT campaign_criterion.resource_name, campaign_criterion.type
    FROM campaign_criterion
    WHERE campaign_criterion.campaign = '${campaignResourceName.replace(/'/g, "\\'")}'
  `
  const criteriaRows = await searchGAds<{
    campaignCriterion: { resourceName: string; type: string }
  }>(ctx, criteriaQuery, { maxRows: 500 })
  for (const r of criteriaRows) {
    const t = r.campaignCriterion?.type ?? ''
    if (t.includes('LOCATION')) result.locationCriteriaCount++
    else if (t.includes('LANGUAGE')) result.languageCriteriaCount++
    else if (t.includes('AD_SCHEDULE')) result.adScheduleCriteriaCount++
  }

  return result
}
