import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  searchGoogleTransparencyAds,
  isGoogleTransparencyEnabled,
} from '@/lib/yoai/googleTransparencyConnector'
import {
  runGoogleApifyTransparencyScan,
  isApifyEnabled,
} from '@/lib/yoai/apifyCompetitorProvider'
import {
  upsertCompetitorAds,
  buildCompetitorAdFingerprint,
} from '@/lib/yoai/competitorAdStore'
import {
  generateCompetitorInsightFromAds,
  upsertCompetitorInsight,
} from '@/lib/yoai/competitorInsightStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/competitors/google-auction
   Google Ads Transparency Center araması.

   GOOGLE_ADS_TRANSPARENCY_PROVIDER=apify → Apify actor.
   GOOGLE_ADS_TRANSPARENCY_PROVIDER=serpapi (default) → SerpApi.

   Query params:
     keyword           — arama terimi
     advertiserDomain  — reklamveren domain
     region            — ülke kodu (default: TR)
     campaignTypeContext — kampanya tipi bağlamı

   Key/token yoksa: { ok:true, supported:false, reason:'..._missing' }
   Sahte veri üretilmez. Google Ads API kullanılmaz.
   ──────────────────────────────────────────────────────────── */

function getGoogleProvider(): string {
  return (
    process.env.GOOGLE_ADS_TRANSPARENCY_PROVIDER ||
    process.env.COMPETITOR_ADS_PROVIDER ||
    'serpapi'
  ).toLowerCase()
}

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('session_id')?.value

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const keyword = url.searchParams.get('keyword') ?? undefined
  const advertiserDomain = url.searchParams.get('advertiserDomain') ?? undefined
  const region = url.searchParams.get('region') ?? 'TR'
  const campaignTypeContext = url.searchParams.get('campaignTypeContext') ?? null

  const query = keyword || advertiserDomain || ''
  const provider = getGoogleProvider()

  // ── Apify path ──
  if (provider === 'apify') {
    if (!isApifyEnabled()) {
      return NextResponse.json({
        ok: true,
        supported: false,
        reason: 'APIFY_API_TOKEN_missing',
        provider: 'apify',
        data: { ads: [], inserted: 0, updated: 0, skipped: 0, insightId: null },
      })
    }

    if (!query) {
      return NextResponse.json({
        ok: true,
        supported: true,
        reason: 'no_query',
        provider: 'apify',
        data: { ads: [], inserted: 0, updated: 0, skipped: 0, insightId: null },
      })
    }

    try {
      const scanResult = await runGoogleApifyTransparencyScan({
        query,
        region,
        campaignTypeContext,
      })

      if (!scanResult.supported) {
        return NextResponse.json({
          ok: true,
          supported: false,
          reason: scanResult.reason,
          provider: 'apify',
          actorId: scanResult.actorId,
          error: scanResult.error,
          data: { ads: [], inserted: 0, updated: 0, skipped: 0, insightId: null },
        })
      }

      if (scanResult.ads.length === 0) {
        return NextResponse.json({
          ok: true,
          supported: true,
          reason: scanResult.reason ?? 'empty_result',
          provider: 'apify',
          actorId: scanResult.actorId,
          data: {
            ads: [],
            inserted: 0,
            updated: 0,
            skipped: 0,
            insightId: null,
            rawCount: scanResult.rawCount,
          },
        })
      }

      const withFingerprints = scanResult.ads.map((ad) => ({
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
        source: 'apify_google_ads_transparency',
        campaign_type_context: campaignTypeContext,
        query_keyword: query,
      })
      const insightRow =
        snapshot.ads_count > 0 ? await upsertCompetitorInsight(userId, snapshot) : null

      return NextResponse.json({
        ok: true,
        supported: true,
        provider: 'apify',
        actorId: scanResult.actorId,
        data: {
          ads: withFingerprints,
          inserted: upsertResult.inserted,
          updated: upsertResult.updated,
          skipped: upsertResult.skipped,
          insightId: insightRow?.id ?? null,
          rawCount: scanResult.rawCount,
          normalizedCount: scanResult.normalizedCount,
          usefulCount: scanResult.usefulCount,
        },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[google-auction/apify] error:', msg)
      return NextResponse.json({ ok: false, error: msg }, { status: 500 })
    }
  }

  // ── SerpApi fallback path ──
  if (!isGoogleTransparencyEnabled()) {
    return NextResponse.json({
      ok: true,
      supported: false,
      reason: 'SERPAPI_API_KEY_missing',
      provider: 'serpapi',
      data: { ads: [], inserted: 0, updated: 0, skipped: 0, insightId: null },
    })
  }

  if (!query) {
    return NextResponse.json({
      ok: true,
      supported: true,
      reason: 'no_query',
      provider: 'serpapi',
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
        provider: 'serpapi',
        error: result.error,
        data: { ads: [], inserted: 0, updated: 0, skipped: 0, insightId: null },
      })
    }

    if (result.ads.length === 0) {
      return NextResponse.json({
        ok: true,
        supported: true,
        provider: 'serpapi',
        data: { ads: [], inserted: 0, updated: 0, skipped: 0, insightId: null },
      })
    }

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
      provider: 'serpapi',
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
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
