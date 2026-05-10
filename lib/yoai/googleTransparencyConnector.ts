/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Google Ads Transparency Center Connector (Faz 2B)

   Provider: SerpApi Google Ads Transparency Center
   Env: SERPAPI_API_KEY

   Key yoksa:   supported:false döner — sahte veri yok.
   Hata olursa: unavailable döner   — sahte veri yok.
   Google Ads API rakip reklam için KULLANILMAZ.
   ────────────────────────────────────────────────────────── */

import type { NormalizedCompetitorAd } from './competitorAdStore'

const SERPAPI_BASE = 'https://serpapi.com/search'
const SOURCE_LABEL = 'google_ads_transparency_serpapi'

export interface GoogleTransparencySearchParams {
  advertiserDomain?: string
  advertiserName?: string
  keyword?: string
  region?: string
}

export interface GoogleTransparencyConnectorResult {
  supported: boolean
  reason?: string
  ads: NormalizedCompetitorAd[]
  rawCount: number
  error?: string
}

/** SERPAPI_API_KEY varsa true */
export function isGoogleTransparencyEnabled(): boolean {
  return !!process.env.SERPAPI_API_KEY
}

/** Sorgu string'ini bağlam girdilerinden oluşturur. */
export function buildGoogleTransparencyQuery({
  advertiserDomain,
  advertiserName,
  keyword,
}: Pick<GoogleTransparencySearchParams, 'advertiserDomain' | 'advertiserName' | 'keyword'>): string {
  if (advertiserDomain) return advertiserDomain
  if (advertiserName) return advertiserName
  return keyword ?? ''
}

/** Ham SerpApi satırını NormalizedCompetitorAd formatına dönüştürür. */
export function normalizeGoogleTransparencyAd(
  raw: Record<string, unknown>,
  context: { query_keyword?: string | null; campaign_type_context?: string | null },
): NormalizedCompetitorAd {
  const advertiser = (raw.advertiser as Record<string, unknown> | undefined) ?? {}
  const creativeInfo = (raw.creative_info as Record<string, unknown> | undefined) ?? {}
  const region = (raw.regions as string[] | undefined)?.[0] ?? null

  const adId =
    typeof raw.ad_id === 'string' ? raw.ad_id : typeof raw.id === 'string' ? raw.id : null

  const advertiserName =
    typeof advertiser.name === 'string'
      ? advertiser.name
      : typeof raw.advertiser_name === 'string'
        ? raw.advertiser_name
        : null

  const advertiserDomain =
    typeof advertiser.domain === 'string'
      ? advertiser.domain
      : typeof raw.advertiser_domain === 'string'
        ? raw.advertiser_domain
        : null

  const adBody =
    typeof creativeInfo.description === 'string'
      ? creativeInfo.description
      : typeof raw.description === 'string'
        ? raw.description
        : null

  const adTitle =
    typeof creativeInfo.headline === 'string'
      ? creativeInfo.headline
      : typeof raw.headline === 'string'
        ? raw.headline
        : null

  const destinationUrl =
    typeof creativeInfo.destination_url === 'string'
      ? creativeInfo.destination_url
      : typeof raw.destination_url === 'string'
        ? raw.destination_url
        : null

  const format = typeof raw.format === 'string' ? raw.format : null

  return {
    platform: 'google',
    source: SOURCE_LABEL,
    source_ad_id: adId,
    source_page_id: typeof advertiser.id === 'string' ? advertiser.id : null,
    ad_fingerprint: '', // competitorAdStore.upsertCompetitorAds üretir
    advertiser_name: advertiserName,
    advertiser_page_name: advertiserName,
    advertiser_domain: advertiserDomain,
    query_keyword: context.query_keyword ?? null,
    industry_keyword: context.query_keyword ?? null,
    campaign_type_context: context.campaign_type_context ?? null,
    ad_body: adBody,
    ad_title: adTitle,
    ad_description: null,
    call_to_action: null,
    destination_url: destinationUrl,
    publisher_platforms: ['google'],
    ad_delivery_start_time:
      typeof raw.start_date === 'string' ? raw.start_date : null,
    ad_delivery_stop_time:
      typeof raw.end_date === 'string' ? raw.end_date : null,
    creative_assets: [],
    raw_payload: raw,
    extracted_signals: {
      region,
      format,
    },
    is_active: true,
  }
}

/** NormalizedCompetitorAd alias (normalizeGoogleTransparencyAd ile aynı — ilerideki format split için tutuldu) */
export function mapGoogleTransparencyToCompetitorAd(
  raw: Record<string, unknown>,
  context: { query_keyword?: string | null; campaign_type_context?: string | null },
): NormalizedCompetitorAd {
  return normalizeGoogleTransparencyAd(raw, context)
}

/**
 * SerpApi Google Ads Transparency Center araması.
 * Key yoksa → supported:false.
 * Hata olursa → error dolu, ads boş.
 * Sahte veri üretilmez.
 */
export async function searchGoogleTransparencyAds(
  params: GoogleTransparencySearchParams & { campaignTypeContext?: string | null },
): Promise<GoogleTransparencyConnectorResult> {
  const apiKey = process.env.SERPAPI_API_KEY
  if (!apiKey) {
    return {
      supported: false,
      reason: 'SERPAPI_API_KEY_missing',
      ads: [],
      rawCount: 0,
    }
  }

  const query = buildGoogleTransparencyQuery(params)
  if (!query) {
    return {
      supported: true,
      reason: 'no_query',
      ads: [],
      rawCount: 0,
    }
  }

  try {
    const urlParams = new URLSearchParams({
      engine: 'google_ads_transparency_center',
      api_key: apiKey,
      q: query,
    })
    if (params.region) {
      urlParams.set('region', params.region)
    }

    const res = await fetch(`${SERPAPI_BASE}?${urlParams.toString()}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown')
      console.warn(
        `[GoogleTransparencyConnector] SerpApi HTTP ${res.status}: ${errText.slice(0, 200)}`,
      )
      return {
        supported: true,
        ads: [],
        rawCount: 0,
        error: `SerpApi HTTP ${res.status}`,
      }
    }

    const json = await res.json()
    const rawAds = Array.isArray(json.ads) ? json.ads : Array.isArray(json.results) ? json.results : []

    const context = {
      query_keyword: query,
      campaign_type_context: params.campaignTypeContext ?? null,
    }

    const normalized = (rawAds as Record<string, unknown>[]).map((raw) =>
      normalizeGoogleTransparencyAd(raw, context),
    )

    return {
      supported: true,
      ads: normalized,
      rawCount: rawAds.length,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[GoogleTransparencyConnector] fetch error:', msg)
    return {
      supported: true,
      ads: [],
      rawCount: 0,
      error: msg,
    }
  }
}
