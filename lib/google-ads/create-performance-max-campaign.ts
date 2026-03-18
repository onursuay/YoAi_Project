/**
 * Standard non-retail Performance Max campaign create.
 * Fully separate from Search create flow (create-campaign.ts).
 */

import sharp from 'sharp'
import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'
import type { CreatePerformanceMaxPayload } from '@/components/google/wizard/pmax/shared/PMaxCreatePayload'
import { postMutate } from './create-campaign'

export interface CreatePerformanceMaxResult {
  campaignResourceName: string
  assetGroupResourceName: string
  conversionGoalsWarning?: string
}

/** Marketing image: 1.91:1 landscape. Logo: 1:1 square. */
const LANDSCAPE_RATIO = 1.91
const LANDSCAPE_TOLERANCE = 0.25
const SQUARE_RATIO = 1
const SQUARE_TOLERANCE = 0.15

function isLandscape(w: number, h: number): boolean {
  if (h <= 0) return false
  const ratio = w / h
  return ratio >= LANDSCAPE_RATIO - LANDSCAPE_TOLERANCE && ratio <= LANDSCAPE_RATIO + LANDSCAPE_TOLERANCE
}

function isSquare(w: number, h: number): boolean {
  if (h <= 0) return false
  const ratio = w / h
  return ratio >= SQUARE_RATIO - SQUARE_TOLERANCE && ratio <= SQUARE_RATIO + SQUARE_TOLERANCE
}

/** Fetch image, validate aspect ratio, return base64. No double fetch. */
async function fetchAndValidateImage(
  url: string,
  role: 'marketing' | 'logo'
): Promise<{ base64: string; width: number; height: number }> {
  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const metadata = await sharp(buf).metadata()
  const w = metadata.width ?? 0
  const h = metadata.height ?? 0
  if (role === 'marketing') {
    if (!isLandscape(w, h)) {
      throw new Error('PMax_INVALID_ASPECT_RATIO_MARKETING')
    }
  } else {
    if (!isSquare(w, h)) {
      throw new Error('PMax_INVALID_ASPECT_RATIO_LOGO')
    }
  }
  return { base64: buf.toString('base64'), width: w, height: h }
}

/** Create a single Asset via mutate. Returns resource name. */
async function createAsset(
  ctx: Ctx,
  payload: { type: string; name?: string; textAsset?: { text: string }; imageAsset?: { data: string } }
): Promise<string> {
  const data = await postMutate<{ results: Array<{ resourceName: string }> }>(ctx, 'assets', [
    { create: payload },
  ])
  const rn = data.results?.[0]?.resourceName
  if (!rn) throw new Error('Asset resource name not returned')
  return rn
}

/** Create campaign budget. */
async function createBudget(ctx: Ctx, params: CreatePerformanceMaxPayload): Promise<string> {
  const data = await postMutate<{ results: Array<{ resourceName: string }> }>(ctx, 'campaignBudgets', [
    {
      create: {
        name: `${params.campaignName} Budget ${Date.now()}`,
        amountMicros: params.dailyBudgetMicros,
        deliveryMethod: 'STANDARD',
        explicitlyShared: false,
      },
    },
  ])
  const rn = data.results?.[0]?.resourceName
  if (!rn) throw new Error('Campaign budget resource name not returned')
  return rn
}

/** Build bidding config for PMax. */
function buildBiddingField(params: CreatePerformanceMaxPayload): Record<string, unknown> {
  if (params.biddingStrategy === 'MAXIMIZE_CONVERSIONS') {
    if (params.biddingFocus === 'CONVERSION_VALUE') {
      return {
        maximizeConversionValue: params.targetRoas
          ? { targetRoas: params.targetRoas }
          : {},
      }
    }
    return {
      maximizeConversions: params.targetCpaMicros
        ? { targetCpaMicros: String(params.targetCpaMicros) }
        : {},
    }
  }
  if (params.biddingStrategy === 'TARGET_CPA') {
    return { targetCpa: { targetCpaMicros: params.targetCpaMicros ?? 0 } }
  }
  if (params.biddingStrategy === 'TARGET_ROAS') {
    return { targetRoas: { targetRoas: params.targetRoas ?? 1 } }
  }
  return { maximizeConversions: {} }
}

