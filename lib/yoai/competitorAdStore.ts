/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Competitor Ad Store (Faz 2)

   Rakip reklamların kalıcı, dedupe edilmiş veritabanı katmanı.
   Meta Ad Library'den dönen ham ad'ları normalize eder,
   fingerprint üretir, upsert sırasında first_seen'i koruyup
   last_seen / seen_count'u günceller.

   Persistence: Supabase tablosu `yoai_competitor_ads`.
   Migration:   supabase/migrations/20260510005000_create_yoai_competitor_ads.sql

   Tablo yoksa: structured warning + boş/0 sonuç döner;
   çağıran flow (meta-ad-library / analyze) kırılmaz.
   ────────────────────────────────────────────────────────── */

import { createHash } from 'crypto'
import { supabase } from '@/lib/supabase/client'
import { sanitizeResponseExcerpt } from '@/lib/yoai/publishAuditStore'

const TABLE_MIGRATION_HINT =
  'supabase/migrations/20260510005000_create_yoai_competitor_ads.sql'

/* ── Types ── */

export type CompetitorAdSource =
  | 'meta_ad_library'
  | 'google_ads_transparency'
  | 'tiktok_creative_center'
  | 'manual'

export interface CompetitorAdContext {
  platform: 'meta' | 'google' | 'tiktok' | string
  source: CompetitorAdSource | string
  query_keyword?: string | null
  industry_keyword?: string | null
  campaign_type_context?: string | null
}

export interface NormalizedCompetitorAd {
  platform: string
  source: string
  source_ad_id: string | null
  source_page_id: string | null
  ad_fingerprint: string
  advertiser_name: string | null
  advertiser_page_name: string | null
  advertiser_domain: string | null
  query_keyword: string | null
  industry_keyword: string | null
  campaign_type_context: string | null
  ad_body: string | null
  ad_title: string | null
  ad_description: string | null
  call_to_action: string | null
  destination_url: string | null
  publisher_platforms: string[]
  ad_delivery_start_time: string | null
  ad_delivery_stop_time: string | null
  creative_assets: CompetitorCreativeAsset[]
  raw_payload: unknown
  extracted_signals: Record<string, unknown>
  is_active: boolean
}

export interface CompetitorCreativeAsset {
  type: 'image' | 'video' | 'thumbnail' | 'unknown'
  image_url?: string | null
  video_url?: string | null
  thumbnail_url?: string | null
  media_type?: string | null
  dimensions?: { width?: number; height?: number } | null
}

export interface UpsertCompetitorAdsResult {
  inserted: number
  updated: number
  skipped: number
  insertedIds: string[]
  affectedFingerprints: string[]
  errors: string[]
}

export interface CompetitorAdRow {
  id: string
  user_id: string
  platform: string
  source: string
  source_ad_id: string | null
  source_page_id: string | null
  ad_fingerprint: string
  advertiser_name: string | null
  advertiser_page_name: string | null
  advertiser_domain: string | null
  query_keyword: string | null
  industry_keyword: string | null
  campaign_type_context: string | null
  ad_body: string | null
  ad_title: string | null
  ad_description: string | null
  call_to_action: string | null
  destination_url: string | null
  publisher_platforms: string[]
  ad_delivery_start_time: string | null
  ad_delivery_stop_time: string | null
  creative_assets: CompetitorCreativeAsset[]
  raw_payload: unknown
  extracted_signals: Record<string, unknown>
  first_seen: string
  last_seen: string
  seen_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CompetitorAdListFilters {
  platform?: string
  source?: string
  campaign_type_context?: string | null
  query_keyword?: string | null
  advertiser_domain?: string
  active_only?: boolean
  since?: string                  // ISO timestamp (last_seen >= since)
  limit?: number
}

/* ── Helpers ── */

function isTableMissingError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === '42P01' || /relation .* does not exist/i.test(error.message || '')
}

function logTableMissing(op: string, hint?: Record<string, unknown>) {
  console.warn(
    `[CompetitorAdStore][TABLE_MISSING] yoai_competitor_ads tablosu yok — ${op} işlemi KAYBEDİLDİ. Migration uygulayın: ${TABLE_MIGRATION_HINT}`,
    hint || {},
  )
}

function clipString(value: string | null | undefined, max: number): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

function safeIsoOrNull(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null
  const t = value.trim()
  if (!t) return null
  // Meta date string'leri (YYYY-MM-DD veya ISO) kabul edilir, parse edilemiyorsa null.
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.toLowerCase().replace(/^www\./, '') || null
  } catch {
    return null
  }
}

