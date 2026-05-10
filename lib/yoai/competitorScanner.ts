/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Competitor Scanner (Faz 2B)

   Meta ve Google rakip reklam taraması için unified helper.
   Meta: Meta Ad Library API (mevcut route/helper'ı kullanır).
   Google: Google Ads Transparency via SerpApi connector.

   Sahte veri üretilmez. SerpApi key yoksa Google scan skip.
   ────────────────────────────────────────────────────────── */

import {
  searchGoogleTransparencyAds,
  isGoogleTransparencyEnabled,
} from './googleTransparencyConnector'
import {
  upsertCompetitorAds,
  buildCompetitorAdFingerprint,
  type NormalizedCompetitorAd,
} from './competitorAdStore'
import {
  generateCompetitorInsightFromAds,
  upsertCompetitorInsight,
} from './competitorInsightStore'

/* ── Types ── */

export interface CampaignBasic {
  platform?: string
  name?: string
  objective?: string
  status?: string
  keywords?: string[]
  domains?: string[]
  campaignType?: string
}

export interface CompetitorScanParams {
  keyword?: string
  advertiserDomain?: string
  campaignTypeContext?: string | null
  region?: string
}

export interface CompetitorScanResult {
  platform: 'meta' | 'google'
  supported: boolean
  reason?: string
  inserted: number
  updated: number
  skipped: number
  insightId: string | null
  adCount: number
  error?: string
}

export interface RunCompetitorScanResult {
  meta: CompetitorScanResult | null
  google: CompetitorScanResult | null
}

/* ── Query derivation ── */

/**
 * Kampanya listesinden rakip arama sorgularını çıkarır.
 * keyword/domain/sektör — LLM çağrısı YAPMAZ.
 */
export function deriveCompetitorQueriesFromCampaigns(
  campaigns: CampaignBasic[],
): CompetitorScanParams[] {
  const seen = new Set<string>()
  const params: CompetitorScanParams[] = []

  for (const c of campaigns) {
    // Explicitly provided keywords
    if (Array.isArray(c.keywords)) {
      for (const kw of c.keywords) {
        const k = kw?.trim()
        if (k && !seen.has(k)) {
          seen.add(k)
          params.push({ keyword: k, campaignTypeContext: c.campaignType ?? null })
        }
        if (params.length >= 5) break
      }
    }
    // Domains from campaign
    if (Array.isArray(c.domains)) {
      for (const d of c.domains) {
        const domain = d?.trim()
        if (domain && !seen.has(domain)) {
          seen.add(domain)
          params.push({ advertiserDomain: domain, campaignTypeContext: c.campaignType ?? null })
        }
      }
    }
    // Derive from name if nothing else
    if (c.name && params.length === 0) {
      const nameParts = c.name
        .split(/[\s\-_|]+/)
        .map((p) => p.trim().toLowerCase())
        .filter((p) => p.length > 3)
        .slice(0, 2)
      for (const part of nameParts) {
        if (!seen.has(part)) {
          seen.add(part)
          params.push({ keyword: part, campaignTypeContext: c.campaignType ?? null })
        }
      }
    }

    if (params.length >= 5) break
  }

  return params.slice(0, 5)
}

/* ── Meta competitor scan ── */

/**
 * Meta Ad Library üzerinden rakip reklamları tarar ve persist eder.
 * metaAccessToken gereklidir; yoksa supported:false döner.
 * Sahte veri üretilmez.
 */
export async function runMetaCompetitorScanForUser(
  userId: string,
  params: CompetitorScanParams & { metaAccessToken: string },
): Promise<CompetitorScanResult> {
  if (!params.metaAccessToken) {
    return {
      platform: 'meta',
      supported: false,
      reason: 'meta_access_token_missing',
      inserted: 0,
      updated: 0,
      skipped: 0,
      insightId: null,
      adCount: 0,
    }
  }

  const query = params.keyword || params.advertiserDomain
  if (!query) {
    return {
      platform: 'meta',
      supported: true,
      reason: 'no_query',
      inserted: 0,
      updated: 0,
      skipped: 0,
      insightId: null,
      adCount: 0,
    }
  }

  try {
    const urlParams = new URLSearchParams({
      access_token: params.metaAccessToken,
      search_terms: query,
      ad_reached_countries: `["${params.region ?? 'TR'}"]`,
      ad_active_status: 'ACTIVE',
      fields:
        'id,page_name,page_id,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_descriptions,ad_delivery_start_time,ad_delivery_stop_time,publisher_platforms',
      limit: '25',
    })

    const res = await fetch(
      `https://graph.facebook.com/v21.0/ads_archive?${urlParams.toString()}`,
      { signal: AbortSignal.timeout(20_000) },
    )
    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown')
      return {
        platform: 'meta',
        supported: true,
        inserted: 0,
        updated: 0,
        skipped: 0,
        insightId: null,
        adCount: 0,
        error: `Meta API HTTP ${res.status}: ${errText.slice(0, 200)}`,
      }
    }

    const json = await res.json()
    const rawAds: Record<string, unknown>[] = Array.isArray(json.data) ? json.data : []

    if (rawAds.length === 0) {
      return {
        platform: 'meta',
        supported: true,
        inserted: 0,
        updated: 0,
        skipped: 0,
        insightId: null,
        adCount: 0,
      }
    }

    const normalized: NormalizedCompetitorAd[] = rawAds.map((raw) => {
      const bodies = Array.isArray(raw.ad_creative_bodies) ? raw.ad_creative_bodies : []
      const titles = Array.isArray(raw.ad_creative_link_titles) ? raw.ad_creative_link_titles : []
      const descs = Array.isArray(raw.ad_creative_link_descriptions)
        ? raw.ad_creative_link_descriptions
        : []
      const adBody = (bodies[0] as string | null) ?? null
      const adTitle = (titles[0] as string | null) ?? null
      const adDesc = (descs[0] as string | null) ?? null
      const fingerprint = buildCompetitorAdFingerprint({
        source: 'meta_ad_library',
        source_ad_id: typeof raw.id === 'string' ? raw.id : null,
        advertiser_page_name: typeof raw.page_name === 'string' ? raw.page_name : null,
        ad_body: adBody,
        ad_title: adTitle,
        ad_description: adDesc,
      })
      return {
        platform: 'meta',
        source: 'meta_ad_library',
        source_ad_id: typeof raw.id === 'string' ? raw.id : null,
        source_page_id: typeof raw.page_id === 'string' ? raw.page_id : null,
        ad_fingerprint: fingerprint,
        advertiser_name: typeof raw.page_name === 'string' ? raw.page_name : null,
        advertiser_page_name: typeof raw.page_name === 'string' ? raw.page_name : null,
        advertiser_domain: null,
        query_keyword: query,
        industry_keyword: query,
        campaign_type_context: params.campaignTypeContext ?? null,
        ad_body: adBody,
        ad_title: adTitle,
        ad_description: adDesc,
        call_to_action: null,
        destination_url: null,
        publisher_platforms: Array.isArray(raw.publisher_platforms)
          ? (raw.publisher_platforms as string[])
          : [],
        ad_delivery_start_time:
          typeof raw.ad_delivery_start_time === 'string' ? raw.ad_delivery_start_time : null,
        ad_delivery_stop_time:
          typeof raw.ad_delivery_stop_time === 'string' ? raw.ad_delivery_stop_time : null,
        creative_assets: [],
        raw_payload: raw,
        extracted_signals: {},
        is_active: true,
      }
    })

    const upsertResult = await upsertCompetitorAds(userId, normalized)
    const snapshot = generateCompetitorInsightFromAds(normalized, {
      platform: 'meta',
      source: 'meta_ad_library',
      campaign_type_context: params.campaignTypeContext ?? null,
      query_keyword: query,
    })
    const insightRow =
      snapshot.ads_count > 0 ? await upsertCompetitorInsight(userId, snapshot) : null

    return {
      platform: 'meta',
      supported: true,
      inserted: upsertResult.inserted,
      updated: upsertResult.updated,
      skipped: upsertResult.skipped,
      insightId: insightRow?.id ?? null,
      adCount: normalized.length,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[CompetitorScanner][Meta] error:', msg)
    return {
      platform: 'meta',
      supported: true,
      inserted: 0,
      updated: 0,
      skipped: 0,
      insightId: null,
      adCount: 0,
      error: msg,
    }
  }
}

/* ── Google competitor scan ── */

/**
 * Google Ads Transparency Center (SerpApi) üzerinden rakip reklamları tarar.
 * SERPAPI_API_KEY yoksa supported:false döner — sahte veri yok.
 */
export async function runGoogleCompetitorScanForUser(
  userId: string,
  params: CompetitorScanParams,
): Promise<CompetitorScanResult> {
  if (!isGoogleTransparencyEnabled()) {
    console.log('[CompetitorScanner][Google] SerpApi key yok — Google Transparency tarama atlandı.')
    return {
      platform: 'google',
      supported: false,
      reason: 'SERPAPI_API_KEY_missing',
      inserted: 0,
      updated: 0,
      skipped: 0,
      insightId: null,
      adCount: 0,
    }
  }

  try {
    const result = await searchGoogleTransparencyAds({
      keyword: params.keyword,
      advertiserDomain: params.advertiserDomain,
      region: params.region ?? 'TR',
      campaignTypeContext: params.campaignTypeContext,
    })

    if (!result.supported) {
      return {
        platform: 'google',
        supported: false,
        reason: result.reason,
        inserted: 0,
        updated: 0,
        skipped: 0,
        insightId: null,
        adCount: 0,
        error: result.error,
      }
    }

    if (result.ads.length === 0) {
      return {
        platform: 'google',
        supported: true,
        inserted: 0,
        updated: 0,
        skipped: 0,
        insightId: null,
        adCount: 0,
      }
    }

    // fingerprint eksikse tamamla
    const query = params.keyword || params.advertiserDomain || ''
    const withFingerprints: NormalizedCompetitorAd[] = result.ads.map((ad) => ({
      ...ad,
      query_keyword: ad.query_keyword ?? query,
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
      campaign_type_context: params.campaignTypeContext ?? null,
      query_keyword: query,
    })
    const insightRow =
      snapshot.ads_count > 0 ? await upsertCompetitorInsight(userId, snapshot) : null

    return {
      platform: 'google',
      supported: true,
      inserted: upsertResult.inserted,
      updated: upsertResult.updated,
      skipped: upsertResult.skipped,
      insightId: insightRow?.id ?? null,
      adCount: withFingerprints.length,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[CompetitorScanner][Google] error:', msg)
    return {
      platform: 'google',
      supported: true,
      inserted: 0,
      updated: 0,
      skipped: 0,
      insightId: null,
      adCount: 0,
      error: msg,
    }
  }
}

/* ── Unified scan ── */

/**
 * Meta + Google rakip taramasını birlikte çalıştırır.
 * metaAccessToken opsiyonel — yoksa Meta scan atlanır.
 * SerpApi key yoksa Google scan atlanır.
 * Her iki platform da soft-fail: hata olsa diğeri çalışır.
 */
export async function runCompetitorScanForUser(
  userId: string,
  params: CompetitorScanParams & { metaAccessToken?: string },
): Promise<RunCompetitorScanResult> {
  const [metaResult, googleResult] = await Promise.allSettled([
    params.metaAccessToken
      ? runMetaCompetitorScanForUser(userId, {
          ...params,
          metaAccessToken: params.metaAccessToken,
        })
      : Promise.resolve(null),
    runGoogleCompetitorScanForUser(userId, params),
  ])

  return {
    meta:
      metaResult.status === 'fulfilled' && metaResult.value !== null
        ? metaResult.value
        : metaResult.status === 'rejected'
          ? {
              platform: 'meta',
              supported: false,
              reason: 'exception',
              inserted: 0,
              updated: 0,
              skipped: 0,
              insightId: null,
              adCount: 0,
              error: String(metaResult.reason),
            }
          : null,
    google:
      googleResult.status === 'fulfilled'
        ? googleResult.value
        : {
            platform: 'google',
            supported: false,
            reason: 'exception',
            inserted: 0,
            updated: 0,
            skipped: 0,
            insightId: null,
            adCount: 0,
            error: String(googleResult.reason),
          },
  }
}
