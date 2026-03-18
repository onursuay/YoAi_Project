import { buildGoogleAdsHeaders, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'
import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'

/**
 * Creates CustomConversionGoal before campaign creation.
 * Throws on failure — caller must not create campaign if this fails.
 */
export async function createCustomConversionGoal(
  ctx: Ctx,
  selectedConversionGoalIds: string[],
  primaryConversionGoalId?: string | null,
  campaignName?: string
): Promise<string> {
  if (selectedConversionGoalIds.length === 0) {
    throw new Error('selectedConversionGoalIds boş olamaz')
  }

  const conversionActions =
    primaryConversionGoalId && selectedConversionGoalIds.includes(primaryConversionGoalId)
      ? [primaryConversionGoalId]
      : selectedConversionGoalIds

  if (conversionActions.length === 0) {
    throw new Error('Dönüşüm eylemi seçilmedi')
  }

  const goalName = `YoAi - ${campaignName ?? 'Campaign'} - ${Date.now()}`
  const createRes = await fetch(
    `${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/customConversionGoals:mutate`,
    {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({
        operations: [{
          create: {
            name: goalName,
            conversionActions,
            status: 'ENABLED',
          },
        }],
      }),
    }
  )
  const createData = await createRes.json()
  if (!createRes.ok) {
    const msg = createData?.error?.message ?? createData?.error ?? 'Failed to create custom conversion goal'
    const err = new Error(`Dönüşüm hedefi oluşturulamadı: ${msg}`) as Error & { status?: number; googleError?: unknown }
    err.status = createRes.status
    err.googleError = createData
    throw err
  }
  const customGoalResourceName = createData.results?.[0]?.resourceName
  if (!customGoalResourceName) {
    throw new Error('CustomConversionGoal oluşturuldu ancak resource name alınamadı')
  }
  return customGoalResourceName
}

/** Partial success: campaign created but conversion goal config could not be attached */
export const CONVERSION_GOAL_CONFIG_WARNING =
  'Kampanya oluşturuldu ancak dönüşüm hedefleri uygulanamadı. Lütfen Google Ads üzerinden manuel olarak ayarlayın.'

export interface AttachResult {
  ok: boolean
  warning?: string
}

/**
 * Attaches ConversionGoalCampaignConfig to an existing campaign.
 * Does NOT throw — returns { ok, warning? } so caller can report partial success.
 */
export async function attachConversionGoalToCampaign(
  ctx: Ctx,
  campaignResourceName: string,
  customGoalResourceName: string
): Promise<AttachResult> {
  const campaignId = campaignResourceName.split('/').pop()
  if (!campaignId) {
    return { ok: false, warning: CONVERSION_GOAL_CONFIG_WARNING }
  }

  const configResourceName = `customers/${ctx.customerId}/conversionGoalCampaignConfigs/${campaignId}`

  const updateRes = await fetch(
    `${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/conversionGoalCampaignConfigs:mutate`,
    {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({
        operations: [{
          update: {
            resourceName: configResourceName,
            customConversionGoal: customGoalResourceName,
            goalConfigLevel: 'CAMPAIGN' as const,
          },
          updateMask: 'custom_conversion_goal,goal_config_level',
        }],
      }),
    }
  )
  const updateData = await updateRes.json()

  if (updateRes.ok) {
    return { ok: true }
  }

  const isNotFound =
    updateData?.error?.details?.[0]?.errors?.[0]?.errorCode?.resourceNotFound !== undefined ||
    updateRes.status === 404 ||
    (updateData?.error?.message ?? '').toLowerCase().includes('not found')

  if (isNotFound) {
    const createConfigRes = await fetch(
      `${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/conversionGoalCampaignConfigs:mutate`,
      {
        method: 'POST',
        headers: buildGoogleAdsHeaders(ctx),
        body: JSON.stringify({
          operations: [{
            create: {
              campaign: campaignResourceName,
              customConversionGoal: customGoalResourceName,
              goalConfigLevel: 'CAMPAIGN',
            },
          }],
        }),
      }
    )
    const createConfigData = await createConfigRes.json()
    if (createConfigRes.ok) {
      return { ok: true }
    }
  }

  return { ok: false, warning: CONVERSION_GOAL_CONFIG_WARNING }
}
