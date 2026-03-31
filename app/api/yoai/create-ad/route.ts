import { NextResponse } from 'next/server'
import type { FullAdProposal } from '@/lib/yoai/adCreator'
import { isDestinationAllowed, getAllowedDestinations, getDefaultOptimizationGoal } from '@/lib/meta/spec/objectiveSpec'

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

      // Step 1.5 — Resolve pageId from capabilities
      let resolvedPageId = ''
      try {
        const capRes = await fetch(`${baseUrl}/api/meta/capabilities`, {
          method: 'GET',
          headers: { Cookie: cookieHeader },
        })
        const capData = await capRes.json().catch(() => ({}))
        const pages = capData.assets?.pages || []
        if (pages.length > 0) {
          resolvedPageId = pages[0].id
        }
        console.log(`[CreateAd] Resolved pageId: ${resolvedPageId || '(none)'} from ${pages.length} pages`)
      } catch (e) {
        console.warn('[CreateAd] Failed to resolve pageId from capabilities:', e)
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
        MESSENGER: 'MESSENGER',
        WHATSAPP: 'WHATSAPP',
        INSTAGRAM_DIRECT: 'INSTAGRAM_DIRECT',
        CALL: 'CALL',
        ON_PAGE: 'ON_PAGE',
      }
      const objective = proposal.campaignObjective || 'OUTCOME_TRAFFIC'
      let conversionLocation = conversionLocationMap[proposal.destinationType || ''] || 'WEBSITE'

      // Validate destination against objective — fallback to first allowed destination
      if (!isDestinationAllowed(objective, conversionLocation)) {
        const allowed = getAllowedDestinations(objective)
        const fallback = allowed.includes('WEBSITE' as never) ? 'WEBSITE' : allowed[0] || 'WEBSITE'
        console.log(`[CreateAd] destination ${conversionLocation} invalid for ${objective}, fallback to ${fallback}`)
        conversionLocation = fallback
      }

      // Resolve optimization goal from spec
      const optimizationGoal = proposal.optimizationGoal || getDefaultOptimizationGoal(objective, conversionLocation)

      console.log(`[CreateAd] adset payload: objective=${objective} destination_type=${conversionLocation} optimizationGoal=${optimizationGoal} pageId=${resolvedPageId}`)

      const adsetRes = await fetch(`${baseUrl}/api/meta/adsets/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({
          campaignId,
          name: proposal.adsetName || `YoAi Reklam Seti`,
          pageId: resolvedPageId,
          dailyBudget: proposal.dailyBudget || 35,
          optimizationGoal,
          billingEvent: 'IMPRESSIONS',
          destination_type: conversionLocation,
          status: 'PAUSED',
          targeting: {
            geo_locations: { countries: ['TR'] },
          },
        }),
      })

      const adsetData = await adsetRes.json().catch(() => ({}))
      console.log('[CreateAd] adset response status:', adsetRes.status, 'body:', JSON.stringify(adsetData))
      if (!adsetRes.ok || adsetData.ok === false) {
        // adsets/create returns error as object (Meta API error) or string
        const metaErr = adsetData.error
        const errMsg = adsetData.error_user_msg
          || adsetData.message
          || (typeof metaErr === 'object' && metaErr ? (metaErr.error_user_msg || metaErr.message || JSON.stringify(metaErr)) : metaErr)
          || 'hata'
        return NextResponse.json({
          ok: false,
          error: `Kampanya oluşturuldu (${campaignId}) ancak reklam seti oluşturulamadı: ${errMsg}`,
          campaignId,
          _adsetDebug: adsetData,
        }, { status: 422 })
      }

      const adsetId = adsetData.adsetId || adsetData.data?.id

      // Step 3 — Create Ad (if adset created successfully and creative media exists)
      if (adsetId) {
        // AI proposals don't include imageHash/videoId — ad creation requires media.
        // Skip ad creation; user completes the ad in Meta Ads Manager.
        return NextResponse.json({
          ok: true,
          platform: 'Meta',
          campaignId,
          adsetId,
          message: `"${proposal.campaignName}" kampanyası ve reklam seti başarıyla oluşturuldu (PAUSED). Reklam görselini Meta Ads Manager'dan ekleyerek kampanyayı tamamlayabilirsiniz.`,
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
