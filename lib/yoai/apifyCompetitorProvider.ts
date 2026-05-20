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

   Vercel Timeout Safety (Faz 2C fix):
   waitForFinish max 45 s (eski 120 s).
   Actor 45 s içinde bitmezse:
     isPending:true, reason:'APIFY_RUN_STILL_RUNNING' — error yok.
   Toplam bütçet: 45 s (actor) + 10 s (dataset) ≈ 55 s < 60 s.
   ────────────────────────────────────────────────────────── */

import type { NormalizedCompetitorAd, CompetitorCreativeAsset } from './competitorAdStore'

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
  statusMessage?: string
  exitCode?: number
  durationMillis?: number
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
  /** Actor henüz tamamlanmadıysa true — controlled pending response. */
  isPending?: boolean
  /** Apify run status (SUCCEEDED | RUNNING | FAILED | …) */
  runStatus?: string
  ads: NormalizedCompetitorAd[]
  rawCount: number
  normalizedCount: number
  usefulCount: number
  provider: 'apify'
  actorId: string
  runId?: string
  datasetId?: string
  error?: string
  statusMessage?: string
  exitCode?: number
  durationMillis?: number
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
    metaActorId: process.env.APIFY_META_AD_LIBRARY_ACTOR_ID ?? '',
    googleActorId: process.env.APIFY_GOOGLE_ADS_TRANSPARENCY_ACTOR_ID ?? '',
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
    urls: [{ url: searchUrl }],
    scrapeAdDetails: false,
    count: maxRecords,
    limitPerSource: maxRecords,
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

  const input: Record<string, unknown> = {
    searchQuery: params.query,
    maxResults,
  }
  if (region) input.region = region
  return input
}

/* ──────────────────────────────────────────────────────────
   Apify run status helpers
   RUNNING / READY / ABORTING → actor henüz bitmedi (pending).
   SUCCEEDED → dataset hazır, devam et.
   FAILED / ABORTED / TIMED-OUT → hata.
   ────────────────────────────────────────────────────────── */

const APIFY_STILL_RUNNING_STATUSES = new Set(['READY', 'RUNNING', 'ABORTING'])

export function isApifyRunStillRunning(status: string): boolean {
  return APIFY_STILL_RUNNING_STATUSES.has(status.toUpperCase())
}

export function isApifyRunSucceeded(status: string): boolean {
  return status.toUpperCase() === 'SUCCEEDED'
}

/* ──────────────────────────────────────────────────────────
   runApifyActor
   Actor'ı başlatır; waitForFinish ile tamamlanmasını bekler.
   Vercel maxDuration=60 s bütçesini aşmamak için:
     - waitForFinish default 45 s (eski 120 s)
     - AbortSignal timeout = waitSecs + 8 s (network buffer)
   Actor 45 s içinde bitmezse Apify RUNNING status döner;
   callerlar isApifyRunStillRunning() ile pending response üretir.
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

  // waitForFinish max 45 s — Vercel 60 s budget içinde kalır.
  const waitSecs = Math.min(options.waitForFinishSeconds ?? 45, 45)
  const timeoutMs = options.timeoutMs ?? (waitSecs + 8) * 1000

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
    const statusMessage = (runData?.statusMessage as string) ?? undefined
    const exitCode =
      typeof runData?.exitCode === 'number' ? (runData.exitCode as number) : undefined
    const statsRaw =
      runData?.stats && typeof runData.stats === 'object'
        ? (runData.stats as Record<string, unknown>)
        : null
    const durationMillis =
      typeof statsRaw?.durationMillis === 'number'
        ? (statsRaw.durationMillis as number)
        : undefined

    return { runId, datasetId, status, statusMessage, exitCode, durationMillis }
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
   Timeout 10 s — actor wait (45 s) + dataset (10 s) ≈ 55 s
   Vercel 60 s budget'inin içinde kalır.
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
      signal: AbortSignal.timeout(10_000),
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
   normalizeAdDate
   Unix seconds (number), Unix ms (number), numeric string,
   ISO/date string → ISO string | null.
   Actor'lar farklı format döndürebilir; hepsini handle eder.
   ────────────────────────────────────────────────────────── */

