import { searchGAds } from '@/lib/googleAdsAuth'
import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'

/** Safe fields for wizard — account-based conversion actions from Google Ads API */
export interface ConversionActionForWizard {
  resourceName: string
  id: string
  name: string
  category: string
  origin: string
  primaryForGoal: boolean
  status: string
}

export async function listConversionActionsForWizard(ctx: Ctx): Promise<ConversionActionForWizard[]> {
  const query = `
    SELECT
      conversion_action.resource_name,
      conversion_action.id,
      conversion_action.name,
      conversion_action.category,
      conversion_action.origin,
      conversion_action.primary_for_goal,
      conversion_action.status
    FROM conversion_action
    WHERE conversion_action.status != 'REMOVED'
    ORDER BY conversion_action.name
  `
  const rows = await searchGAds<any>(ctx, query)
  return rows.map((row: any) => {
    const ca = row.conversionAction ?? {}
    return {
      resourceName: String(ca.resourceName ?? ''),
      id: String(ca.id ?? ca.resourceName?.split('/').pop() ?? ''),
      name: String(ca.name ?? ''),
      category: String(ca.category ?? 'UNKNOWN'),
      origin: String(ca.origin ?? 'UNKNOWN'),
      primaryForGoal: Boolean(ca.primaryForGoal),
      status: String(ca.status ?? ''),
    }
  })
}
