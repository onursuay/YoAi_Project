import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import { createFullCampaign } from '@/lib/google-ads/create-campaign'

export async function POST(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const params = await req.json()

    if (!params.campaignName?.trim()) {
      return NextResponse.json({ error: 'campaignName zorunlu' }, { status: 400 })
    }
    if (!params.dailyBudgetMicros || params.dailyBudgetMicros < 1_000_000) {
      return NextResponse.json({ error: 'Minimum günlük bütçe 1 TRY (1_000_000 mikro)' }, { status: 400 })
    }
    if (!params.finalUrl?.startsWith('http')) {
      return NextResponse.json({ error: 'Geçerli bir finalUrl gerekli' }, { status: 400 })
    }
    // RSA headline/description validation only for SEARCH campaigns
    const isSearch = !params.advertisingChannelType || params.advertisingChannelType === 'SEARCH'
    if (isSearch && (!params.headlines || params.headlines.length < 3)) {
      return NextResponse.json({ error: 'En az 3 başlık gerekli' }, { status: 400 })
    }
    if (isSearch && (!params.descriptions || params.descriptions.length < 2)) {
      return NextResponse.json({ error: 'En az 2 açıklama gerekli' }, { status: 400 })
    }

    const result = await createFullCampaign(ctx, params)
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    console.error('[create-campaign] error:', e.message)
    // Extract user-friendly error from Google Ads API response
    const googleErr = e.googleError?.error
    const firstError = googleErr?.details?.[0]?.errors?.[0]
    const errorCode = firstError?.errorCode ? Object.values(firstError.errorCode)[0] : null

    // Map known Google Ads error codes to Turkish user-friendly messages
    const friendlyMessages: Record<string, string> = {
      DUPLICATE_CAMPAIGN_NAME: 'Bu isimde bir kampanya zaten mevcut. Lütfen farklı bir kampanya adı kullanın.',
      BUDGET_AMOUNT_TOO_SMALL: 'Bütçe tutarı çok düşük.',
      KEYWORD_TEXT_TOO_LONG: 'Anahtar kelime metni çok uzun.',
      HEADLINE_TOO_LONG: 'Başlık çok uzun (maks. 30 karakter).',
      DESCRIPTION_TOO_LONG: 'Açıklama çok uzun (maks. 90 karakter).',
      RESOURCE_NOT_FOUND: 'Seçilen kitle kaynağı (örn. kullanıcı listesi) bulunamadı. Farklı bir Google Ads hesabı altındaki listeler seçilmiş olabilir.',
    }

    const userMessage = (errorCode && friendlyMessages[errorCode as string])
      ?? firstError?.message
      ?? e.message

    return NextResponse.json(
      { error: userMessage, debug: e.message, googleErrorDetails: e.googleError },
      { status: e.status ?? 500 }
    )
  }
}
