import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveMetaContext } from '@/lib/meta/context'
import {
  normalizeMetaAdLibraryAd,
  upsertCompetitorAds,
  buildCompetitorAdFingerprint,
  type NormalizedCompetitorAd,
} from '@/lib/yoai/competitorAdStore'
import {
  runMetaApifyAdLibraryScan,
  isApifyEnabled,
} from '@/lib/yoai/apifyCompetitorProvider'
import {
  generateCompetitorInsightFromAds,
  upsertCompetitorInsight,
} from '@/lib/yoai/competitorInsightStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/competitors/meta-ad-library?q=keyword&country=TR
   Meta rakip reklam araması.

   META_AD_LIBRARY_PROVIDER=apify → Apify actor (token gerekmez).
   META_AD_LIBRARY_PROVIDER=official (default) → Meta Graph API.

   Faz 2C: Apify path eklendi; mevcut camelCase response shape
   geriye dönük uyumlu olarak korundu.
   ──────────────────────────────────────────────────────────── */

function getMetaProvider(): string {
  return (
    process.env.META_AD_LIBRARY_PROVIDER ||
    process.env.COMPETITOR_ADS_PROVIDER ||
    'official'
  ).toLowerCase()
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const country = searchParams.get('country') || 'TR'
    const campaignTypeContext = searchParams.get('campaign_type_context')
    // Diagnostic context — caller (scanner) can pass these to surface in response
    const querySource = searchParams.get('query_source') ?? undefined
    const queryPlanConfidence = searchParams.get('query_plan_confidence')
      ? Number(searchParams.get('query_plan_confidence'))
      : undefined
    const queryPlanReason = searchParams.get('query_plan_reason') ?? undefined

    if (!query) {
      return NextResponse.json({
        ok: false,
        error: 'Arama sorgusu (q) gereklidir',
        diagnostic: { noResultReason: 'query_plan_üretilemedi_veya_query_yok', platform: 'meta' },
      }, { status: 400 })
    }

    const diagnostic = {
      usedQuery: query,
      platform: 'meta' as const,
      querySource: querySource ?? 'manual',
      ...(queryPlanConfidence !== undefined ? { queryPlanConfidence } : {}),
      ...(queryPlanReason ? { queryPlanReason } : {}),
    }

    const provider = getMetaProvider()

    // ── Apify path ──
    if (provider === 'apify') {
      if (!isApifyEnabled()) {
        return NextResponse.json({
          ok: true,
          supported: false,
          reason: 'APIFY_API_TOKEN_missing',
          provider: 'apify',
          data: [],
          diagnostic: { ...diagnostic, noResultReason: 'platform_auth_env_eksik' },
        })
      }

      try {
        const cookieStore = await cookies()
        const userId = cookieStore.get('user_id')?.value

        const scanResult = await runMetaApifyAdLibraryScan({
          query,
          country,
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
            data: [],
            diagnostic: { ...diagnostic, noResultReason: 'platform_auth_env_eksik' },
          })
        }

        // Actor henüz tamamlanmadı — controlled pending response (error değil).
        if (scanResult.isPending) {
          return NextResponse.json({
            ok: true,
            supported: true,
            isPending: true,
            runStatus: scanResult.runStatus,
            reason: scanResult.reason,
            provider: 'apify',
            actorId: scanResult.actorId,
            runId: scanResult.runId,
            data: [],
            diagnostic: { ...diagnostic, noResultReason: 'actor_api_hata_verdi' },
          })
        }

        // Actor FAILED — diagnostic bilgileri dön, sahte veri yok.
        if (scanResult.reason === 'actor_failed') {
          return NextResponse.json({
            ok: true,
            supported: true,
            reason: 'actor_failed',
            runStatus: scanResult.runStatus,
            provider: 'apify',
            actorId: scanResult.actorId,
            runId: scanResult.runId,
            datasetId: scanResult.datasetId,
            error: scanResult.error,
            statusMessage: scanResult.statusMessage,
            exitCode: scanResult.exitCode,
            durationMillis: scanResult.durationMillis,
            data: [],
            diagnostic: { ...diagnostic, noResultReason: 'actor_api_hata_verdi' },
          })
        }

        // Geriye dönük uyumlu camelCase shape
        const ads = scanResult.ads.map((ad) => ({
          id: ad.source_ad_id ?? undefined,
          pageName: ad.advertiser_page_name ?? '',
          pageId: ad.source_page_id ?? '',
          adCreativeBody: ad.ad_body ?? '',
          adCreativeLinkTitle: ad.ad_title ?? '',
          adCreativeDescription: ad.ad_description ?? '',
          adStartDate: ad.ad_delivery_start_time ?? '',
          adEndDate: ad.ad_delivery_stop_time ?? '',
          platforms: ad.publisher_platforms ?? [],
          isActive: ad.is_active,
        }))

        let persisted: {
          inserted: number
          updated: number
          skipped: number
          insightId: string | null
          insightError?: string
          errors: string[]
          rawCount: number
          normalizedCount: number
          usefulCount: number
        } | null = null

        if (userId && scanResult.ads.length > 0) {
          const withFingerprints: NormalizedCompetitorAd[] = scanResult.ads.map((ad) => ({
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

          let insightRow: { id: string } | null = null
          let insightError: string | null = null
          try {
            const snapshot = generateCompetitorInsightFromAds(withFingerprints, {
              platform: 'meta',
              source: 'apify_meta_ad_library',
              campaign_type_context: campaignTypeContext,
              query_keyword: query,
            })
            if (snapshot.ads_count > 0) {
              insightRow = await upsertCompetitorInsight(userId, snapshot)
            }
          } catch (err) {
            insightError = err instanceof Error ? err.message : String(err)
            console.warn('[Meta Ad Library/Apify] insight store error:', insightError)
          }
          if (insightRow === null && !insightError) {
            insightError = 'competitor_insight_store_returned_null'
            console.warn('[Meta Ad Library/Apify] upsertCompetitorInsight returned null without error')
          }

          persisted = {
            inserted: upsertResult.inserted,
            updated: upsertResult.updated,
            skipped: upsertResult.skipped,
            insightId: insightRow?.id ?? null,
            ...(insightError ? { insightError } : {}),
            errors: upsertResult.errors,
            rawCount: scanResult.rawCount,
            normalizedCount: scanResult.normalizedCount,
            usefulCount: scanResult.usefulCount,
          }
        }

        const noResultReason = ads.length === 0 ? 'query_üretildi_sonuç_yok' : undefined
        const usefulCount = persisted?.usefulCount ?? (ads.length > 0 ? ads.length : 0)
        const finalNoResultReason = noResultReason ?? (usefulCount === 0 && ads.length > 0 ? 'rakip_verisi_usefulCount_sıfır' : noResultReason)

        return NextResponse.json({
          ok: true,
          supported: true,
          provider: 'apify',
          actorId: scanResult.actorId,
          data: ads,
          ...(persisted ? { persisted } : {}),
          diagnostic: {
            ...diagnostic,
            rawCount: scanResult.rawCount,
            usefulCount,
            ...(finalNoResultReason ? { noResultReason: finalNoResultReason } : {}),
          },
        })
      } catch (apifyErr) {
        console.warn('[Meta Ad Library/Apify] error:', apifyErr)
        return NextResponse.json(
          {
            ok: false,
            error: apifyErr instanceof Error ? apifyErr.message : 'Apify scan hatası',
          },
          { status: 500 },
        )
      }
    }

    // ── Meta Graph API path (official) ──
    const ctx = await resolveMetaContext()
    if (!ctx) {
      return NextResponse.json({ ok: false, error: 'Meta bağlantısı bulunamadı' }, { status: 401 })
    }

    const params = new URLSearchParams({
      access_token: ctx.userAccessToken,
      search_terms: query,
      ad_reached_countries: `["${country}"]`,
      ad_active_status: 'ACTIVE',
      fields:
        'id,page_name,page_id,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_descriptions,ad_delivery_start_time,ad_delivery_stop_time,publisher_platforms',
      limit: '25',
    })

    const res = await fetch(`https://graph.facebook.com/v21.0/ads_archive?${params.toString()}`)

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      console.error('[Meta Ad Library] Error:', res.status, errorData)
      return NextResponse.json(
        {
          ok: false,
          error:
            (errorData as { error?: { message?: string } })?.error?.message ||
            `Meta Ad Library API hatası (${res.status})`,
        },
        { status: res.status === 401 ? 401 : 502 },
      )
    }

    const data = await res.json()
    const rawAds: Record<string, unknown>[] = Array.isArray(data?.data) ? data.data : []

    // Mevcut UI ile aynı camelCase shape — geriye dönük uyumlu.
    const ads = rawAds.map((ad) => ({
      id: ad.id,
      pageName: (ad as { page_name?: string }).page_name || '',
      pageId: (ad as { page_id?: string }).page_id || '',
      adCreativeBody:
        (ad as { ad_creative_bodies?: string[] }).ad_creative_bodies?.[0] || '',
      adCreativeLinkTitle:
        (ad as { ad_creative_link_titles?: string[] }).ad_creative_link_titles?.[0] || '',
      adCreativeDescription:
        (ad as { ad_creative_link_descriptions?: string[] }).ad_creative_link_descriptions?.[0] || '',
      adStartDate:
        (ad as { ad_delivery_start_time?: string }).ad_delivery_start_time || '',
      adEndDate: (ad as { ad_delivery_stop_time?: string }).ad_delivery_stop_time || '',
      platforms: (ad as { publisher_platforms?: string[] }).publisher_platforms || [],
      isActive: !(ad as { ad_delivery_stop_time?: string }).ad_delivery_stop_time,
    }))

    // ── Best-effort persistence ──
    let persisted: {
      inserted: number
      updated: number
      skipped: number
      insightId: string | null
      insightError?: string
      errors: string[]
    } | null = null

    try {
      const cookieStore = await cookies()
      const userId = cookieStore.get('user_id')?.value
      if (userId && rawAds.length > 0) {
        const adContext = {
          platform: 'meta',
          source: 'meta_ad_library',
          query_keyword: query,
          campaign_type_context: campaignTypeContext,
        }
        const normalized: NormalizedCompetitorAd[] = rawAds.map((raw) =>
          normalizeMetaAdLibraryAd(raw, adContext),
        )
        const upsertResult = await upsertCompetitorAds(userId, normalized)

        let insightRow: { id: string } | null = null
        let insightError: string | null = null
        try {
          const snapshot = generateCompetitorInsightFromAds(normalized, {
            platform: 'meta',
            source: 'meta_ad_library',
            campaign_type_context: campaignTypeContext,
            query_keyword: query,
          })
          if (snapshot.ads_count > 0) {
            insightRow = await upsertCompetitorInsight(userId, snapshot)
          }
        } catch (err) {
          insightError = err instanceof Error ? err.message : String(err)
          console.warn('[Meta Ad Library] insight store error:', insightError)
        }
        if (insightRow === null && !insightError) {
          insightError = 'competitor_insight_store_returned_null'
          console.warn('[Meta Ad Library] upsertCompetitorInsight returned null without error')
        }

        persisted = {
          inserted: upsertResult.inserted,
          updated: upsertResult.updated,
          skipped: upsertResult.skipped,
          insightId: insightRow?.id ?? null,
          ...(insightError ? { insightError } : {}),
          errors: upsertResult.errors,
        }
      }
    } catch (persistErr) {
      console.warn('[Meta Ad Library] persistence failed (non-fatal):', persistErr)
    }

    const officialNoResultReason = ads.length === 0 ? 'query_üretildi_sonuç_yok' : undefined
    return NextResponse.json({
      ok: true,
      provider: 'official',
      data: ads,
      ...(persisted ? { persisted } : {}),
      diagnostic: {
        ...diagnostic,
        rawCount: rawAds.length,
        usefulCount: ads.length,
        ...(officialNoResultReason ? { noResultReason: officialNoResultReason } : {}),
      },
    })
  } catch (error) {
    console.error('[Meta Ad Library] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