function normalizeAdDate(value: unknown): string | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null
    // > 9_999_999_999 → ms; <= → seconds
    const ms = value > 9_999_999_999 ? value : value * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  if (typeof value === 'string') {
    const t = value.trim()
    if (!t) return null
    const num = Number(t)
    if (!Number.isNaN(num) && num > 0) {
      const ms = num > 9_999_999_999 ? num : num * 1000
      const d = new Date(ms)
      return Number.isNaN(d.getTime()) ? null : d.toISOString()
    }
    const d = new Date(t)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  return null
}

/* ──────────────────────────────────────────────────────────
   Text extraction helpers (nested actor şemaları için)
   Meta Ad Library actor metni snapshot.body.text gibi iç içe
   verebilir; bu helper'lar string / {text} / {markup.__html} /
   array gibi farklı şekilleri tek string'e indirger.
   ────────────────────────────────────────────────────────── */

function stripHtml(s: string): string | null {
  const t = s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return t || null
}

/** string | {text} | {markup:{__html}} | {__html} → düz metin | null */
function extractText(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o.text === 'string') return o.text.trim() || null
    const markup = o.markup
    if (markup && typeof markup === 'object' && typeof (markup as Record<string, unknown>).__html === 'string') {
      return stripHtml((markup as Record<string, unknown>).__html as string)
    }
    if (typeof o.__html === 'string') return stripHtml(o.__html)
  }
  return null
}

/** Array ise ilk dolu elemanı, değilse kendisini extractText'ten geçirir. */
function pickFirstText(v: unknown): string | null {
  if (Array.isArray(v)) {
    for (const item of v) {
      const s = extractText(item)
      if (s) return s
    }
    return null
  }
  return extractText(v)
}

function firstPresent(obj: Record<string, unknown> | null | undefined, keys: string[]): unknown {
  if (!obj) return undefined
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k]
  }
  return undefined
}

/* ──────────────────────────────────────────────────────────
   normalizeApifyMetaAd
   curious_coder/facebook-ads-library-scraper çıktısını
   NormalizedCompetitorAd formatına dönüştürür.

   Actor güncel şeması reklam metnini snapshot altında nested
   verir: snapshot.{ body.text, title, caption, cta_text,
   link_url, link_description, cards[], images[], videos[] }.
   Düz üst-seviye anahtarlar (eski şema / başka actor) FALLBACK
   olarak korunur — toleranslı normalize.
   ────────────────────────────────────────────────────────── */

