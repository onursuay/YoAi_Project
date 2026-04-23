import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import { createFullCampaign } from '@/lib/google-ads/create-campaign'

/** Locale-aware error messages for Search campaign create API */
const API_ERRORS = {
  tr: {
    campaignNameRequired: 'Kampanya adı zorunlu',
    minBudget: 'Minimum günlük bütçe 1 TRY (1_000_000 mikro)',
    urlRequired: 'Geçerli bir finalUrl gerekli',
    minHeadlines: 'En az 3 başlık gerekli',
    minDescriptions: 'En az 2 açıklama gerekli',
    DUPLICATE_CAMPAIGN_NAME: 'Bu isimde bir kampanya zaten mevcut. Lütfen farklı bir kampanya adı kullanın.',
    BUDGET_AMOUNT_TOO_SMALL: 'Bütçe tutarı çok düşük.',
    KEYWORD_TEXT_TOO_LONG: 'Anahtar kelime metni çok uzun.',
    HEADLINE_TOO_LONG: 'Başlık çok uzun (maks. 30 karakter).',
    DESCRIPTION_TOO_LONG: 'Açıklama çok uzun (maks. 90 karakter).',
    RESOURCE_NOT_FOUND: 'Seçilen kaynak bulunamadı. Farklı bir Google Ads hesabı altındaki listeler seçilmiş olabilir.',
    INVALID_CONVERSION_ACTION: 'Seçilen dönüşüm hedefi geçersiz veya bulunamadı. Lütfen dönüşüm hedeflerini kontrol edin.',
    CUSTOMER_NOT_ENABLED: 'Google Ads hesabı etkin değil veya erişim kısıtlı.',
    UNAUTHENTICATED: 'Google Ads hesabına erişim doğrulanamadı. Lütfen tekrar bağlanın.',
    PERMISSION_DENIED: 'Bu işlem için yetkiniz yok.',
    INVALID_URL: 'Geçerli bir URL girin (örn. https://example.com).',
    displayAssetRequired: 'Görüntülü Reklam için en az 1 yatay (landscape 1.91:1) ve 1 kare (square 1:1) görsel gerekli.',
    displayHeadlinesRequired: 'Görüntülü Reklam için en az 1 kısa başlık gerekli.',
    displayLongHeadlineRequired: 'Görüntülü Reklam için uzun başlık gerekli.',
    displayDescriptionsRequired: 'Görüntülü Reklam için en az 1 açıklama gerekli.',
    displayBusinessNameRequired: 'Görüntülü Reklam için işletme adı gerekli.',
    generic: 'İşlem başarısız oldu. Lütfen bilgilerinizi kontrol edip tekrar deneyin.',
  },
  en: {
    campaignNameRequired: 'Campaign name is required',
    minBudget: 'Minimum daily budget is 1 TRY (1_000_000 micros)',
    urlRequired: 'A valid finalUrl is required',
    minHeadlines: 'At least 3 headlines are required',
    minDescriptions: 'At least 2 descriptions are required',
    DUPLICATE_CAMPAIGN_NAME: 'A campaign with this name already exists. Please use a different campaign name.',
    BUDGET_AMOUNT_TOO_SMALL: 'Budget amount is too low.',
    KEYWORD_TEXT_TOO_LONG: 'Keyword text is too long.',
    HEADLINE_TOO_LONG: 'Headline is too long (max. 30 characters).',
    DESCRIPTION_TOO_LONG: 'Description is too long (max. 90 characters).',
    RESOURCE_NOT_FOUND: 'Selected resource was not found. Lists from another Google Ads account may have been selected.',
    INVALID_CONVERSION_ACTION: 'Selected conversion goal is invalid or not found. Please check your conversion goals.',
    CUSTOMER_NOT_ENABLED: 'Google Ads account is not enabled or access is restricted.',
    UNAUTHENTICATED: 'Could not verify access to Google Ads account. Please reconnect.',
    PERMISSION_DENIED: 'You do not have permission for this operation.',
    INVALID_URL: 'Enter a valid URL (e.g. https://example.com).',
    displayAssetRequired: 'Display campaigns need at least 1 landscape (1.91:1) and 1 square (1:1) image.',
    displayHeadlinesRequired: 'Display campaigns need at least 1 short headline.',
    displayLongHeadlineRequired: 'Display campaigns need a long headline.',
    displayDescriptionsRequired: 'Display campaigns need at least 1 description.',
    displayBusinessNameRequired: 'Display campaigns need a business name.',
    generic: 'Operation failed. Please check your information and try again.',
  },
} as const

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const locale = (cookieStore.get('NEXT_LOCALE')?.value ?? 'tr') === 'en' ? 'en' : 'tr'
  const msg = API_ERRORS[locale]

  try {
    const ctx = await getGoogleAdsContext()
    const params = await req.json()

    if (!params.campaignName?.trim()) {
      return NextResponse.json({ error: msg.campaignNameRequired }, { status: 400 })
    }
    if (!params.dailyBudgetMicros || params.dailyBudgetMicros < 1_000_000) {
      return NextResponse.json({ error: msg.minBudget }, { status: 400 })
    }
    if (!params.finalUrl?.startsWith('http')) {
      return NextResponse.json({ error: msg.urlRequired }, { status: 400 })
    }
    const isSearch = !params.advertisingChannelType || params.advertisingChannelType === 'SEARCH'
    const isDisplay = params.advertisingChannelType === 'DISPLAY'
    if (isSearch && (!params.headlines || params.headlines.length < 3)) {
      return NextResponse.json({ error: msg.minHeadlines }, { status: 400 })
    }
    if (isSearch && (!params.descriptions || params.descriptions.length < 2)) {
      return NextResponse.json({ error: msg.minDescriptions }, { status: 400 })
    }
    if (isDisplay) {
      const assets: Array<{ kind: string }> = params.displayAssets ?? []
      const hasLandscape = assets.some(a => a.kind === 'MARKETING_IMAGE')
      const hasSquare = assets.some(a => a.kind === 'SQUARE_MARKETING_IMAGE')
      if (!hasLandscape || !hasSquare) {
        return NextResponse.json({ error: msg.displayAssetRequired }, { status: 400 })
      }
      if (!params.displayHeadlines?.length) {
        return NextResponse.json({ error: msg.displayHeadlinesRequired }, { status: 400 })
      }
      if (!params.displayLongHeadline) {
        return NextResponse.json({ error: msg.displayLongHeadlineRequired }, { status: 400 })
      }
      if (!params.displayDescriptions?.length) {
        return NextResponse.json({ error: msg.displayDescriptionsRequired }, { status: 400 })
      }
      if (!params.displayBusinessName) {
        return NextResponse.json({ error: msg.displayBusinessNameRequired }, { status: 400 })
      }
    }

    const result = await createFullCampaign(ctx, params)
    return NextResponse.json({
      success: true,
      ...(result.conversionGoalsWarning && { partialSuccess: true }),
      ...result,
    }, { status: 201 })
  } catch (e: any) {
    console.error('[create-campaign] error:', e.message)
    const googleErr = e.googleError?.error
    const firstError = googleErr?.details?.[0]?.errors?.[0]
    const errorCode = firstError?.errorCode ? Object.values(firstError.errorCode)[0] : null
    const userMessage = (errorCode && (msg as Record<string, string>)[errorCode as string]) ?? msg.generic
    return NextResponse.json(
      { error: userMessage },
      { status: e.status ?? 500 }
    )
  }
}
