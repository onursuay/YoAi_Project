import { NextResponse } from 'next/server'
import type { AdProposal } from '@/lib/yoai/adCreator'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/create-ad
   Creates an ad from an approved AdProposal.
   Calls existing Meta/Google ad creation endpoints internally.
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { proposal } = body as { proposal: AdProposal }

    if (!proposal?.platform || !proposal?.primaryText) {
      return NextResponse.json({ ok: false, error: 'Geçersiz reklam önerisi' }, { status: 400 })
    }

    // Forward cookies for auth
    const cookieHeader = request.headers.get('cookie') || ''
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    if (proposal.platform === 'Meta') {
      // Meta requires: campaignId -> adsetId -> ad
      // For MVP, we need an existing adset to add the ad to
      if (!proposal.adsetId) {
        return NextResponse.json({
          ok: false,
          error: 'Meta reklam oluşturmak için bir reklam seti (adset) seçilmelidir.',
          requiresAdset: true,
        }, { status: 400 })
      }

      // Call existing Meta ads/create endpoint
      const res = await fetch(`${baseUrl}/api/meta/ads/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({
          name: `YoAi — ${proposal.headline}`,
          adsetId: proposal.adsetId,
          pageId: '', // Will be resolved by the ads/create endpoint from adset
          objective: 'OUTCOME_TRAFFIC', // Default
          creative: {
            format: proposal.format || 'single_image',
            primaryText: proposal.primaryText,
            headline: proposal.headline,
            description: proposal.description,
            callToAction: proposal.callToAction || 'LEARN_MORE',
            websiteUrl: proposal.finalUrl,
          },
          status: 'PAUSED', // Always create paused
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        return NextResponse.json({
          ok: false,
          error: data.error_user_msg || data.message || data.error || 'Meta reklam oluşturulamadı',
        }, { status: 422 })
      }

      return NextResponse.json({
        ok: true,
        platform: 'Meta',
        adId: data.adId,
        creativeId: data.creativeId,
        message: 'Reklam başarıyla oluşturuldu (PAUSED durumunda).',
      })
    }

    if (proposal.platform === 'Google') {
      // Google: create a full campaign or add to existing
      if (!proposal.headlines?.length || !proposal.descriptions?.length) {
        return NextResponse.json({ ok: false, error: 'Google RSA için başlıklar ve açıklamalar gereklidir.' }, { status: 400 })
      }

      if (!proposal.finalUrl) {
        return NextResponse.json({ ok: false, error: 'Google reklam için final URL gereklidir.' }, { status: 400 })
      }

      if (proposal.campaignId && proposal.adGroupId) {
        // Add ad to existing ad group — use ads create logic
        // Google doesn't have a direct "create ad in adgroup" endpoint in our routes,
        // so we'll use the campaign create endpoint with minimum setup
        return NextResponse.json({
          ok: false,
          error: 'Mevcut reklam grubuna ekleme özelliği yakında aktif olacaktır. Şimdilik yeni kampanya oluşturabilirsiniz.',
          requiresNewCampaign: true,
        }, { status: 400 })
      }

      // Create full campaign
      const res = await fetch(`${baseUrl}/api/integrations/google-ads/campaigns/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({
          campaignName: `YoAi — ${proposal.headline || proposal.headlines?.[0] || 'Yeni Kampanya'}`,
          advertisingChannelType: 'SEARCH',
          dailyBudgetMicros: 50_000_000, // 50 TRY default — user should adjust
          biddingStrategy: 'MAXIMIZE_CLICKS',
          adGroupName: `YoAi Ad Group — ${proposal.headline || proposal.headlines?.[0] || 'Grup'}`,
          finalUrl: proposal.finalUrl,
          headlines: proposal.headlines || [proposal.headline, proposal.primaryText.slice(0, 30), proposal.description.slice(0, 30)],
          descriptions: proposal.descriptions || [proposal.description, proposal.primaryText.slice(0, 90)],
          keywords: [], // Empty — user should add keywords
          status: 'PAUSED',
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
        message: 'Kampanya ve reklam başarıyla oluşturuldu (PAUSED durumunda). Anahtar kelimeleri eklemeyi unutmayın.',
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
