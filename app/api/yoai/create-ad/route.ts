import { NextResponse } from 'next/server'
import type { FullAdProposal } from '@/lib/yoai/adCreator'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/create-ad
   Full Auto: Creates campaign + ad set + ad from FullAdProposal.
   Uses existing Meta/Google campaign creation endpoints.
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { proposal } = body as { proposal: FullAdProposal }

    if (!proposal?.platform) {
      return NextResponse.json({ ok: false, error: 'Geçersiz reklam önerisi — platform eksik' }, { status: 400 })
    }

    const cookieHeader = request.headers.get('cookie') || ''
    // Derive baseUrl from the incoming request to avoid localhost fallback on Vercel
    const requestUrl = new URL(request.url)
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || `${requestUrl.protocol}//${requestUrl.host}`
    console.log(`[CreateAd] baseUrl: ${baseUrl}, platform: ${proposal.platform}`)

    if (proposal.platform === 'Google') {
      // Google: full campaign create (campaign + ad group + RSA)
      if (!proposal.headlines?.length || !proposal.descriptions?.length) {
        return NextResponse.json({ ok: false, error: 'Google RSA için başlıklar ve açıklamalar gereklidir.' }, { status: 400 })
      }

      const budgetMicros = (proposal.dailyBudget || 50) * 1_000_000

      const res = await fetch(`${baseUrl}/api/integrations/google-ads/campaigns/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({
          campaignName: proposal.campaignName || `YoAi — ${proposal.headlines[0]}`,
          advertisingChannelType: 'SEARCH',
          dailyBudgetMicros: budgetMicros,
          biddingStrategy: proposal.biddingStrategy || 'MAXIMIZE_CLICKS',
          adGroupName: proposal.adsetName || `YoAi Ad Group`,
          finalUrl: proposal.finalUrl || 'https://example.com',
          headlines: proposal.headlines,
          descriptions: proposal.descriptions,
          keywords: (proposal.keywords || []).map(k => ({ text: k, matchType: 'BROAD' })),
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) {
        return NextResponse.json({
          ok: false,
          error: data.message || data.error || 'Google kampanya oluşturulamadı',
        }, { status: 422 })
      }

      return NextResponse.json({
        ok: true,
        platform: 'Google',
        campaignResourceName: data.campaignResourceName,
        adGroupResourceName: data.adGroupResourceName,
        message: `"${proposal.campaignName}" kampanyası başarıyla oluşturuldu (PAUSED). Kampanyayı aktif etmek için Google Ads sayfasına gidin.`,
      })
    }

    if (proposal.platform === 'Meta') {
      // Meta: Step 1 — Create Campaign
      const campaignRes = await fetch(`${baseUrl}/api/meta/campaigns/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({
          name: proposal.campaignName || `YoAi — ${proposal.headline}`,
          objective: proposal.campaignObjective || 'OUTCOME_TRAFFIC',
          status: 'PAUSED',
        }),
      })

      const campaignData = await campaignRes.json().catch(() => ({}))
      if (!campaignRes.ok || campaignData.ok === false) {
        return NextResponse.json({
          ok: false,
          error: campaignData.error_user_msg || campaignData.message || 'Meta kampanya oluşturulamadı',
        }, { status: 422 })
      }

      const campaignId = campaignData.campaignId || campaignData.data?.id
      if (!campaignId) {
        return NextResponse.json({ ok: false, error: 'Kampanya ID alınamadı' }, { status: 422 })
      }

      // Step 2 — Create Ad Set
      // Map destination type to conversion location
      const conversionLocationMap: Record<string, string> = {
        WEBSITE: 'WEBSITE',
        ON_AD: 'ON_AD',
        MESSAGING_INSTAGRAM_DIRECT_WHATSAPP: 'MESSENGER',
        MESSAGING_MESSENGER_WHATSAPP: 'MESSENGER',
        APP: 'APP',
        PHONE_CALL: 'PHONE_CALL',
      }
      const conversionLocation = conversionLocationMap[proposal.destinationType || ''] || 'WEBSITE'

      const adsetRes = await fetch(`${baseUrl}/api/meta/adsets/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({
          campaignId,
          name: proposal.adsetName || `YoAi Reklam Seti`,
          pageId: '', // Will be resolved from account
          dailyBudget: proposal.dailyBudget || 35,
          optimizationGoal: proposal.optimizationGoal || 'LINK_CLICKS',
          conversionLocation,
          status: 'PAUSED',
          targeting: {
            geo_locations: { countries: ['TR'] },
          },
        }),
      })

      const adsetData = await adsetRes.json().catch(() => ({}))
      if (!adsetRes.ok || adsetData.ok === false) {
        return NextResponse.json({
          ok: false,
          error: `Kampanya oluşturuldu (${campaignId}) ancak reklam seti oluşturulamadı: ${adsetData.error_user_msg || adsetData.message || 'hata'}`,
          campaignId,
        }, { status: 422 })
      }

      const adsetId = adsetData.adsetId || adsetData.data?.id

      // Step 3 — Create Ad (if adset created successfully)
      if (adsetId) {
        const adRes = await fetch(`${baseUrl}/api/meta/ads/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
          body: JSON.stringify({
            name: proposal.adName || `YoAi Reklam`,
            adsetId,
            pageId: '', // Will be resolved
            objective: proposal.campaignObjective || 'OUTCOME_TRAFFIC',
            creative: {
              format: 'single_image',
              primaryText: proposal.primaryText,
              headline: proposal.headline,
              description: proposal.description,
              callToAction: proposal.callToAction || 'LEARN_MORE',
              websiteUrl: proposal.finalUrl,
            },
            status: 'PAUSED',
          }),
        })

        const adData = await adRes.json().catch(() => ({}))
        if (!adRes.ok || adData.ok === false) {
          return NextResponse.json({
            ok: true,
            platform: 'Meta',
            campaignId,
            adsetId,
            message: `Kampanya ve reklam seti oluşturuldu ancak reklam oluşturulamadı: ${adData.error_user_msg || adData.message || 'hata'}. Meta Ads sayfasından reklamı manuel ekleyebilirsiniz.`,
          })
        }

        return NextResponse.json({
          ok: true,
          platform: 'Meta',
          campaignId,
          adsetId,
          adId: adData.adId,
          message: `"${proposal.campaignName}" kampanyası tam yapıyla oluşturuldu (PAUSED). Kampanya + Reklam Seti + Reklam hazır. Meta Ads sayfasından aktif edebilirsiniz.`,
        })
      }

      return NextResponse.json({
        ok: true,
        platform: 'Meta',
        campaignId,
        message: `Kampanya oluşturuldu (${campaignId}) ancak reklam seti ID alınamadı. Meta Ads sayfasından tamamlayabilirsiniz.`,
      })
    }

    return NextResponse.json({ ok: false, error: 'Desteklenmeyen platform' }, { status: 400 })
  } catch (error) {
    console.error('[Create Ad] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