/** Create PMax campaign. */
async function createCampaign(
  ctx: Ctx,
  params: CreatePerformanceMaxPayload,
  budgetResourceName: string
): Promise<string> {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 00:00:00`

  const startDateTime = params.startDate
    ? `${params.startDate.replace(/-/g, '-')} 00:00:00`
    : fmt(tomorrow)
  const endDateTime = params.endDate ? `${params.endDate} 23:59:59` : undefined

  const geoTargetTypeSetting =
    params.locationTargetingMode === 'PRESENCE_ONLY'
      ? { positiveGeoTargetType: 'PRESENCE' as const }
      : { positiveGeoTargetType: 'PRESENCE_OR_INTEREST' as const }

  const assetAutomationSettings = [
    {
      assetAutomationType: 'FINAL_URL_EXPANSION_TEXT_ASSET_AUTOMATION',
      assetAutomationStatus: params.finalUrlExpansionEnabled ? 'OPTED_IN' : 'OPTED_OUT',
    },
    { assetAutomationType: 'TEXT_ASSET_AUTOMATION', assetAutomationStatus: 'OPTED_IN' as const },
  ]

  const data = await postMutate<{ results: Array<{ resourceName: string }> }>(ctx, 'campaigns', [
    {
      create: {
        name: params.campaignName,
        advertisingChannelType: 'PERFORMANCE_MAX',
        campaignBudget: budgetResourceName,
        status: 'ENABLED',
        containsEuPoliticalAdvertising: params.containsEuPoliticalAdvertising,
        ...geoTargetTypeSetting,
        ...buildBiddingField(params),
        startDateTime,
        ...(endDateTime && { endDateTime }),
        assetAutomationSettings,
        urlExpansionOptOut: !params.finalUrlExpansionEnabled,
      },
    },
  ])
  const rn = data.results?.[0]?.resourceName
  if (!rn) throw new Error('Campaign resource name not returned')
  return rn
}

/** Create campaign criteria: locations, negative locations, languages, ad schedule. */
async function createCampaignCriteria(
  ctx: Ctx,
  params: CreatePerformanceMaxPayload,
  campaignResourceName: string
): Promise<void> {
  const ops: unknown[] = []

  if (params.locationIds?.length) {
    for (const id of params.locationIds) {
      ops.push({
        create: {
          campaign: campaignResourceName,
          location: { geoTargetConstant: `geoTargetConstants/${id}` },
        },
      })
    }
  }
  if (params.negativeLocationIds?.length) {
    for (const id of params.negativeLocationIds) {
      ops.push({
        create: {
          campaign: campaignResourceName,
          negative: true,
          location: { geoTargetConstant: `geoTargetConstants/${id}` },
        },
      })
    }
  }
  if (params.languageIds?.length) {
    for (const id of params.languageIds) {
      ops.push({
        create: {
          campaign: campaignResourceName,
          language: { languageConstant: `languageConstants/${id}` },
        },
      })
    }
  }
  if (params.adSchedule?.length) {
    for (const s of params.adSchedule) {
      ops.push({
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
      })
    }
  }

  if (ops.length > 0) {
    await postMutate(ctx, 'campaignCriteria', ops)
  }
}

interface PreFetchedImages {
  marketingBase64: string
  logoBase64: string
}

/** Create text and image assets, then asset group + links. Uses pre-fetched images to avoid double fetch. */
async function createAssetGroupWithAssets(
  ctx: Ctx,
  params: CreatePerformanceMaxPayload,
  campaignResourceName: string,
  preFetched: PreFetchedImages
): Promise<string> {
  const { assetGroup } = params

  const assetResourceNames: { type: string; resourceName: string }[] = []

  if (assetGroup.headlines.length < 3) {
    throw new Error('At least 3 headlines required')
  }
  if (assetGroup.longHeadlines.length < 1) {
    throw new Error('At least 1 long headline required')
  }
  if (assetGroup.descriptions.length < 2) {
    throw new Error('At least 2 descriptions required')
  }
  if (!assetGroup.businessName?.trim()) {
    throw new Error('Business name required')
  }

  for (const text of assetGroup.headlines.slice(0, 15)) {
    const rn = await createAsset(ctx, {
      type: 'TEXT',
      name: `Headline ${assetResourceNames.length + 1}`,
      textAsset: { text: text.slice(0, 30) },
    })
    assetResourceNames.push({ type: 'HEADLINE', resourceName: rn })
  }
  for (const text of assetGroup.longHeadlines.slice(0, 5)) {
    const rn = await createAsset(ctx, {
      type: 'TEXT',
      name: `Long headline ${assetResourceNames.length + 1}`,
      textAsset: { text: text.slice(0, 90) },
    })
    assetResourceNames.push({ type: 'LONG_HEADLINE', resourceName: rn })
  }
  for (const text of assetGroup.descriptions.slice(0, 5)) {
    const rn = await createAsset(ctx, {
      type: 'TEXT',
      name: `Description ${assetResourceNames.length + 1}`,
      textAsset: { text: text.slice(0, 90) },
    })
    assetResourceNames.push({ type: 'DESCRIPTION', resourceName: rn })
  }

  const businessRn = await createAsset(ctx, {
    type: 'TEXT',
    name: 'Business name',
    textAsset: { text: assetGroup.businessName.slice(0, 25) },
  })
  assetResourceNames.push({ type: 'BUSINESS_NAME', resourceName: businessRn })

  const marketingImageRn = await createAsset(ctx, {
    type: 'IMAGE',
    name: assetGroup.images[0]?.name || `Marketing Image ${Date.now()}`,
    imageAsset: { data: preFetched.marketingBase64 },
  })
  const logoImageRn = await createAsset(ctx, {
    type: 'IMAGE',
    name: assetGroup.logos[0]?.name || `Logo ${Date.now()}`,
    imageAsset: { data: preFetched.logoBase64 },
  })
  const squareMarketingImageRn = logoImageRn
  const logoRn = logoImageRn

  const assetGroupData = await postMutate<{ results: Array<{ resourceName: string }> }>(
    ctx,
    'assetGroups',
    [
      {
        create: {
          name: assetGroup.name || 'Asset Group 1',
          campaign: campaignResourceName,
          status: 'ENABLED',
          finalUrls: [params.finalUrl || 'https://example.com'],
        },
      },
    ]
  )
  const assetGroupResourceName = assetGroupData.results?.[0]?.resourceName
  if (!assetGroupResourceName) throw new Error('Asset group resource name not returned')

  const linkOps: unknown[] = []

  const headlineRns = assetResourceNames.filter((a) => a.type === 'HEADLINE')
  for (const { resourceName } of headlineRns) {
    linkOps.push({
      create: {
        assetGroup: assetGroupResourceName,
        asset: resourceName,
        fieldType: 'HEADLINE',
      },
    })
  }
  const longHeadlineRns = assetResourceNames.filter((a) => a.type === 'LONG_HEADLINE')
  for (const { resourceName } of longHeadlineRns) {
    linkOps.push({
      create: {
        assetGroup: assetGroupResourceName,
        asset: resourceName,
        fieldType: 'LONG_HEADLINE',
      },
    })
  }
  const descriptionRns = assetResourceNames.filter((a) => a.type === 'DESCRIPTION')
  for (const { resourceName } of descriptionRns) {
    linkOps.push({
      create: {
        assetGroup: assetGroupResourceName,
        asset: resourceName,
        fieldType: 'DESCRIPTION',
      },
    })
  }
  linkOps.push({
    create: {
      assetGroup: assetGroupResourceName,
      asset: businessRn,
      fieldType: 'BUSINESS_NAME',
    },
  })
  linkOps.push({
    create: {
      assetGroup: assetGroupResourceName,
      asset: marketingImageRn,
      fieldType: 'MARKETING_IMAGE',
    },
  })
  linkOps.push({
    create: {
      assetGroup: assetGroupResourceName,
      asset: squareMarketingImageRn,
      fieldType: 'SQUARE_MARKETING_IMAGE',
    },
  })
  linkOps.push({
    create: {
      assetGroup: assetGroupResourceName,
      asset: logoRn,
      fieldType: 'LOGO',
    },
  })

  await postMutate(ctx, 'assetGroupAssets', linkOps)

  if (params.signals.searchThemes?.length) {
    const signalOps = params.signals.searchThemes.map((st) => ({
      create: {
        assetGroup: assetGroupResourceName,
        searchTheme: { text: st.text },
      },
    }))
    await postMutate(ctx, 'assetGroupSignals', signalOps)
  }

  return assetGroupResourceName
}

/** Pre-validate and fetch images before creating any resources. Returns base64 for reuse (no double fetch). */
async function validateAndFetchImages(
  params: CreatePerformanceMaxPayload
): Promise<PreFetchedImages> {
  const imagesWithUrl = params.assetGroup.images.filter((img) => img.url?.trim())
  const logosWithUrl = params.assetGroup.logos.filter((img) => img.url?.trim())
  if (imagesWithUrl.length < 1 || logosWithUrl.length < 1) {
    throw new Error('PMax_REQUIRES_IMAGES_AND_LOGO')
  }
  const [marketing, logo] = await Promise.all([
    fetchAndValidateImage(imagesWithUrl[0].url!.trim(), 'marketing'),
    fetchAndValidateImage(logosWithUrl[0].url!.trim(), 'logo'),
  ])
  return { marketingBase64: marketing.base64, logoBase64: logo.base64 }
}

/**
 * Create standard non-retail Performance Max campaign.
 * Order: Validate+fetch images → Budget → Campaign → Criteria → Assets → AssetGroup → Links → Signals → Conversion goals
 */
export async function createPerformanceMaxCampaign(
  ctx: Ctx,
  params: CreatePerformanceMaxPayload
): Promise<CreatePerformanceMaxResult> {
  const preFetched = await validateAndFetchImages(params)
  const budgetResourceName = await createBudget(ctx, params)
  const campaignResourceName = await createCampaign(ctx, params, budgetResourceName)
  await createCampaignCriteria(ctx, params, campaignResourceName)
  const assetGroupResourceName = await createAssetGroupWithAssets(
    ctx,
    params,
    campaignResourceName,
    preFetched
  )

  let conversionGoalsWarning: string | undefined

  if (params.selectedConversionGoalIds?.length) {
    const { createCustomConversionGoal, attachConversionGoalToCampaign, CONVERSION_GOAL_CONFIG_WARNING } =
      await import('./apply-conversion-goals')
    try {
      const customGoalRn = await createCustomConversionGoal(
        ctx,
        params.selectedConversionGoalIds,
        params.primaryConversionGoalId ?? undefined,
        params.campaignName
      )
      const attachResult = await attachConversionGoalToCampaign(ctx, campaignResourceName, customGoalRn)
      if (!attachResult.ok) {
        conversionGoalsWarning = attachResult.warning ?? CONVERSION_GOAL_CONFIG_WARNING
      }
    } catch (e) {
      conversionGoalsWarning =
        (e instanceof Error ? e.message : String(e)) || CONVERSION_GOAL_CONFIG_WARNING
    }
  }

  return {
    campaignResourceName,
    assetGroupResourceName,
    ...(conversionGoalsWarning && { conversionGoalsWarning }),
  }
}
