/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Apify Competitor Provider (Faz 2C)

   Ana provider: Apify
   Meta Actor:   curious_coder/facebook-ads-library-scraper
   Google Actor: solidcode/ads-transparency-scraper

   APIFY_API_TOKEN yoksa: supported:false — sahte veri yok.
   Actor ID yoksa:        supported:false — sahte veri yok.
   Actor hata verirse:    error dolu, ads boş — sahte veri yok.
   Boş sonuç:            reason:'empty_result' — fake data yok.
   Google Ads API rakip reklam için KULLANILMAZ.
   Actor demo inputları hardcoded değil — backend dinamik üretir.
   ────────────────────────────────────────────────────────── */

import type { NormalizedCompetitorAd } from './competitorAdStore'

const APIFY_BASE = 'https://api.apify.com/v2'

/* ── Config / env types ── */

export interface ApifyConfig {
  apiToken: string
  metaActorId: string
  googleActorId: string
}

export interface ApifyRunOptions {
  waitForFinishSeconds?: number
  timeoutMs?: number
}

export interface ApifyActorRunResult {
  runId: string
  datasetId: string
  status: string
  error?: string
}

export interface ApifyQualityStats {
  rawCount: number
  normalizedCount: number
  usefulCount: number
  missingAdvertiserRatio: number
  missingTitleRatio: number
  missingBodyRatio: number
  missingUrlRatio: number
}

export interface ApifyScanResult {
  supported: boolean
  reason?: string
  ads: NormalizedCompetitorAd[]
  rawCount: number
  normalizedCount: number
  usefulCount: number
  provider: 'apify'
  actorId: string
  runId?: string
  datasetId?: string
  error?: string
  qualityStats?: ApifyQualityStats
}

export interface MetaApifyScanParams {
  query: string
  country?: string
  maxRecords?: number
  campaignTypeContext?: string | null
}

export interface GoogleApifyScanParams {
  query: string
  region?: string
  maxResults?: number
  campaignTypeContext?: string | null
}

/* ──────────────────────────────────────────────────────────
   isApifyEnabled / getApifyConfig
   ────────────────────────────────────────────────────────── */

export function isApifyEnabled(): boolean {
  return !!process.env.APIFY_API_TOKEN
}

export function getApifyConfig(): ApifyConfig | null {
  const apiToken = process.env.APIFY_API_TOKEN
  if (!apiToken) return null
  return {
    apiToken,
    metaActorId:
      process.env.APIFY_META_AD_LIBRARY_ACTOR_ID ||
      'curious_coder/facebook-ads-library-scraper',
    googleActorId:
      process.env.APIFY_GOOGLE_ADS_TRANSPARENCY_ACTOR_ID ||
      'solidcode/ads-transparency-scraper',
  }
}

/* ──────────────────────────────────────────────────────────
   buildMetaActorInput
   Meta Ad Library keyword arama URL'si backend tarafından
   dinamik oluşturulur. Hardcoded demo query/URL yok.
   ────────────────────────────────────────────────────────── */

export function buildMetaActorInput(params: MetaApifyScanParams): Record<string, unknown> {
  const country = params.country || 'TR'
  const maxRecords = params.maxRecords ?? 50
  const encodedQuery = encodeURIComponent(params.query)

  const searchUrl =
    `https://www.facebook.com/ads/library/` +
    `?active_status=active&ad_type=all&country=${country}` +
    `&q=${encodedQuery}&search_type=keyword_unordered`

  return {
    urls: [searchUrl],
    scrapeAdDetails: false,
    totalRecords: maxRecords,
    limitPerInputUrl: maxRecords,
  }
}

/* ──────────────────────────────────────────────────────────
   buildGoogleActorInput
   Google Transparency arama parametreleri backend tarafından
   dinamik oluşturulur. Hardcoded demo domain/query yok.
   Actor TR'yi desteklemiyorsa region boş → worldwide fallback.
   ────────────────────────────────────────────────────────── */

export function buildGoogleActorInput(params: GoogleApifyScanParams): Record<string, unknown> {
  const maxResults = params.maxResults ?? 50
  const region = params.region || 'TR'

  return {
    searchQuery: params.query,
    maxResults,
    platform: 'all',
    region: region || undefined,
    dateFrom: undefined,
    dateTo: undefined,
  }
}