/* ──────────────────────────────────────────────────────────
   sanitizeCompetitorRawPayload
   Token / cookie / secret / api_key vb. alanları redacted yapar
   ve toplam boyutu sınırlar. publishAuditStore.sanitizeResponseExcerpt
   reuse edilir (tek kaynak).
   ────────────────────────────────────────────────────────── */
export function sanitizeCompetitorRawPayload(raw: unknown): unknown {
  return sanitizeResponseExcerpt(raw)
}

/* ──────────────────────────────────────────────────────────
   buildCompetitorAdFingerprint
   source_ad_id varsa onu normalize edip kullan; yoksa
   advertiser + body + title hash'i. Aynı reklam için
   deterministik aynı fingerprint üretir.
   ────────────────────────────────────────────────────────── */
export function buildCompetitorAdFingerprint(ad: {
  source: string
  source_ad_id?: string | null
  advertiser_page_name?: string | null
  advertiser_name?: string | null
  ad_body?: string | null
  ad_title?: string | null
  ad_description?: string | null
}): string {
  const norm = (s: string | null | undefined) =>
    (s || '').toLowerCase().replace(/\s+/g, ' ').trim()

  if (ad.source_ad_id && ad.source_ad_id.trim()) {
    return `sid:${ad.source}:${ad.source_ad_id.trim()}`
  }

  const composite = [
    norm(ad.advertiser_page_name) || norm(ad.advertiser_name),
    norm(ad.ad_title),
    norm(ad.ad_body),
    norm(ad.ad_description),
  ].join('|')

  if (!composite || composite === '|||') {
    // En azından source ile differentiate, aksi halde collision olur.
    return `empty:${ad.source}:${createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 16)}`
  }

  return `hash:${ad.source}:${createHash('sha256').update(composite).digest('hex').slice(0, 32)}`
}

/* ──────────────────────────────────────────────────────────
   Deterministic signal extraction — başlık/body/CTA üzerinden
   hızlı sinyal etiketleri. LLM çağrısı YAPMAZ.
   ────────────────────────────────────────────────────────── */
const URGENCY_TOKENS = [
  'şimdi', 'hemen', 'sınırlı', 'son', 'kaçırma', 'bugün', 'acele',
  'son fırsat', 'son gün', 'tükenmeden', 'stoklar', 'bitmeden',
]
const PRICE_TOKENS = [
  'indirim', 'kampanya', 'ücretsiz', 'bedava', 'taksit', '%', 'tl',
  '₺', 'fiyat', 'kupon', 'promosyon', 'avantaj',
]
const SOCIAL_PROOF_TOKENS = [
  'binlerce', 'müşteri', 'yıldız', 'puan', 'tercih', 'memnun', 'referans',
]
const QUALITY_TOKENS = [
  'kaliteli', 'profesyonel', 'uzman', 'garanti', 'güvenilir', 'premium',
  'sertifikalı', 'orijinal', 'lider', 'ödüllü',
]
const OFFER_TOKENS = [
  'hediye', 'bedava kargo', 'ücretsiz kargo', 'ilk siparişe', 'üye ol',
  'kayıt ol', 'iade', 'geri ödeme', 'deneme',
]

function detectTokenSet(text: string, tokens: string[]): string[] {
  const lower = text.toLowerCase()
  const hits: string[] = []
  for (const tok of tokens) {
    if (lower.includes(tok)) hits.push(tok)
  }
  return hits
}

function extractSignals(ad: {
  ad_body?: string | null
  ad_title?: string | null
  ad_description?: string | null
  call_to_action?: string | null
}): Record<string, unknown> {
  const text = [ad.ad_title, ad.ad_body, ad.ad_description].filter(Boolean).join(' ')
  if (!text) return {}
  return {
    urgency: detectTokenSet(text, URGENCY_TOKENS),
    price: detectTokenSet(text, PRICE_TOKENS),
    social_proof: detectTokenSet(text, SOCIAL_PROOF_TOKENS),
    quality: detectTokenSet(text, QUALITY_TOKENS),
    offer: detectTokenSet(text, OFFER_TOKENS),
    cta_type: ad.call_to_action || null,
    text_length: text.length,
  }
}

/* ──────────────────────────────────────────────────────────
   normalizeMetaAdLibraryAd
   Meta Ad Library Graph API ham response'undan tek bir reklamı
   NormalizedCompetitorAd'a çevirir.
   meta-ad-library/route.ts hem ham hem mapped (camelCase) versiyon
   üretebileceği için her iki şekli de tolere eder.
   ────────────────────────────────────────────────────────── */
