/**
 * Standard non-retail Performance Max campaign create.
 * Fully separate from Search create flow (create-campaign.ts).
 * Brand Guidelines: BUSINESS_NAME and LOGO are linked at campaign level via googleAds:mutate batch.
 */

import sharp from 'sharp'
import { buildGoogleAdsHeaders, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'
import type { GoogleAdsRequestContext as Ctx } from '@/lib/googleAdsAuth'
import type { CreatePerformanceMaxPayload } from '@/components/google/wizard/pmax/shared/PMaxCreatePayload'
import { postMutate } from './create-campaign'

export interface CreatePerformanceMaxResult {
  campaignResourceName: string
  assetGroupResourceName: string
  conversionGoalsWarning?: string
  /** Debug: campaign-level brand assets (for logging) */
  _debug?: { businessNameAssetRn: string; logoAssetRn: string }
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

interface PreFetchedImages {
  marketingBase64: string
  logoBase64: string
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

/** Create PMax campaign + BUSINESS_NAME + LOGO campaign assets in one atomic batch (googleAds:mutate).
 * Brand Guidelines requires business name linked as CampaignAsset; must be same request as campaign create.
 */
async function createCampaignWithBrandAssets(
  ctx: Ctx,
  params: CreatePerformanceMaxPayload,
  budgetResourceName: string,
  preFetched: PreFetchedImages
): Promise<{ campaignResourceName: string; businessNameAssetRn: string; logoAssetRn: string }> {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 00:00:00`

  const startDateTime = params.startDate
    ? `${params.startDate.replace(/-/g, '-')} 00:00:00`
    : fmt(tomorrow)
  const endDateTime = params.endDate ? `${params.endDate} 23:59:59` : undefined

  const geoTargetTypeSetting = {
    positiveGeoTargetType:
      params.locationTargetingMode === 'PRESENCE_ONLY' ? ('PRESENCE' as const) : ('PRESENCE_OR_INTEREST' as const),
  }

  const assetAutomationSettings = [
    { assetAutomationType: 'TEXT_ASSET_AUTOMATION', assetAutomationStatus: 'OPTED_IN' as const },
  ]

  const cid = ctx.customerId
  const tempCampaign = `customers/${cid}/campaigns/-1`
  const tempBusinessNameAsset = `customers/${cid}/assets/-2`
  const tempLogoAsset = `customers/${cid}/assets/-3`

  const mutateOperations = [
    {
      assetOperation: {
        create: {
          resourceName: tempBusinessNameAsset,
          type: 'TEXT',
          name: 'Business name',
          textAsset: { text: (params.assetGroup.businessName ?? '').slice(0, 25) },
        },
      },
    },
    {
      assetOperation: {
        create: {
          resourceName: tempLogoAsset,
          type: 'IMAGE',
          name: params.assetGroup.logos[0]?.name || `Logo ${Date.now()}`,
          imageAsset: { data: preFetched.logoBase64 },
        },
      },
    },
    {
      campaignOperation: {
        create: {
          resourceName: tempCampaign,
          name: params.campaignName,
          advertisingChannelType: 'PERFORMANCE_MAX',
          campaignBudget: budgetResourceName,
          status: 'ENABLED',
          containsEuPoliticalAdvertising: params.containsEuPoliticalAdvertising,
          geoTargetTypeSetting,
          ...buildBiddingField(params),
          startDateTime,
          ...(endDateTime && { endDateTime }),
          assetAutomationSettings,
        },
      },
    },
    {
      campaignAssetOperation: {
        create: {
          campaign: tempCampaign,
          asset: tempBusinessNameAsset,
          fieldType: 'BUSINESS_NAME',
        },
      },
    },
    {
      campaignAssetOperation: {
        create: {
          campaign: tempCampaign,
          asset: tempLogoAsset,
          fieldType: 'LOGO',
        },
      },
    },
  ]

  const campaignAssetOps = mutateOperations.slice(3).map((op: Record<string, unknown>) => op.campaignAssetOperation)
  console.log(
    '[PMax] campaignAssets:mutate (batch) request:',
    JSON.stringify(
      campaignAssetOps.map((op: unknown) => {
        const o = op as { create?: { fieldType?: string; asset?: string; campaign?: string } }
        return {
          fieldType: o?.create?.fieldType,
          asset: o?.create?.asset,
          campaign: o?.create?.campaign,
        }
      }),
      null,
      2
    )
  )

  const body = {
    mutateOperations,
  }

  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${cid}/googleAds:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify(body),
  })
  const data = await res.json()

  if (!res.ok) {
    const googleError = data?.error
    const firstDetail = googleError?.details?.[0]?.errors?.[0]
    const msg = firstDetail
      ? `[googleAds:mutate] ${JSON.stringify(firstDetail.errorCode)} | ${firstDetail.message} | field: ${firstDetail.location?.fieldPathElements?.map((f: { fieldName?: string }) => f.fieldName).join('.') ?? 'n/a'}`
      : `[googleAds:mutate] ${googleError?.message ?? 'unknown error'} | status: ${res.status} | body: ${JSON.stringify(data)}`
    const err = new Error(msg) as Error & { status?: number; googleError?: unknown }
    err.status = res.status
    err.googleError = data
    throw err
  }

  const results: Array<Record<string, unknown>> = data?.mutateOperationResponses ?? []
  let campaignResourceName: string | null = null
  const assetResourceNames: string[] = []

  for (const r of results) {
    if (r.campaignResult && typeof r.campaignResult === 'object') {
      const cr = r.campaignResult as { resourceName?: string }
      if (cr.resourceName) campaignResourceName = cr.resourceName
    }
    if (r.assetResult && typeof r.assetResult === 'object') {
      const ar = r.assetResult as { resourceName?: string }
      if (ar.resourceName) assetResourceNames.push(ar.resourceName)
    }
  }

  const businessNameAssetRn = assetResourceNames[0] ?? null
  const logoAssetRn = assetResourceNames[1] ?? null

  if (!campaignResourceName) throw new Error('Campaign resource name not returned from googleAds:mutate')
  if (!businessNameAssetRn) throw new Error('Business name asset resource name not returned')
  if (!logoAssetRn) throw new Error('Logo asset resource name not returned')

  console.log('[PMax] googleAds:mutate response: campaignRn=', campaignResourceName, 'businessNameRn=', businessNameAssetRn, 'logoRn=', logoAssetRn)
  return { campaignResourceName, businessNameAssetRn, logoAssetRn }
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

interface CampaignBrandAssets {
  businessNameAssetRn: string
  logoAssetRn: string
}

/** Create asset group + all assets + assetGroupAsset links in ONE googleAds:mutate batch.
 * PMax requires asset group and minimum asset links (3 headlines, 1 long headline, 2 descriptions, images)
 * to be created atomically. Ayrı ayrı create + link NOT_ENOUGH_HEADLINE_ASSET hatası üretir.
 * BUSINESS_NAME and LOGO stay at campaign level (not in this batch).
 */
async function createAssetGroupWithAssets(
  ctx: Ctx,
  params: CreatePerformanceMaxPayload,
  campaignResourceName: string,
  preFetched: PreFetchedImages,
  brandAssets: CampaignBrandAssets
): Promise<string> {
  const { assetGroup } = params
  const cid = ctx.customerId

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

  const headlines = assetGroup.headlines.slice(0, 15)
  const longHeadlines = assetGroup.longHeadlines.slice(0, 5)
  const descriptions = assetGroup.descriptions.slice(0, 5)

  const tempAssetGroup = `customers/${cid}/assetGroups/-10`
  let nextTempId = -20

  const mutateOperations: Record<string, unknown>[] = []

  const headlineTempRns: string[] = []
  for (let i = 0; i < headlines.length; i++) {
    const tempRn = `customers/${cid}/assets/${nextTempId}`
    headlineTempRns.push(tempRn)
    nextTempId--
    mutateOperations.push({
      assetOperation: {
        create: {
          resourceName: tempRn,
          type: 'TEXT',
          name: `Headline ${i + 1}`,
          textAsset: { text: headlines[i].slice(0, 30) },
        },
      },
    })
  }

  const longHeadlineTempRns: string[] = []
  for (let i = 0; i < longHeadlines.length; i++) {
    const tempRn = `customers/${cid}/assets/${nextTempId}`
    longHeadlineTempRns.push(tempRn)
    nextTempId--
    mutateOperations.push({
      assetOperation: {
        create: {
          resourceName: tempRn,
          type: 'TEXT',
          name: `Long headline ${i + 1}`,
          textAsset: { text: longHeadlines[i].slice(0, 90) },
        },
      },
    })
  }

  const descriptionTempRns: string[] = []
  for (let i = 0; i < descriptions.length; i++) {
    const tempRn = `customers/${cid}/assets/${nextTempId}`
    descriptionTempRns.push(tempRn)
    nextTempId--
    mutateOperations.push({
      assetOperation: {
        create: {
          resourceName: tempRn,
          type: 'TEXT',
          name: `Description ${i + 1}`,
          textAsset: { text: descriptions[i].slice(0, 90) },
        },
      },
    })
  }

  const tempMarketingImage = `customers/${cid}/assets/${nextTempId}`
  nextTempId--
  mutateOperations.push({
    assetOperation: {
      create: {
        resourceName: tempMarketingImage,
        type: 'IMAGE',
        name: assetGroup.images[0]?.name || `Marketing Image ${Date.now()}`,
        imageAsset: { data: preFetched.marketingBase64 },
      },
    },
  })

  mutateOperations.push({
    assetGroupOperation: {
      create: {
        resourceName: tempAssetGroup,
        name: assetGroup.name || 'Asset Group 1',
        campaign: campaignResourceName,
        status: 'ENABLED',
        finalUrls: [params.finalUrl || 'https://example.com'],
      },
    },
  })

  const fieldTypes: string[] = []

  for (const rn of headlineTempRns) {
    mutateOperations.push({
      assetGroupAssetOperation: {
        create: {
          assetGroup: tempAssetGroup,
          asset: rn,
          fieldType: 'HEADLINE',
        },
      },
    })
    fieldTypes.push('HEADLINE')
  }
  for (const rn of longHeadlineTempRns) {
    mutateOperations.push({
      assetGroupAssetOperation: {
        create: {
          assetGroup: tempAssetGroup,
          asset: rn,
          fieldType: 'LONG_HEADLINE',
        },
      },
    })
    fieldTypes.push('LONG_HEADLINE')
  }
  for (const rn of descriptionTempRns) {
    mutateOperations.push({
      assetGroupAssetOperation: {
        create: {
          assetGroup: tempAssetGroup,
          asset: rn,
          fieldType: 'DESCRIPTION',
        },
      },
    })
    fieldTypes.push('DESCRIPTION')
  }
  mutateOperations.push({
    assetGroupAssetOperation: {
      create: {
        assetGroup: tempAssetGroup,
        asset: tempMarketingImage,
        fieldType: 'MARKETING_IMAGE',
      },
    },
  })
  fieldTypes.push('MARKETING_IMAGE')

  mutateOperations.push({
    assetGroupAssetOperation: {
      create: {
        assetGroup: tempAssetGroup,
        asset: brandAssets.logoAssetRn,
        fieldType: 'SQUARE_MARKETING_IMAGE',
      },
    },
  })
  fieldTypes.push('SQUARE_MARKETING_IMAGE')

  console.log('[PMax] asset group batch:', {
    operationCount: mutateOperations.length,
    headlineAssetTempResourceNames: headlineTempRns,
    assetGroupAssetFieldTypes: fieldTypes,
  })

  const body = { mutateOperations }
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${cid}/googleAds:mutate`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(ctx),
    body: JSON.stringify(body),
  })
  const data = await res.json()

  if (!res.ok) {
    console.error('[PMax] Google Ads raw error body:', JSON.stringify(data, null, 2))
    const googleError = data?.error
    const firstDetail = googleError?.details?.[0]?.errors?.[0]
    const msg = firstDetail
      ? `[assetGroups] ${JSON.stringify(firstDetail.errorCode)} | ${firstDetail.message}`
      : `[assetGroups] ${googleError?.message ?? 'unknown error'} | status: ${res.status} | body: ${JSON.stringify(data)}`
    const err = new Error(msg) as Error & { status?: number; googleError?: unknown }
    err.status = res.status
    err.googleError = data
    throw err
  }

  const results: Array<Record<string, unknown>> = data?.mutateOperationResponses ?? []
  let assetGroupResourceName: string | null = null

  for (const r of results) {
    if (r.assetGroupResult && typeof r.assetGroupResult === 'object') {
      const agr = r.assetGroupResult as { resourceName?: string }
      if (agr.resourceName) assetGroupResourceName = agr.resourceName
    }
  }

  if (!assetGroupResourceName) throw new Error('Asset group resource name not returned from googleAds:mutate')
  console.log('[PMax] asset group batch success: assetGroupRn=', assetGroupResourceName)

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
 * Order: Validate+fetch → Budget → Campaign+BUSINESS_NAME+LOGO (googleAds:mutate batch) → Criteria → Asset group → Signals → Conversion goals.
 * BUSINESS_NAME and LOGO are linked at campaign level (CampaignAsset), not asset group.
 */
export async function createPerformanceMaxCampaign(
  ctx: Ctx,
  params: CreatePerformanceMaxPayload
): Promise<CreatePerformanceMaxResult> {
  const preFetched = await validateAndFetchImages(params)
  const budgetResourceName = await createBudget(ctx, params)
  const { campaignResourceName, businessNameAssetRn, logoAssetRn } = await createCampaignWithBrandAssets(
    ctx,
    params,
    budgetResourceName,
    preFetched
  )
  await createCampaignCriteria(ctx, params, campaignResourceName)
  const assetGroupResourceName = await createAssetGroupWithAssets(
    ctx,
    params,
    campaignResourceName,
    preFetched,
    { businessNameAssetRn, logoAssetRn }
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
    _debug: { businessNameAssetRn, logoAssetRn },
  }
}
