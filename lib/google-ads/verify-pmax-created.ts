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

  const campaignIdMatch = campaignResourceName.match(/\/campaigns\/(\d+)$/)
  const campaignId = campaignIdMatch ? campaignIdMatch[1] : null
  const escapedRn = campaignResourceName.replace(/'/g, "\\'")
  const campaignFilter = campaignId
    ? `campaign.id = ${campaignId}`
    : `campaign_criterion.campaign = '${escapedRn}'`

  const criteriaQuery = `
    SELECT campaign_criterion.resource_name, campaign_criterion.type, campaign_criterion.status
    FROM campaign_criterion
    WHERE ${campaignFilter}
      AND campaign_criterion.status != 'REMOVED'
  `
  const criteriaRows = await searchGAds<{
    campaignCriterion?: { resourceName?: string; type?: string; status?: string }
    campaign_criterion?: { resource_name?: string; type?: string; status?: string }
  }>(ctx, criteriaQuery, { maxRows: 500 })

  for (const r of criteriaRows) {
    const c = r.campaignCriterion ?? r.campaign_criterion ?? {}
    const t = String(c.type ?? '').toUpperCase()
    if (t === 'LOCATION') result.locationCriteriaCount++
    else if (t === 'LANGUAGE') result.languageCriteriaCount++
    else if (t === 'AD_SCHEDULE') result.adScheduleCriteriaCount++
  }

  console.log('[verify-pmax] criteria counts:', {
    totalRows: criteriaRows.length,
    locationCriteriaCount: result.locationCriteriaCount,
    languageCriteriaCount: result.languageCriteriaCount,
    adScheduleCriteriaCount: result.adScheduleCriteriaCount,
  })

  return result
}