export function normalizeMetaAdLibraryAd(
  rawAd: Record<string, unknown>,
  context: CompetitorAdContext,
): NormalizedCompetitorAd {
  const r = rawAd || {}
  const get = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (r[k] !== undefined && r[k] !== null) return r[k]
    }
    return undefined
  }

  const sourceAdId = (get('id') as string | undefined) || null
  const pageId = (get('page_id', 'pageId') as string | undefined) || null
  const pageName = (get('page_name', 'pageName') as string | undefined) || null

  const adBody =
    (Array.isArray(get('ad_creative_bodies')) && (get('ad_creative_bodies') as string[])[0]) ||
    ((get('adCreativeBody') as string | undefined) ?? null)
  const adTitle =
    (Array.isArray(get('ad_creative_link_titles')) && (get('ad_creative_link_titles') as string[])[0]) ||
    ((get('adCreativeLinkTitle') as string | undefined) ?? null)
  const adDescription =
    (Array.isArray(get('ad_creative_link_descriptions')) && (get('ad_creative_link_descriptions') as string[])[0]) ||
    ((get('adCreativeDescription') as string | undefined) ?? null)

  const startRaw =
    (get('ad_delivery_start_time') as string | undefined) ||
    (get('adStartDate') as string | undefined) ||
    null
  const stopRaw =
    (get('ad_delivery_stop_time') as string | undefined) ||
    (get('adEndDate') as string | undefined) ||
    null

  const publisherPlatforms =
    (Array.isArray(get('publisher_platforms')) && (get('publisher_platforms') as string[])) ||
    (Array.isArray(get('platforms')) && (get('platforms') as string[])) ||
    []

  const destinationUrlRaw =
    (Array.isArray(get('ad_creative_link_captions')) && (get('ad_creative_link_captions') as string[])[0]) ||
    (get('link_url') as string | undefined) ||
    null

  // Meta Ad Library reliable media_type döndürmüyor; ileride genişletilecek
  // alan olarak boş tutuyoruz. Token saklamıyoruz.
  const creativeAssets: CompetitorCreativeAsset[] = []

  const partial = {
    source: context.source,
    source_ad_id: sourceAdId,
    advertiser_page_name: pageName,
    advertiser_name: pageName,
    ad_body: adBody as string | null,
    ad_title: adTitle as string | null,
    ad_description: adDescription as string | null,
  }
  const fingerprint = buildCompetitorAdFingerprint(partial)

  const stopIso = safeIsoOrNull(stopRaw as string | null)
  const isActive = !stopIso || new Date(stopIso).getTime() > Date.now()

  const normalized: NormalizedCompetitorAd = {
    platform: context.platform,
    source: context.source,
    source_ad_id: sourceAdId,
    source_page_id: pageId,
    ad_fingerprint: fingerprint,
    advertiser_name: clipString(pageName, 240),
    advertiser_page_name: clipString(pageName, 240),
    advertiser_domain: extractDomain(destinationUrlRaw as string | null),
    query_keyword: clipString(context.query_keyword ?? null, 240),
    industry_keyword: clipString(context.industry_keyword ?? null, 240),
    campaign_type_context: clipString(context.campaign_type_context ?? null, 80),
    ad_body: clipString(adBody as string | null, 4000),
    ad_title: clipString(adTitle as string | null, 1000),
    ad_description: clipString(adDescription as string | null, 4000),
    call_to_action: null,
    destination_url: clipString(destinationUrlRaw as string | null, 2000),
    publisher_platforms: Array.isArray(publisherPlatforms) ? publisherPlatforms.slice(0, 12) : [],
    ad_delivery_start_time: safeIsoOrNull(startRaw as string | null),
    ad_delivery_stop_time: stopIso,
    creative_assets: creativeAssets,
    raw_payload: sanitizeCompetitorRawPayload(rawAd),
    extracted_signals: {},
    is_active: isActive,
  }

  normalized.extracted_signals = extractSignals({
    ad_body: normalized.ad_body,
    ad_title: normalized.ad_title,
    ad_description: normalized.ad_description,
    call_to_action: normalized.call_to_action,
  })

  return normalized
}

/* ──────────────────────────────────────────────────────────
   upsertCompetitorAds
   Aynı (user, platform, source, fingerprint) varsa update
   (last_seen, seen_count, refresh metadata); yoksa insert.
   ────────────────────────────────────────────────────────── */
