/* ──────────────────────────────────────────────────────────
   POST /api/google/optimization/magic-scan

   Optimizasyon — Google kanadı (Faz 1). Bir Google kampanyasının
   sorunlarından öneri üretir (deterministik şablon + opsiyonel Claude).
   AI istenirse Meta ile AYNI sunucu-otoriter günlük scan kotasını tüketir
   (consume_ai_scan). Faz 1: yalnız advisory öneriler (canlı apply Faz 2).

   Meta tarafı (/api/meta/optimization/magic-scan) ETKİLENMEZ.
   ────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server'
import { requireOptimizationAccess } from '@/lib/meta/optimization/serverGuard'
import { isAnthropicReady } from '@/lib/anthropic/client'
import { consumeAiScan } from '@/lib/billing/aiScanUsage'
import { getCreditBalance } from '@/lib/billing/db'
import { getPlanById } from '@/lib/subscription/helpers'
import { COST_PER_AI_SCAN } from '@/lib/subscription/types'
import { generateGoogleRecommendations, type GoogleScanCampaign } from '@/lib/google/optimization/recommender'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const gate = await requireOptimizationAccess()
    if (!gate.ok) return gate.response

    const body = await request.json()
    const { campaign, locale = 'tr', useAI = false } = body as {
      campaign: GoogleScanCampaign
      locale: string
      useAI: boolean
    }

    if (!campaign?.id || !campaign?.metrics) {
      return NextResponse.json(
        { ok: false, error: 'invalid_payload', message: 'Kampanya verisi gerekli' },
        { status: 400 },
      )
    }

    // Sunucu-otoriter günlük AI scan kotası (Meta ile aynı kapı + aynı sayaç).
    if (useAI && isAnthropicReady()) {
      const plan = getPlanById(gate.subscription.planId)
      const dailyLimit = plan?.aiScanDailyLimit ?? 0
      await getCreditBalance(gate.user.id)
      const consume = await consumeAiScan(gate.user.id, dailyLimit, COST_PER_AI_SCAN)
      if (!consume.allowed) {
        return NextResponse.json(
          {
            ok: false,
            error: 'ai_scan_limit',
            code: 'AI_SCAN_LIMIT',
            message: 'Günlük AI tarama limitiniz doldu ve yeterli krediniz yok.',
            balance: consume.balance,
          },
          { status: 402 },
        )
      }
    }

    const { recommendations, aiGenerated } = await generateGoogleRecommendations(
      campaign,
      locale,
      Boolean(useAI),
    )
    const aiFallbackUsed = Boolean(useAI) && !aiGenerated

    return NextResponse.json({
      ok: true,
      data: {
        campaignId: campaign.id,
        campaignName: campaign.name,
        currency: campaign.currency || 'TRY',
        timestamp: Date.now(),
        problemTags: campaign.problemTags ?? [],
        recommendations,
        aiGenerated,
        aiRequested: Boolean(useAI),
        aiFallbackUsed,
      },
    })
  } catch (error) {
    console.error('[Google Magic Scan] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
