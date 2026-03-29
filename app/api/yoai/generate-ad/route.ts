import { NextResponse } from 'next/server'
import { generateAdProposals, type AdCreationContext } from '@/lib/yoai/adCreator'
import { fetchMetaDeep } from '@/lib/yoai/metaDeepFetcher'
import { fetchGoogleDeep } from '@/lib/yoai/googleDeepFetcher'
import type { Platform } from '@/lib/yoai/analysisTypes'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/generate-ad
   Generates AI ad proposals based on existing campaign data.
   Does NOT create the ad — just proposes.
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { platform, campaignId } = body as { platform: Platform; campaignId?: string }

    if (!platform || !['Meta', 'Google'].includes(platform)) {
      return NextResponse.json({ ok: false, error: 'Platform gerekli (Meta veya Google)' }, { status: 400 })
    }

    // Fetch campaign data for context
    const [metaResult, googleResult] = await Promise.all([
      platform === 'Meta' ? fetchMetaDeep().catch(() => ({ campaigns: [], errors: [] })) : Promise.resolve({ campaigns: [], errors: [] }),
      platform === 'Google' ? fetchGoogleDeep().catch(() => ({ campaigns: [], errors: [] })) : Promise.resolve({ campaigns: [], errors: [] }),
    ])

    const allCampaigns = [...metaResult.campaigns, ...googleResult.campaigns]

    if (allCampaigns.length === 0) {
      return NextResponse.json({ ok: false, error: 'Analiz edilecek kampanya bulunamadı' }, { status: 404 })
    }

    const context: AdCreationContext = {
      platform,
      campaignId,
      campaigns: allCampaigns,
      objective: campaignId ? allCampaigns.find(c => c.id === campaignId)?.objective : undefined,
    }

    const result = await generateAdProposals(context)

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    console.error('[Generate Ad] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