/* ──────────────────────────────────────────────────────────
   runApifyActor
   Actor'ı başlatır; waitForFinish ile tamamlanmasını bekler.
   Actor ID'deki "/" → "~" (Apify URL path standardı).
   ────────────────────────────────────────────────────────── */

export async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  options: ApifyRunOptions = {},
): Promise<ApifyActorRunResult> {
  const config = getApifyConfig()
  if (!config) {
    return { runId: '', datasetId: '', status: 'FAILED', error: 'APIFY_API_TOKEN_missing' }
  }

  const waitSecs = options.waitForFinishSeconds ?? 120
  const timeoutMs = options.timeoutMs ?? (waitSecs + 30) * 1000

  // Apify URL path'i: "/" yerine "~" kullan
  const encodedActorId = actorId.replace(/\//g, '~')
  const url = `${APIFY_BASE}/acts/${encodedActorId}/runs?token=${config.apiToken}&waitForFinish=${waitSecs}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown')
      console.warn(`[ApifyProvider] Actor run HTTP ${res.status}: ${errText.slice(0, 200)}`)
      return {
        runId: '',
        datasetId: '',
        status: 'FAILED',
        error: `Apify HTTP ${res.status}: ${errText.slice(0, 100)}`,
      }
    }

    const json = await res.json()
    const runData = (json?.data ?? json) as Record<string, unknown>
    const runId = (runData?.id as string) ?? ''
    const datasetId = (runData?.defaultDatasetId as string) ?? ''
    const status = (runData?.status as string) ?? 'UNKNOWN'

    return { runId, datasetId, status }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[ApifyProvider] runApifyActor error:', msg)
    return { runId: '', datasetId: '', status: 'FAILED', error: msg }
  }
}

/* ──────────────────────────────────────────────────────────
   fetchApifyDatasetItems
   Run tamamlandıktan sonra dataset items'ı çeker.
   datasetId boşsa veya hata varsa empty array döner.
   ────────────────────────────────────────────────────────── */

export async function fetchApifyDatasetItems(
  datasetId: string,
): Promise<Record<string, unknown>[]> {
  if (!datasetId) return []

  const config = getApifyConfig()
  if (!config) return []

  const url = `${APIFY_BASE}/datasets/${datasetId}/items?token=${config.apiToken}&format=json`

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown')
      console.warn(`[ApifyProvider] fetchDataset HTTP ${res.status}: ${errText.slice(0, 200)}`)
      return []
    }

    const json = await res.json()
    return Array.isArray(json) ? (json as Record<string, unknown>[]) : []
  } catch (e) {
    console.warn(
      '[ApifyProvider] fetchApifyDatasetItems error:',
      e instanceof Error ? e.message : String(e),
    )
    return []
  }
}

/* ──────────────────────────────────────────────────────────
   normalizeApifyMetaAd
   curious_coder/facebook-ads-library-scraper çıktısını
   NormalizedCompetitorAd formatına dönüştürür.
   Actor output schema değişebilir — toleranslı normalize.
   ────────────────────────────────────────────────────────── */

export function normalizeApifyMetaAd(
  raw: Record<string, unknown>,
  context: { query_keyword?: string | null; campaign_type_context?: string | null },
): NormalizedCompetitorAd {
  const r = raw || {}
  const get = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (r[k] !== undefined && r[k] !== null) return r[k]
    }
    return undefined
  }

  const sourceAdId =
    (get('adArchiveID', 'ad_archive_id', 'id', 'adId', 'ad_id') as string | null) ?? null
  const pageName =
    (get('pageName', 'page_name', 'advertiserName', 'advertiser_name') as string | null) ?? null
  const pageId = (get('pageID', 'page_id', 'pageId') as string | null) ?? null

  const bodiesRaw = get('adCreativeBodies', 'ad_creative_bodies', 'bodies', 'body')
  const adBody = Array.isArray(bodiesRaw)
    ? ((bodiesRaw[0] as string | null) ?? null)
    : typeof bodiesRaw === 'string'
      ? bodiesRaw
      : ((get('ad_body', 'adBody', 'text', 'description') as string | null) ?? null)

  const titlesRaw = get('adCreativeLinkTitles', 'ad_creative_link_titles', 'titles', 'title')
  const adTitle = Array.isArray(titlesRaw)
    ? ((titlesRaw[0] as string | null) ?? null)
    : typeof titlesRaw === 'string'
      ? titlesRaw
      : ((get('ad_title', 'adTitle', 'headline') as string | null) ?? null)

  const descsRaw = get('adCreativeLinkDescriptions', 'ad_creative_link_descriptions', 'descriptions')
  const adDesc = Array.isArray(descsRaw)
    ? ((descsRaw[0] as string | null) ?? null)
    : typeof descsRaw === 'string'
      ? descsRaw
      : ((get('ad_description', 'adDescription') as string | null) ?? null)

  const cta = (get('callToAction', 'call_to_action', 'cta') as string | null) ?? null
  const destinationUrl =
    (get('targetUrl', 'target_url', 'link_url', 'destination_url', 'url') as string | null) ?? null

  const platformsRaw = get('publisherPlatforms', 'publisher_platforms', 'platforms')
  const publisherPlatforms = Array.isArray(platformsRaw)
    ? (platformsRaw as string[])
    : typeof platformsRaw === 'string'
      ? [platformsRaw]
      : ['facebook']

  const startTime =
    (get(
      'adDeliveryStartTime',
      'ad_delivery_start_time',
      'startDate',
      'start_date',
    ) as string | null) ?? null
  const stopTime =
    (get('adDeliveryStopTime', 'ad_delivery_stop_time', 'endDate', 'end_date') as string | null) ??
    null

  return {
    platform: 'meta',
    source: 'apify_meta_ad_library',
    source_ad_id: sourceAdId,
    source_page_id: pageId,
    ad_fingerprint: '',
    advertiser_name: pageName,
    advertiser_page_name: pageName,
    advertiser_domain: null,
    query_keyword: context.query_keyword ?? null,
    industry_keyword: context.query_keyword ?? null,
    campaign_type_context: context.campaign_type_context ?? null,
    ad_body: adBody,
    ad_title: adTitle,
    ad_description: adDesc,
    call_to_action: cta,
    destination_url: destinationUrl,
    publisher_platforms: publisherPlatforms,
    ad_delivery_start_time: startTime,
    ad_delivery_stop_time: stopTime,
    creative_assets: [],
    raw_payload: raw,
    extracted_signals: {},
    is_active: !stopTime,
  }
}

/* ──────────────────────────────────────────────────────────
   normalizeApifyGoogleAd
   solidcode/ads-transparency-scraper çıktısını
   NormalizedCompetitorAd formatına dönüştürür.
   ────────────────────────────────────────────────────────── */

export function normalizeApifyGoogleAd(
  raw: Record<string, unknown>,
  context: { query_keyword?: string | null; campaign_type_context?: string | null },
): NormalizedCompetitorAd {
  const r = raw || {}
  const get = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (r[k] !== undefined && r[k] !== null) return r[k]
    }
    return undefined
  }

  const sourceAdId = (get('adId', 'ad_id', 'id') as string | null) ?? null
  const advertiserName =
    (get('advertiserName', 'advertiser_name', 'brand', 'company') as string | null) ?? null
  const advertiserDomain =
    (get('advertiserDomain', 'advertiser_domain', 'domain', 'website') as string | null) ?? null
  const adTitle =
    (get('headline', 'title', 'ad_title', 'adTitle', 'heading') as string | null) ?? null
  const adBody =
    (get('description', 'body', 'ad_body', 'adBody', 'text', 'content') as string | null) ?? null
  const adDesc = (get('ad_description', 'adDescription', 'subtitle') as string | null) ?? null
  const destinationUrl =
    (get('destinationUrl', 'destination_url', 'targetUrl', 'url', 'link') as string | null) ?? null
  const startDate =
    (get('startDate', 'start_date', 'dateFrom', 'firstSeen', 'first_seen') as string | null) ?? null
  const endDate =
    (get('endDate', 'end_date', 'dateTo', 'lastSeen', 'last_seen') as string | null) ?? null
  const region = (get('region', 'country', 'geo') as string | null) ?? null
  const format = (get('format', 'adFormat', 'type') as string | null) ?? null

  return {
    platform: 'google',
    source: 'apify_google_ads_transparency',
    source_ad_id: sourceAdId,
    source_page_id: null,
    ad_fingerprint: '',
    advertiser_name: advertiserName,
    advertiser_page_name: advertiserName,
    advertiser_domain: advertiserDomain,
    query_keyword: context.query_keyword ?? null,
    industry_keyword: context.query_keyword ?? null,
    campaign_type_context: context.campaign_type_context ?? null,
    ad_body: adBody,
    ad_title: adTitle,
    ad_description: adDesc,
    call_to_action: null,
    destination_url: destinationUrl,
    publisher_platforms: ['google'],
    ad_delivery_start_time: startDate,
    ad_delivery_stop_time: endDate,
    creative_assets: [],
    raw_payload: raw,
    extracted_signals: { region, format },
    is_active: !endDate,
  }
}

/* ── Alias wrappers (normalizeX ile eşdeğer) ── */

export function mapApifyMetaToCompetitorAd(
  raw: Record<string, unknown>,
  context: { query_keyword?: string | null; campaign_type_context?: string | null },
): NormalizedCompetitorAd {
  return normalizeApifyMetaAd(raw, context)
}

export function mapApifyGoogleToCompetitorAd(
  raw: Record<string, unknown>,
  context: { query_keyword?: string | null; campaign_type_context?: string | null },
): NormalizedCompetitorAd {
  return normalizeApifyGoogleAd(raw, context)
}

/* ──────────────────────────────────────────────────────────
   Quality stats — raw/normalize/useful oranlarını hesaplar.
   Şimdilik console.info; ileride admin health dashboard'a bağlanır.
   ────────────────────────────────────────────────────────── */

function computeQualityStats(
  raw: Record<string, unknown>[],
  normalized: NormalizedCompetitorAd[],
): ApifyQualityStats {
  const n = normalized.length || 1
  const useful = normalized.filter((a) => a.advertiser_name || a.ad_title || a.ad_body)

  return {
    rawCount: raw.length,
    normalizedCount: normalized.length,
    usefulCount: useful.length,
    missingAdvertiserRatio: normalized.filter((a) => !a.advertiser_name).length / n,
    missingTitleRatio: normalized.filter((a) => !a.ad_title).length / n,
    missingBodyRatio: normalized.filter((a) => !a.ad_body).length / n,
    missingUrlRatio: normalized.filter((a) => !a.destination_url).length / n,
  }
}

/* ──────────────────────────────────────────────────────────
   runMetaApifyAdLibraryScan
   Meta kampanya için → sadece Meta actor.
   APIFY_API_TOKEN yoksa supported:false.
   Actor ID yoksa supported:false.
   Boş sonuç → reason:'empty_result', sahte data yok.
   ────────────────────────────────────────────────────────── */

export async function runMetaApifyAdLibraryScan(
  params: MetaApifyScanParams,
): Promise<ApifyScanResult> {
  const config = getApifyConfig()
  if (!config) {
    return {
      supported: false,
      reason: 'APIFY_API_TOKEN_missing',
      ads: [],
      rawCount: 0,
      normalizedCount: 0,
      usefulCount: 0,
      provider: 'apify',
      actorId: '',
    }
  }

  const actorId = config.metaActorId
  if (!actorId) {
    return {
      supported: false,
      reason: 'APIFY_ACTOR_ID_missing',
      ads: [],
      rawCount: 0,
      normalizedCount: 0,
      usefulCount: 0,
      provider: 'apify',
      actorId: '',
    }
  }

  const input = buildMetaActorInput(params)
  const runResult = await runApifyActor(actorId, input)

  if (runResult.error || runResult.status === 'FAILED') {
    return {
      supported: true,
      reason: 'actor_failed',
      ads: [],
      rawCount: 0,
      normalizedCount: 0,
      usefulCount: 0,
      provider: 'apify',
      actorId,
      runId: runResult.runId || undefined,
      error: runResult.error || `Actor status: ${runResult.status}`,
    }
  }

  if (!runResult.datasetId) {
    return {
      supported: true,
      reason: 'empty_result',
      ads: [],
      rawCount: 0,
      normalizedCount: 0,
      usefulCount: 0,
      provider: 'apify',
      actorId,
      runId: runResult.runId || undefined,
    }
  }

  const rawItems = await fetchApifyDatasetItems(runResult.datasetId)

  if (rawItems.length === 0) {
    return {
      supported: true,
      reason: 'empty_result',
      ads: [],
      rawCount: 0,
      normalizedCount: 0,
      usefulCount: 0,
      provider: 'apify',
      actorId,
      runId: runResult.runId || undefined,
      datasetId: runResult.datasetId || undefined,
    }
  }

  const context = {
    query_keyword: params.query,
    campaign_type_context: params.campaignTypeContext ?? null,
  }

  const normalized = rawItems.map((raw) => normalizeApifyMetaAd(raw, context))
  const qualityStats = computeQualityStats(rawItems, normalized)

  console.info('[ApifyProvider][Meta] quality stats:', qualityStats)

  return {
    supported: true,
    ads: normalized,
    rawCount: rawItems.length,
    normalizedCount: normalized.length,
    usefulCount: qualityStats.usefulCount,
    provider: 'apify',
    actorId,
    runId: runResult.runId || undefined,
    datasetId: runResult.datasetId || undefined,
    qualityStats,
  }
}

/* ──────────────────────────────────────────────────────────
   runGoogleApifyTransparencyScan
   Google kampanya için → sadece Google actor.
   APIFY_API_TOKEN yoksa supported:false.
   Actor ID yoksa supported:false.
   Boş sonuç → reason:'empty_result', sahte data yok.
   ────────────────────────────────────────────────────────── */

export async function runGoogleApifyTransparencyScan(
  params: GoogleApifyScanParams,
): Promise<ApifyScanResult> {
  const config = getApifyConfig()
  if (!config) {
    return {
      supported: false,
      reason: 'APIFY_API_TOKEN_missing',
      ads: [],
      rawCount: 0,
      normalizedCount: 0,
      usefulCount: 0,
      provider: 'apify',
      actorId: '',
    }
  }

  const actorId = config.googleActorId
  if (!actorId) {
    return {
      supported: false,
      reason: 'APIFY_ACTOR_ID_missing',
      ads: [],
      rawCount: 0,
      normalizedCount: 0,
      usefulCount: 0,
      provider: 'apify',
      actorId: '',
    }
  }

  const input = buildGoogleActorInput(params)
  const runResult = await runApifyActor(actorId, input)

  if (runResult.error || runResult.status === 'FAILED') {
    return {
      supported: true,
      reason: 'actor_failed',
      ads: [],
      rawCount: 0,
      normalizedCount: 0,
      usefulCount: 0,
      provider: 'apify',
      actorId,
      runId: runResult.runId || undefined,
      error: runResult.error || `Actor status: ${runResult.status}`,
    }
  }

  if (!runResult.datasetId) {
    return {
      supported: true,
      reason: 'empty_result',
      ads: [],
      rawCount: 0,
      normalizedCount: 0,
      usefulCount: 0,
      provider: 'apify',
      actorId,
      runId: runResult.runId || undefined,
    }
  }

  const rawItems = await fetchApifyDatasetItems(runResult.datasetId)

  if (rawItems.length === 0) {
    return {
      supported: true,
      reason: 'empty_result',
      ads: [],
      rawCount: 0,
      normalizedCount: 0,
      usefulCount: 0,
      provider: 'apify',
      actorId,
      runId: runResult.runId || undefined,
      datasetId: runResult.datasetId || undefined,
    }
  }

  const context = {
    query_keyword: params.query,
    campaign_type_context: params.campaignTypeContext ?? null,
  }

  const normalized = rawItems.map((raw) => normalizeApifyGoogleAd(raw, context))
  const qualityStats = computeQualityStats(rawItems, normalized)

  console.info('[ApifyProvider][Google] quality stats:', qualityStats)

  return {
    supported: true,
    ads: normalized,
    rawCount: rawItems.length,
    normalizedCount: normalized.length,
    usefulCount: qualityStats.usefulCount,
    provider: 'apify',
    actorId,
    runId: runResult.runId || undefined,
    datasetId: runResult.datasetId || undefined,
    qualityStats,
  }
}
