import { buildGoogleAdsHeaders, searchGAds, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'
import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'

export type AttributionModel = 'LAST_CLICK' | 'FIRST_CLICK' | 'LINEAR' | 'TIME_DECAY' | 'POSITION_BASED' | 'DATA_DRIVEN'

export interface ConversionAttribution {
  resourceName: string
  name: string
  attributionModel: AttributionModel
  dataDrivenModelStatus: string
  viewThroughLookbackWindowDays: number
  clickThroughLookbackWindowDays: number
}

export async function listConversionAttribution(ctx: Ctx): Promise<ConversionAttribution[]> {
  const query = `
    SELECT
      conversion_action.resource_name,
      conversion_action.name,
      conversion_action.attribution_model_settings.attribution_model,
      conversion_action.attribution_model_settings.data_driven_model_status,
      conversion_action.view_through_lookback_window_days,
      conversion_action.click_through_lookback_window_days
    FROM conversion_action
    WHERE conversion_action.status != 'REMOVED'
    ORDER BY conversion_action.name
  `
  const response = await searchGAds<any>(ctx, query)
  return response.map((row: any) => ({
    resourceName: row.conversionAction.resourceName,
    name: row.conversionAction.name,
    attributionModel: row.conversionAction.attributionModelSettings.attributionModel,
    dataDrivenModelStatus: row.conversionAction.attributionModelSettings.dataDrivenModelStatus,
    viewThroughLookbackWindowDays: row.conversionAction.viewThroughLookbackWindowDays,
    clickThroughLookbackWindowDays: row.conversionAction.clickThroughLookbackWindowDays,
  }))
}

export async function updateAttributionModel(
  ctx: Ctx,
  resourceName: string,
  attributionModel: AttributionModel,
  clickThroughLookbackWindowDays?: number
): Promise<void> {
  const updateFields = ['attribution_model_settings.attribution_model']
  const updateData: any = { resourceName, attributionModelSettings: { attributionModel } }
  if (clickThroughLookbackWindowDays) {
    updateData.clickThroughLookbackWindowDays = clickThroughLookbackWindowDays
    updateFields.push('click_through_lookback_window_days')
  }
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/conversionActions:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify({ operations: [{ update: updateData, updateMask: updateFields.join(',') }] }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message ?? 'updateAttributionModel failed') }
}
