import { NextResponse } from 'next/server'
import type { FullAdProposal } from '@/lib/yoai/adCreator'
import { isDestinationAllowed, getAllowedDestinations, getDefaultOptimizationGoal, isOptimizationGoalAllowed } from '@/lib/meta/spec/objectiveSpec'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/create-ad
   Full Auto: Creates campaign + ad set from FullAdProposal.
   AI mevcut kampanyayı analiz edip iyileştirilmiş yapı önerir.
   Önerilen değerler objectiveSpec'e göre doğrulanır.
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { proposal } = body as { proposal: FullAdProposal }

    if (!proposal?.platform) {
      return NextResponse.json({ ok: false, error: 'Geçersiz reklam önerisi — platform eksik' }, { status: 400 })
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const requestUrl = new URL(request.url)
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || `${requestUrl.protocol}//${requestUrl.host}`
    console.log(`[CreateAd] baseUrl: ${baseUrl}, platform: ${proposal.platform}`)

    /* ═══════════════ GOOGLE ═══════════════ */
    if (proposal.platform === 'Google') {
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

    /* ═══════════════ META ═══════════════ */
    if (proposal.platform === 'Meta') {
      const objective = proposal.campaignObjective || 'OUTCOME_TRAFFIC'

      // ── AI önerisi → objectiveSpec doğrulaması ──
      // AI'ın önerdiği destination ve goal'u kullan, geçersizse spec'ten default al
      let destination = proposal.destinationType || ''
      let optimizationGoal = proposal.optimizationGoal || ''

      // Destination geçerli mi? Değilse spec'ten ilk izin verilen destination'ı al
      if (!destination || !isDestinationAllowed(objective, destination)) {
        const allowed = getAllowedDestinations(objective)
        destination = allowed.includes('WEBSITE' as never) ? 'WEBSITE' : allowed[0] || 'WEBSITE'
      }

      // OptimizationGoal geçerli mi? Değilse spec'ten default al
      if (!optimizationGoal || !isOptimizationGoalAllowed(objective, destination, optimizationGoal)) {
        optimizationGoal = getDefaultOptimizationGoal(objective, destination)
      }

      console.log(`[CreateAd] AI proposed: dest=${proposal.destinationType} goal=${proposal.optimizationGoal} → validated: dest=${destination} goal=${optimizationGoal}`)

      // Step 1 — Create Campaign
      const campaignRes = await fetch(`${baseUrl}/api/meta/campaigns/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({
          name: proposal.campaignName || `YoAi — ${proposal.headline}`,
          objective,
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

      // Step 1.5 — Resolve pageId from capabilities (wizard ile aynı)
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
      } catch (e) {
        console.warn('[CreateAd] Failed to resolve pageId:', e)
      }

      // Step 2 — Create Ad Set
      // destination_type: adsets/create route zaten ON_AD/ON_PAGE/CALL için
      // destination_type'ı Meta API'ye göndermemeyi biliyor (subcode 1815715 koruması).
      // Biz her zaman AI'ın doğrulanmış destination değerini gönderiyoruz.
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
          destination_type: destination,
          status: 'PAUSED',
          targeting: {
            geo_locations: { countries: ['TR'] },
          },
        }),
      })

      const adsetData = await adsetRes.json().catch(() => ({}))
      if (!adsetRes.ok || adsetData.ok === false) {
        const metaErr = adsetData.error
        const errMsg = adsetData.error_user_msg
          || adsetData.message
          || (typeof metaErr === 'object' && metaErr ? (metaErr.error_user_msg || metaErr.message || JSON.stringify(metaErr)) : metaErr)
          || 'hata'
        return NextResponse.json({
          ok: false,
          error: `Kampanya oluşturuldu (${campaignId}) ancak reklam seti oluşturulamadı: ${errMsg}`,
          campaignId,
          _debug: {
            objective, destination, optimizationGoal,
            aiProposed: { dest: proposal.destinationType, goal: proposal.optimizationGoal },
          },
        }, { status: 422 })
      }

      const adsetId = adsetData.adsetId || adsetData.data?.id

      return NextResponse.json({
        ok: true,
        platform: 'Meta',
        campaignId,
        adsetId: adsetId || null,
        message: adsetId
          ? `"${proposal.campaignName}" kampanyası ve reklam seti başarıyla oluşturuldu (PAUSED). Reklam görselini Meta Ads Manager'dan ekleyerek kampanyayı tamamlayabilirsiniz.`
          : `Kampanya oluşturuldu (${campaignId}) ancak reklam seti ID alınamadı. Meta Ads sayfasından tamamlayabilirsiniz.`,
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
