import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  searchGoogleTransparencyAds,
  isGoogleTransparencyEnabled,
} from '@/lib/yoai/googleTransparencyConnector'
import {
  upsertCompetitorAds,
  buildCompetitorAdFingerprint,
} from '@/lib/yoai/competitorAdStore'
import {
  generateCompetitorInsightFromAds,
  upsertCompetitorInsight,
} from '@/lib/yoai/competitorInsightStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/competitors/google-auction
   Google Ads Transparency Center araması via SerpApi.

   Query params:
     keyword           — arama terimi
     advertiserDomain  — reklamveren domain
     region            — ülke kodu (default: TR)
     campaignTypeContext — kampanya tipi bağlamı

   SERPAPI_API_KEY yoksa: { ok:true, supported:false, reason:'SERPAPI_API_KEY_missing' }
   Sahte veri üretilmez.
   ──────────────────────────────────────────────────────────── */
export async function GET(request: Request) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('session_id')?.value

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  if (!isGoogleTransparencyEnabled()) {
    return NextResponse.json({
      ok: true,
      supported: false,
      reason: 'SERPAPI_API_KEY_missing',
      data: { ads: [], inserted: 0, updated: 0, skipped: 0, insightId: null },
    })
  }

  const url = new URL(request.url)
  const keyword = url.searchParams.get('keyword') ?? undefined
  const advertiserDomain = url.searchParams.get('advertiserDomain') ?? undefined
  const region = url.searchParams.get('region') ?? 'TR'
  const campaignTypeContext = url.searchParams.get('campaignTypeContext') ?? null

  if (!keyword && !advertiserDomain) {
    return NextResponse.json({
      ok: true,
      supported: true,
      reason: 'no_query',
      data: { ads: [], inserted: 0, updated: 0, skipped: 0, insightId: null },
    })
  }

  try {
    const result = await searchGoogleTransparencyAds({
      keyword,
      advertiserDomain,
      region,
      campaignTypeContext,
    })

    if (!result.supported) {
      return NextResponse.json({
        ok: true,
        supported: false,
        reason: result.reason,
        error: result.error,
        data: { ads: [], inserted: 0, updated: 0, skipped: 0, insightId: null },
      })
    }

    if (result.ads.length === 0) {
      return NextResponse.json({
        ok: true,
        supported: true,
        data: { ads: [], inserted: 0, updated: 0, skipped: 0, insightId: null },
      })
    }

    const query = keyword || advertiserDomain || ''

    // Fill missing fingerprints
    const withFingerprints = result.ads.map((ad) => ({
      ...ad,
      ad_fingerprint:
        ad.ad_fingerprint ||
        buildCompetitorAdFingerprint({
          source: ad.source,
          source_ad_id: ad.source_ad_id,
          advertiser_page_name: ad.advertiser_page_name,
          ad_body: ad.ad_body,
          ad_title: ad.ad_title,
          ad_description: ad.ad_description,
        }),
    }))

    const upsertResult = await upsertCompetitorAds(userId, withFingerprints)

    const snapshot = generateCompetitorInsightFromAds(withFingerprints, {
      platform: 'google',
      source: 'google_ads_transparency_serpapi',
      campaign_type_context: campaignTypeContext,
      query_keyword: query,
    })
    const insightRow =
      snapshot.ads_count > 0 ? await upsertCompetitorInsight(userId, snapshot) : null

    return NextResponse.json({
      ok: true,
      supported: true,
      data: {
        ads: withFingerprints,
        inserted: upsertResult.inserted,
        updated: upsertResult.updated,
        skipped: upsertResult.skipped,
        insightId: insightRow?.id ?? null,
        rawCount: result.rawCount,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[google-auction] error:', msg)
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 },
    )
  }
}
