import { NextResponse } from 'next/server'
import { generateAdProposals, type AdCreationContext } from '@/lib/yoai/adCreator'
import { fetchMetaDeep } from '@/lib/yoai/metaDeepFetcher'
import { fetchGoogleDeep } from '@/lib/yoai/googleDeepFetcher'
import { fetchGoogleCompetitors, extractKeywordsFromCampaigns } from '@/lib/yoai/competitorAnalyzer'
import type { Platform } from '@/lib/yoai/analysisTypes'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/generate-ad
   Generates AI ad proposals based on campaign + competitor data.
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { platform, campaignId } = body as { platform: Platform; campaignId?: string }

    if (!platform || !['Meta', 'Google'].includes(platform)) {
      return NextResponse.json({ ok: false, error: 'Platform gerekli (Meta veya Google)' }, { status: 400 })
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // Fetch campaign data + competitor data in parallel
    const [metaResult, googleResult, googleCompetitors, metaAdLibrary] = await Promise.all([
      platform === 'Meta' ? fetchMetaDeep().catch(() => ({ campaigns: [], errors: [] })) : Promise.resolve({ campaigns: [], errors: [] }),
      platform === 'Google' ? fetchGoogleDeep().catch(() => ({ campaigns: [], errors: [] })) : Promise.resolve({ campaigns: [], errors: [] }),
      // Competitor data
      fetchGoogleCompetitors(cookieHeader, baseUrl).catch(() => ({ competitors: [], errors: [] })),
      // Meta Ad Library — auto keyword search
      (async () => {
        try {
          const allCampaigns = [...(await fetchMetaDeep().catch(() => ({ campaigns: [] }))).campaigns, ...(await fetchGoogleDeep().catch(() => ({ campaigns: [] }))).campaigns]
          const keywords = extractKeywordsFromCampaigns(allCampaigns)
          if (keywords.length === 0) return { ads: [] }
          const res = await fetch(`${baseUrl}/api/yoai/competitors/meta-ad-library?q=${encodeURIComponent(keywords.join(' '))}&country=TR`, {
            headers: { Cookie: cookieHeader },
          })
          const data = await res.json()
          return { ads: data.ok ? (data.data || []) : [] }
        } catch { return { ads: [] } }
      })(),
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
      competitors: {
        googleCompetitors: googleCompetitors.competitors.slice(0, 5).map(c => ({ domain: c.domain, impressionShare: c.impressionShare })),
        metaAds: metaAdLibrary.ads.slice(0, 5).map((a: any) => ({ pageName: a.pageName, adCreativeBody: a.adCreativeBody, adCreativeLinkTitle: a.adCreativeLinkTitle })),
      },
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