export async function upsertCompetitorAds(
  userId: string,
  ads: NormalizedCompetitorAd[],
  context?: { source?: string; platform?: string },
): Promise<UpsertCompetitorAdsResult> {
  const result: UpsertCompetitorAdsResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    insertedIds: [],
    affectedFingerprints: [],
    errors: [],
  }
  if (!supabase) {
    result.errors.push('supabase_client_unavailable')
    return result
  }
  if (!userId) {
    result.errors.push('missing_user_id')
    return result
  }
  if (!Array.isArray(ads) || ads.length === 0) return result

  const nowIso = new Date().toISOString()

  // Dedupe input by (platform, source, fingerprint) — aynı çağrıda tekrar gelirse tek upsert.
  const seen = new Set<string>()
  const inputUnique: NormalizedCompetitorAd[] = []
  for (const ad of ads) {
    const k = `${ad.platform}::${ad.source}::${ad.ad_fingerprint}`
    if (seen.has(k)) continue
    seen.add(k)
    inputUnique.push(ad)
  }

  // Mevcut satırları çek (fingerprint set'i ile).
  const fingerprints = inputUnique.map((a) => a.ad_fingerprint).filter(Boolean)
  const platformSet = Array.from(new Set(inputUnique.map((a) => a.platform)))
  const sourceSet = Array.from(new Set(inputUnique.map((a) => a.source)))

  const existingMap = new Map<string, CompetitorAdRow>()
  if (fingerprints.length > 0) {
    const { data, error } = await supabase
      .from('yoai_competitor_ads')
      .select('id, user_id, platform, source, ad_fingerprint, first_seen, seen_count')
      .eq('user_id', userId)
      .in('platform', platformSet)
      .in('source', sourceSet)
      .in('ad_fingerprint', fingerprints)

    if (error) {
      if (isTableMissingError(error)) {
        logTableMissing('upsertCompetitorAds.select', { userId, count: inputUnique.length })
        result.errors.push('table_missing')
        return result
      }
      console.error('[CompetitorAdStore] select error:', error)
      result.errors.push(`select_error:${error.message || 'unknown'}`)
      // Devam etme — hangi rows mevcut bilemediğimiz için duplicate yaratabiliriz.
      return result
    }
    for (const row of (data || []) as Pick<CompetitorAdRow,
      'id' | 'user_id' | 'platform' | 'source' | 'ad_fingerprint' | 'first_seen' | 'seen_count'
    >[]) {
      existingMap.set(`${row.platform}::${row.source}::${row.ad_fingerprint}`, row as CompetitorAdRow)
    }
  }

  // Insert ve update'leri ayır.
  const toInsert: Record<string, unknown>[] = []
  const toUpdate: { id: string; seen_count: number }[] = []

  for (const ad of inputUnique) {
    const key = `${ad.platform}::${ad.source}::${ad.ad_fingerprint}`
    const existing = existingMap.get(key)
    result.affectedFingerprints.push(ad.ad_fingerprint)
    if (existing) {
      toUpdate.push({ id: existing.id, seen_count: (existing.seen_count || 1) + 1 })
    } else {
      toInsert.push({
        user_id: userId,
        platform: ad.platform,
        source: ad.source,
        source_ad_id: ad.source_ad_id,
        source_page_id: ad.source_page_id,
        ad_fingerprint: ad.ad_fingerprint,
        advertiser_name: ad.advertiser_name,
        advertiser_page_name: ad.advertiser_page_name,
        advertiser_domain: ad.advertiser_domain,
        query_keyword: ad.query_keyword,
        industry_keyword: ad.industry_keyword,
        campaign_type_context: ad.campaign_type_context,
        ad_body: ad.ad_body,
        ad_title: ad.ad_title,
        ad_description: ad.ad_description,
        call_to_action: ad.call_to_action,
        destination_url: ad.destination_url,
        publisher_platforms: ad.publisher_platforms,
        ad_delivery_start_time: ad.ad_delivery_start_time,
        ad_delivery_stop_time: ad.ad_delivery_stop_time,
        creative_assets: ad.creative_assets,
        raw_payload: ad.raw_payload,
        extracted_signals: ad.extracted_signals,
        is_active: ad.is_active,
        first_seen: nowIso,
        last_seen: nowIso,
        seen_count: 1,
        updated_at: nowIso,
      })
    }
  }

  // Insert batch.
  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from('yoai_competitor_ads')
      .insert(toInsert)
      .select('id, ad_fingerprint')

    if (error) {
      if (isTableMissingError(error)) {
        logTableMissing('upsertCompetitorAds.insert', { count: toInsert.length })
        result.errors.push('table_missing')
        return result
      }
      console.error('[CompetitorAdStore] insert error:', error)
      result.errors.push(`insert_error:${error.message || 'unknown'}`)
    } else {
      result.inserted = (data?.length ?? 0)
      result.insertedIds = (data || []).map((d: { id: string }) => d.id)
    }
  }

  // Update batch — basit Promise.all, küçük N için yeterli.
  if (toUpdate.length > 0) {
    const updates = await Promise.all(
      toUpdate.map((u) =>
        supabase!
          .from('yoai_competitor_ads')
          .update({
            last_seen: nowIso,
            seen_count: u.seen_count,
            updated_at: nowIso,
          })
          .eq('id', u.id)
          .select('id')
          .maybeSingle(),
      ),
    )
    for (const res of updates) {
      if (res.error) {
        if (isTableMissingError(res.error)) {
          logTableMissing('upsertCompetitorAds.update')
          result.errors.push('table_missing')
          continue
        }
        console.error('[CompetitorAdStore] update error:', res.error)
        result.errors.push(`update_error:${res.error.message || 'unknown'}`)
        continue
      }
      if (res.data) result.updated++
    }
  }

  result.skipped = inputUnique.length - result.inserted - result.updated
  if (result.skipped < 0) result.skipped = 0
  return result
}