export function normalizeApifyMetaAd(
  raw: Record<string, unknown>,
  context: { query_keyword?: string | null; campaign_type_context?: string | null },
): NormalizedCompetitorAd {
  const r = raw || {}
  const get = (...keys: string[]): unknown => firstPresent(r, keys)

  const snapshot =
    r.snapshot && typeof r.snapshot === 'object' ? (r.snapshot as Record<string, unknown>) : {}
  const snap = (...keys: string[]): unknown => firstPresent(snapshot, keys)
  const cards = Array.isArray(snapshot.cards) ? (snapshot.cards as Record<string, unknown>[]) : []
  const card = (...keys: string[]): unknown => {
    for (const c of cards) {
      if (c && typeof c === 'object') {
        const v = firstPresent(c as Record<string, unknown>, keys)
        if (v !== undefined && v !== null) return v
      }
    }
    return undefined
  }

  const sourceAdId =
    (get('adArchiveID', 'ad_archive_id', 'id', 'adId', 'ad_id') as string | null) ?? null
  const pageName =
    (get('pageName', 'page_name', 'advertiserName', 'advertiser_name') as string | null) ??
    extractText(snap('page_name')) ??
    null
  const pageId = (get('pageID', 'page_id', 'pageId') as string | null) ?? null

  // Ad body: top-level array/string → snapshot.body(.text) → ilk kart body
  const adBody =
    pickFirstText(get('adCreativeBodies', 'ad_creative_bodies', 'bodies', 'body')) ??
    extractText(snap('body')) ??
    extractText(card('body')) ??
    pickFirstText(get('ad_body', 'adBody', 'text', 'description')) ??
    null

  // Ad title: top-level → snapshot.title → ilk kart title
  const adTitle =
    pickFirstText(get('adCreativeLinkTitles', 'ad_creative_link_titles', 'titles', 'title')) ??
    extractText(snap('title')) ??
    extractText(card('title')) ??
    pickFirstText(get('ad_title', 'adTitle', 'headline')) ??
    null

  // Ad description: top-level → snapshot.link_description/caption → kart
  const adDesc =
    pickFirstText(get('adCreativeLinkDescriptions', 'ad_creative_link_descriptions', 'descriptions')) ??
    extractText(snap('link_description', 'caption')) ??
    extractText(card('link_description', 'caption')) ??
    pickFirstText(get('ad_description', 'adDescription')) ??
    null

  const cta =
    (get('callToAction', 'call_to_action', 'cta') as string | null) ??
    extractText(snap('cta_text', 'cta_type')) ??
    extractText(card('cta_text', 'cta_type')) ??
    null

  const destinationUrl =
    (get('targetUrl', 'target_url', 'link_url', 'destination_url', 'url') as string | null) ??
    extractText(snap('link_url')) ??
    extractText(card('link_url')) ??
    null

  const platformsRaw = get('publisherPlatforms', 'publisher_platforms', 'platforms') ?? snap('publisher_platforms')
  const publisherPlatforms = Array.isArray(platformsRaw)
    ? (platformsRaw as string[])
    : typeof platformsRaw === 'string'
      ? [platformsRaw]
      : ['facebook']

  const startTime = normalizeAdDate(
    get('adDeliveryStartTime', 'ad_delivery_start_time', 'adStartDate', 'startDate', 'start_date') ??
      snap('start_date'),
  )
  const stopTime = normalizeAdDate(
    get('adDeliveryStopTime', 'ad_delivery_stop_time', 'adEndDate', 'endDate', 'end_date') ??
      snap('end_date'),
  )

  // Creative assets: snapshot.images[] + snapshot.videos[]
  const creativeAssets: CompetitorCreativeAsset[] = []
  const images = Array.isArray(snapshot.images) ? (snapshot.images as Record<string, unknown>[]) : []
  for (const img of images.slice(0, 5)) {
    const u = firstPresent(img, ['original_image_url', 'resized_image_url', 'image_url', 'url'])
    if (typeof u === 'string') creativeAssets.push({ type: 'image', image_url: u })
  }
  const videos = Array.isArray(snapshot.videos) ? (snapshot.videos as Record<string, unknown>[]) : []
  for (const vid of videos.slice(0, 3)) {
    const vu = firstPresent(vid, ['video_hd_url', 'video_sd_url', 'video_url'])
    const thumb = firstPresent(vid, ['video_preview_image_url', 'thumbnail_url'])
    if (typeof vu === 'string') {
      creativeAssets.push({
        type: 'video',
        video_url: vu,
        thumbnail_url: typeof thumb === 'string' ? thumb : null,
      })
    }
  }

  // is_active: actor açık boolean verirse onu kullan, yoksa stopTime'dan türet
  const explicitActive = get('is_active', 'isActive') ?? snap('is_active')
  const isActive = typeof explicitActive === 'boolean' ? explicitActive : !stopTime

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
    creative_assets: creativeAssets,
    raw_payload: raw,
    extracted_signals: {},
    is_active: isActive,
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

  // creativeId → source_ad_id (fingerprint için birincil key)
  const sourceAdId = (get('creativeId', 'creative_id', 'adId', 'ad_id', 'id') as string | null) ?? null
  // advertiserId → source_page_id
  const sourcePageId = (get('advertiserId', 'advertiser_id', 'pageId', 'page_id') as string | null) ?? null
  const advertiserName =
    (get('advertiserName', 'advertiser_name', 'brand', 'company') as string | null) ?? null
  const advertiserDomain =
    (get('advertiserDomain', 'advertiser_domain', 'domain', 'website') as string | null) ?? null
  const adTitle =
    (get('headline', 'title', 'ad_title', 'adTitle', 'heading') as string | null) ?? null
  const adBody =
    (get('description', 'body', 'ad_body', 'adBody', 'text', 'content') as string | null) ?? null
  const adDesc = (get('ad_description', 'adDescription', 'subtitle') as string | null) ?? null
  // adUrl → destination_url
  const destinationUrl =
    (get('adUrl', 'ad_url', 'destinationUrl', 'destination_url', 'targetUrl', 'url', 'link') as string | null) ?? null
  // firstShown / lastShown → dates (with Unix seconds support)
  const startDate = normalizeAdDate(
    get('firstShown', 'first_shown', 'startDate', 'start_date', 'dateFrom', 'firstSeen', 'first_seen'),
  )
  const endDate = normalizeAdDate(
    get('lastShown', 'last_shown', 'endDate', 'end_date', 'dateTo', 'lastSeen', 'last_seen'),
  )
  const region = (get('region', 'country', 'geo') as string | null) ?? null
  const adFormat = (get('adFormat', 'ad_format', 'format', 'type') as string | null) ?? null

  // imageUrl / previewUrl → creative_assets
  const imageUrl = (get('imageUrl', 'image_url') as string | null) ?? null
  const previewUrl = (get('previewUrl', 'preview_url', 'videoUrl', 'video_url') as string | null) ?? null
  const creativeAssets: CompetitorCreativeAsset[] = []
  if (imageUrl) creativeAssets.push({ type: 'image', image_url: imageUrl })
  if (previewUrl) {
    const isVideo = !!adFormat?.toLowerCase().includes('video')
    creativeAssets.push(
      isVideo
        ? { type: 'video', video_url: previewUrl }
        : { type: 'thumbnail', thumbnail_url: previewUrl },
    )
  }

  // Google Ads Transparency actor'ı (solidcode/ads-transparency-scraper)
  // çoğu durumda reklam METNİNİ döndürmez — yalnızca advertiser + creativeId +
  // format + tarih + URL. Bu bir actor sınırıdır, bizim hatamız değil.
  // text_available bayrağı downstream'in (A4 payload) metni olmayan kayıtları
  // "metin yok — advertiser/format/URL sinyali" olarak dürüstçe sunmasını sağlar.
  const textAvailable = !!(adTitle || adBody || adDesc)

  return {
    platform: 'google',
    source: 'apify_google_ads_transparency',
    source_ad_id: sourceAdId,
    source_page_id: sourcePageId,
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
    creative_assets: creativeAssets,
    raw_payload: raw,
    extracted_signals: { region, format: adFormat, text_available: textAvailable },
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
   Actor 45 s içinde bitmezse → isPending:true, controlled response.
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
      reason: 'APIFY_META_ACTOR_ID_missing',
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

  // Actor henüz çalışıyor — route timeout'u aşmadan controlled pending döndür.
  if (isApifyRunStillRunning(runResult.status)) {
    console.info(
      `[ApifyProvider][Meta] Actor still running (status=${runResult.status}) — returning pending.`,
    )
    return {
      supported: true,
      isPending: true,
      runStatus: runResult.status,
      reason: 'APIFY_RUN_STILL_RUNNING',
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

  if (runResult.error || !isApifyRunSucceeded(runResult.status)) {
    return {
      supported: true,
      reason: 'actor_failed',
      runStatus: runResult.status,
      ads: [],
      rawCount: 0,
      normalizedCount: 0,
      usefulCount: 0,
      provider: 'apify',
      actorId,
      runId: runResult.runId || undefined,
      datasetId: runResult.datasetId || undefined,
      error: runResult.error || `Actor status: ${runResult.status}`,
      statusMessage: runResult.statusMessage,
      exitCode: runResult.exitCode,
      durationMillis: runResult.durationMillis,
    }
  }

  if (!runResult.datasetId) {
    return {
      supported: true,
      reason: 'empty_result',
      runStatus: runResult.status,
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
   Actor 45 s içinde bitmezse → isPending:true, controlled response.
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
      reason: 'APIFY_GOOGLE_ACTOR_ID_missing',
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

  // Actor henüz çalışıyor — route timeout'u aşmadan controlled pending döndür.
  if (isApifyRunStillRunning(runResult.status)) {
    console.info(
      `[ApifyProvider][Google] Actor still running (status=${runResult.status}) — returning pending.`,
    )
    return {
      supported: true,
      isPending: true,
      runStatus: runResult.status,
      reason: 'APIFY_RUN_STILL_RUNNING',
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

  if (runResult.error || !isApifyRunSucceeded(runResult.status)) {
    return {
      supported: true,
      reason: 'actor_failed',
      runStatus: runResult.status,
      ads: [],
      rawCount: 0,
      normalizedCount: 0,
      usefulCount: 0,
      provider: 'apify',
      actorId,
      runId: runResult.runId || undefined,
      datasetId: runResult.datasetId || undefined,
      error: runResult.error || `Actor status: ${runResult.status}`,
      statusMessage: runResult.statusMessage,
      exitCode: runResult.exitCode,
      durationMillis: runResult.durationMillis,
    }
  }

  if (!runResult.datasetId) {
    return {
      supported: true,
      reason: 'empty_result',
      runStatus: runResult.status,
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
