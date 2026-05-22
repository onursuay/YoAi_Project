/* ──────────────────────────────────────────────────────────
   POST /api/google/optimization/apply

   Optimizasyon — Google kanadı Faz 2: tek-tık CANLI uygulama.
   Bir önerinin changeSet'ini (kampanya duraklatma / günlük bütçe değişimi)
   mevcut Google Ads mutate helper'ları ile gerçek hesaba uygular.

   Rollback: aynı endpoint'e ters newValue gönderilir (status→ENABLED,
   budget→eski tutar). Entegrasyon koduna DOKUNULMAZ — yalnız çağrılır.

   Body: { campaignId, changeType: 'status'|'budget', newValue }
   ────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server'
import { requireOptimizationAccess } from '@/lib/meta/optimization/serverGuard'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { updateCampaignStatus, updateCampaignBudget } from '@/lib/google-ads/campaigns'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: Request) {
  try {
    // Subscription gate (Meta ile aynı kapı)
    const gate = await requireOptimizationAccess()
    if (!gate.ok) return gate.response

    const body = await request.json()
    const { campaignId, changeType, newValue } = body as {
      campaignId: string
      changeType: 'status' | 'budget'
      newValue: string | number
    }

    if (!campaignId || (changeType !== 'status' && changeType !== 'budget')) {
      return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
    }

    const ctx = await getGoogleAdsContext()

    if (changeType === 'status') {
      const status = newValue === 'PAUSED' ? 'PAUSED' : 'ENABLED'
      const resourceName = `customers/${ctx.customerId}/campaigns/${campaignId}`
      await updateCampaignStatus(ctx, resourceName, status)
      return NextResponse.json({ ok: true, applied: { campaignId, changeType, newValue: status } })
    }

    // budget
    const amount = Number(newValue)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'invalid_budget', message: 'Geçersiz bütçe' }, { status: 400 })
    }
    // Kampanyanın bütçe resourceName'ini çöz (mutate için gerekli)
    const rows = await searchGAds<{ campaign?: { campaignBudget?: string } }>(
      ctx,
      `SELECT campaign.campaign_budget FROM campaign WHERE campaign.id = ${Number(campaignId)}`,
    )
    const budgetResourceName = rows?.[0]?.campaign?.campaignBudget
    if (!budgetResourceName) {
      return NextResponse.json({ ok: false, error: 'budget_not_found', message: 'Kampanya bütçesi bulunamadı' }, { status: 404 })
    }
    await updateCampaignBudget(ctx, budgetResourceName, Math.round(amount * 1_000_000))
    return NextResponse.json({ ok: true, applied: { campaignId, changeType, newValue: amount } })
  } catch (error) {
    console.error('[Google Apply] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'apply_failed', message: error instanceof Error ? error.message : 'Uygulama başarısız' },
      { status: 500 },
    )
  }
}