/* ──────────────────────────────────────────────────────────
   listCompetitorAds — filtreli liste (en yeni last_seen önce).
   ────────────────────────────────────────────────────────── */
export async function listCompetitorAds(
  userId: string,
  filters: CompetitorAdListFilters = {},
): Promise<CompetitorAdRow[]> {
  if (!supabase || !userId) return []

  let q = supabase
    .from('yoai_competitor_ads')
    .select('*')
    .eq('user_id', userId)
    .order('last_seen', { ascending: false })

  if (filters.platform) q = q.eq('platform', filters.platform)
  if (filters.source) q = q.eq('source', filters.source)
  if (filters.campaign_type_context !== undefined && filters.campaign_type_context !== null) {
    q = q.eq('campaign_type_context', filters.campaign_type_context)
  }
  if (filters.query_keyword !== undefined && filters.query_keyword !== null) {
    q = q.eq('query_keyword', filters.query_keyword)
  }
  if (filters.advertiser_domain) q = q.eq('advertiser_domain', filters.advertiser_domain)
  if (filters.active_only) q = q.eq('is_active', true)
  if (filters.since) q = q.gte('last_seen', filters.since)

  const limit = Math.min(Math.max(filters.limit || 100, 1), 500)
  q = q.limit(limit)

  const { data, error } = await q
  if (error) {
    if (isTableMissingError(error)) {
      logTableMissing('listCompetitorAds')
      return []
    }
    console.error('[CompetitorAdStore] list error:', error)
    return []
  }
  return (data || []) as CompetitorAdRow[]
}

/* ──────────────────────────────────────────────────────────
   getRecentCompetitorAds — kısa dönem aktif rakip seti.
   Default 30 gün.
   ────────────────────────────────────────────────────────── */
export async function getRecentCompetitorAds(
  userId: string,
  filters: Omit<CompetitorAdListFilters, 'since'> & { lookbackDays?: number } = {},
): Promise<CompetitorAdRow[]> {
  const days = Math.max(1, filters.lookbackDays ?? 30)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  return listCompetitorAds(userId, { ...filters, since })
}

/* ──────────────────────────────────────────────────────────
   markCompetitorAdSeen — hafif "yeniden görüldü" güncellemesi.
   listCompetitorAds + upsert kullanılmadan tek satıra dokunmak için.
   ────────────────────────────────────────────────────────── */
export async function markCompetitorAdSeen(
  userId: string,
  adFingerprint: string,
  platform: string,
  source: string,
): Promise<boolean> {
  if (!supabase || !userId || !adFingerprint) return false
  const nowIso = new Date().toISOString()
  const { data: row, error: selErr } = await supabase
    .from('yoai_competitor_ads')
    .select('id, seen_count')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('source', source)
    .eq('ad_fingerprint', adFingerprint)
    .maybeSingle()

  if (selErr) {
    if (isTableMissingError(selErr)) {
      logTableMissing('markCompetitorAdSeen.select')
      return false
    }
    console.error('[CompetitorAdStore] markSeen select error:', selErr)
    return false
  }
  if (!row) return false

  const { error: updErr } = await supabase
    .from('yoai_competitor_ads')
    .update({
      last_seen: nowIso,
      seen_count: (row.seen_count || 1) + 1,
      updated_at: nowIso,
    })
    .eq('id', row.id)

  if (updErr) {
    if (isTableMissingError(updErr)) {
      logTableMissing('markCompetitorAdSeen.update')
      return false
    }
    console.error('[CompetitorAdStore] markSeen update error:', updErr)
    return false
  }
  return true
}
