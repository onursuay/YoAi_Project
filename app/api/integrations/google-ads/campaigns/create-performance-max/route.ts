import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsContext, getGoogleAdsContextForAdmin } from '@/lib/googleAdsAuth'
import { createPerformanceMaxCampaign } from '@/lib/google-ads/create-performance-max-campaign'
import type { CreatePerformanceMaxPayload } from '@/components/google/wizard/pmax/shared/PMaxCreatePayload'

const SEARCH_SPECIFIC_FIELDS = [
  'adGroupName',
  'keywords',
  'negativeKeywords',
  'defaultMatchType',
  'cpcBid',
  'path1',
  'path2',
  'responsiveSearchAd',
] as const

const API_ERRORS = {
  tr: {
    notPerformanceMax: 'Bu endpoint sadece Performance Max kampanyaları kabul eder.',
    searchFieldsRejected: 'Search kampanyasına özgü alanlar Performance Max için geçersiz.',
    campaignNameRequired: 'Kampanya adı zorunlu',
    minBudget: 'Minimum günlük bütçe 1 TRY (1_000_000 mikro)',
    urlRequired: 'Geçerli bir finalUrl gerekli',
    minHeadlines: 'En az 3 başlık gerekli',
    minLongHeadline: 'En az 1 uzun başlık gerekli',
    minDescriptions: 'En az 2 açıklama gerekli',
    assetGroupNameRequired: 'Varlık grubu adı zorunlu',
    businessNameRequired: 'İşletme adı zorunlu',
    minImagesRequired:
      'Non-retail Performance Max için en az 1 görsel (images) ve 1 logo (logos) gereklidir. Her biri geçerli bir URL içermelidir.',
    PMax_REQUIRES_IMAGES_AND_LOGO:
      'Görsel yükleme başarısız. En az 1 görsel ve 1 logo gerekli; URL\'ler erişilebilir olmalı.',
    PMax_INVALID_ASPECT_RATIO_MARKETING:
      'Marketing görsel yanlış oran. 1.91:1 landscape (ör. 1200x628) gerekli.',
    PMax_INVALID_ASPECT_RATIO_LOGO:
      'Logo yanlış oran. 1:1 kare (ör. 1200x1200) gerekli.',
    DUPLICATE_CAMPAIGN_NAME: 'Bu isimde bir kampanya zaten mevcut. Lütfen farklı bir kampanya adı kullanın.',
    BUDGET_AMOUNT_TOO_SMALL: 'Bütçe tutarı çok düşük.',
    RESOURCE_NOT_FOUND: 'Seçilen kaynak bulunamadı.',
    INVALID_CONVERSION_ACTION: 'Seçilen dönüşüm hedefi geçersiz veya bulunamadı.',
    CUSTOMER_NOT_ENABLED: 'Google Ads hesabı etkin değil veya erişim kısıtlı.',
    UNAUTHENTICATED: 'Google Ads hesabına erişim doğrulanamadı. Lütfen tekrar bağlanın.',
    PERMISSION_DENIED: 'Bu işlem için yetkiniz yok.',
    generic: 'İşlem başarısız oldu. Lütfen bilgilerinizi kontrol edip tekrar deneyin.',
  },
  en: {
    notPerformanceMax: 'This endpoint only accepts Performance Max campaigns.',
    searchFieldsRejected: 'Search-specific fields are invalid for Performance Max.',
    campaignNameRequired: 'Campaign name is required',
    minBudget: 'Minimum daily budget is 1 TRY (1_000_000 micros)',
    urlRequired: 'A valid finalUrl is required',
    minHeadlines: 'At least 3 headlines are required',
    minLongHeadline: 'At least 1 long headline is required',
    minDescriptions: 'At least 2 descriptions are required',
    assetGroupNameRequired: 'Asset group name is required',
    businessNameRequired: 'Business name is required',
    minImagesRequired:
      'Non-retail Performance Max requires at least 1 image (images) and 1 logo (logos), each with a valid URL.',
    PMax_REQUIRES_IMAGES_AND_LOGO:
      'Image upload failed. At least 1 image and 1 logo required; URLs must be accessible.',
    PMax_INVALID_ASPECT_RATIO_MARKETING:
      'Marketing image has wrong aspect ratio. 1.91:1 landscape (e.g. 1200x628) required.',
    PMax_INVALID_ASPECT_RATIO_LOGO:
      'Logo has wrong aspect ratio. 1:1 square (e.g. 1200x1200) required.',
    DUPLICATE_CAMPAIGN_NAME: 'A campaign with this name already exists. Please use a different campaign name.',
    BUDGET_AMOUNT_TOO_SMALL: 'Budget amount is too low.',
    RESOURCE_NOT_FOUND: 'Selected resource was not found.',
    INVALID_CONVERSION_ACTION: 'Selected conversion goal is invalid or not found.',
    CUSTOMER_NOT_ENABLED: 'Google Ads account is not enabled or access is restricted.',
    UNAUTHENTICATED: 'Could not verify access to Google Ads account. Please reconnect.',
    PERMISSION_DENIED: 'You do not have permission for this operation.',
    generic: 'Operation failed. Please check your information and try again.',
  },
} as const

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return badRequest(API_ERRORS.tr.generic)
    }

    if (body == null || typeof body !== 'object') {
      return badRequest(API_ERRORS.tr.campaignNameRequired)
    }

    const b = body as Record<string, unknown>

    if (b.advertisingChannelType != null && b.advertisingChannelType !== 'PERFORMANCE_MAX') {
      return badRequest(API_ERRORS.tr.notPerformanceMax)
    }

    for (const field of SEARCH_SPECIFIC_FIELDS) {
      if (b[field] !== undefined && b[field] !== null) {
        return badRequest(API_ERRORS.tr.searchFieldsRejected)
      }
    }

    const campaignName = typeof b.campaignName === 'string' ? b.campaignName.trim() : ''
    if (!campaignName) {
      return badRequest(API_ERRORS.tr.campaignNameRequired)
    }

    const dailyBudgetMicros = Number(b.dailyBudgetMicros)
    if (!Number.isFinite(dailyBudgetMicros) || dailyBudgetMicros < 1_000_000) {
      return badRequest(API_ERRORS.tr.minBudget)
    }

    const finalUrl = typeof b.finalUrl === 'string' ? b.finalUrl : ''
    if (!finalUrl.startsWith('http')) {
      return badRequest(API_ERRORS.tr.urlRequired)
    }

    const ag = b.assetGroup
    if (ag == null || typeof ag !== 'object') {
      return badRequest(API_ERRORS.tr.assetGroupNameRequired)
    }

    const agObj = ag as Record<string, unknown>
    const agName = typeof agObj.name === 'string' ? agObj.name.trim() : ''
    if (!agName) {
      return badRequest(API_ERRORS.tr.assetGroupNameRequired)
    }

    const businessName = typeof agObj.businessName === 'string' ? agObj.businessName.trim() : ''
    if (!businessName) {
      return badRequest(API_ERRORS.tr.businessNameRequired)
    }

    const headlines = Array.isArray(agObj.headlines) ? agObj.headlines : []
    if (headlines.length < 3) {
      return badRequest(API_ERRORS.tr.minHeadlines)
    }

    const longHeadlines = Array.isArray(agObj.longHeadlines) ? agObj.longHeadlines : []
    if (longHeadlines.length < 1) {
      return badRequest(API_ERRORS.tr.minLongHeadline)
    }

    const descriptions = Array.isArray(agObj.descriptions) ? agObj.descriptions : []
    if (descriptions.length < 2) {
      return badRequest(API_ERRORS.tr.minDescriptions)
    }

    const images = Array.isArray(agObj.images) ? agObj.images : []
    const imagesWithUrl = images.filter((img: unknown) => {
      if (img == null || typeof img !== 'object') return false
      const u = (img as Record<string, unknown>).url
      return typeof u === 'string' && u.trim().length > 0
    })
    const logos = Array.isArray(agObj.logos) ? agObj.logos : []
    const logosWithUrl = logos.filter((img: unknown) => {
      if (img == null || typeof img !== 'object') return false
      const u = (img as Record<string, unknown>).url
      return typeof u === 'string' && u.trim().length > 0
    })
    if (imagesWithUrl.length < 1 || logosWithUrl.length < 1) {
      return badRequest(API_ERRORS.tr.minImagesRequired)
    }

    const params = b as unknown as CreatePerformanceMaxPayload

    const cookieStore = await cookies()
    const locale = (cookieStore.get('NEXT_LOCALE')?.value ?? 'tr') === 'en' ? 'en' : 'tr'
    const msg = API_ERRORS[locale]

    const smokeSecret = req.headers.get('X-Smoke-Test')
    const ctx =
      smokeSecret && process.env.ADMIN_SECRET && smokeSecret === process.env.ADMIN_SECRET
        ? await getGoogleAdsContextForAdmin()
        : await getGoogleAdsContext()

    const result = await createPerformanceMaxCampaign(ctx, params)

    if (result._debug) {
      console.log('[create-performance-max] PMax create debug:', {
        campaignResourceName: result.campaignResourceName,
        businessNameAssetRn: result._debug.businessNameAssetRn,
        logoAssetRn: result._debug.logoAssetRn,
        assetGroupResourceName: result.assetGroupResourceName,
      })
    }

    const warning =
      result.conversionGoalsWarning &&
      (msg as Record<string, string>)[result.conversionGoalsWarning]
        ? (msg as Record<string, string>)[result.conversionGoalsWarning]
        : result.conversionGoalsWarning

    if (!result.assetGroupResourceName) {
      return NextResponse.json(
        { error: msg.generic },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        campaignResourceName: result.campaignResourceName,
        assetGroupResourceName: result.assetGroupResourceName,
        ...(warning && { conversionGoalsWarning: warning }),
      },
      { status: 201 }
    )
  } catch (e: unknown) {
    const err = e as Error & { status?: number; googleError?: unknown }
    console.error('[create-performance-max] error:', err?.message ?? String(e))
    const msg = API_ERRORS.tr
    const googleErr = err.googleError as Record<string, unknown> | undefined
    const errorObj = googleErr?.error as Record<string, unknown> | undefined
    const firstDetail = errorObj?.details as Array<Record<string, unknown>> | undefined
    const firstError = firstDetail?.[0]?.errors as Array<Record<string, unknown>> | undefined
    const errorCode = firstError?.[0]?.errorCode as Record<string, string> | undefined
    const code = errorCode ? Object.values(errorCode)[0] : null
    const userMessage =
      (code && (API_ERRORS.tr as Record<string, string>)[code]) ??
      (API_ERRORS.tr as Record<string, string>)[err.message as string] ??
      msg.generic
    const status = typeof err.status === 'number' ? err.status : 500
    return NextResponse.json(
      { error: userMessage },
      { status }
    )
  }
}
