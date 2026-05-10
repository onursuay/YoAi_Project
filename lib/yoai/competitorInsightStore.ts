/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Competitor Insight Store (Faz 2)

   yoai_competitor_ads üzerinden DETERMINISTIK kural-tabanlı özet
   içgörü üretir ve yoai_competitor_insights tablosuna upsert eder.
   Bu fazda LLM çağrısı YOKTUR. Multi-AI Decision Desk sonraki faz.

   Persistence: Supabase tablosu `yoai_competitor_insights`.
   Migration:   supabase/migrations/20260510005100_create_yoai_competitor_insights.sql

   Tablo yoksa: structured warning + null/empty döner; çağıran flow
   (analyze / meta-ad-library) kırılmaz.
   ────────────────────────────────────────────────────────── */

import { supabase } from '@/lib/supabase/client'
import type { CompetitorAdRow, NormalizedCompetitorAd } from './competitorAdStore'

const TABLE_MIGRATION_HINT =
  'supabase/migrations/20260510005100_create_yoai_competitor_insights.sql'

/* ── Types ── */

export interface CompetitorInsightContext {
  platform: string
  source: string
  campaign_type_context?: string | null
  query_keyword?: string | null
}

export interface CompetitorInsightSnapshot {
  platform: string
  source: string
  campaign_type_context: string | null
  query_keyword: string | null
  ads_count: number
  active_advertisers_count: number
  top_hooks: { token: string; count: number }[]
  top_ctas: { cta: string; count: number }[]
  top_value_props: { token: string; count: number }[]
  common_phrases: string[]
  creative_patterns: string[]
  offer_patterns: { token: string; count: number }[]
  publisher_distribution: Record<string, number>
  competitor_summary: string
  confidence: number
  raw_ad_ids: string[]
  metadata: Record<string, unknown>
}

export interface CompetitorInsightRow extends CompetitorInsightSnapshot {
  id: string
  user_id: string
  generated_at: string
  expires_at: string | null
  created_at: string
  updated_at: string
}

/* ── Helpers ── */

function isTableMissingError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === '42P01' || /relation .* does not exist/i.test(error.message || '')
}

function logTableMissing(op: string, hint?: Record<string, unknown>) {
  console.warn(
    `[CompetitorInsightStore][TABLE_MISSING] yoai_competitor_insights tablosu yok — ${op} işlemi KAYBEDİLDİ. Migration uygulayın: ${TABLE_MIGRATION_HINT}`,
    hint || {},
  )
}

function topN<T extends string>(counts: Map<T, number>, n: number): { token: T; count: number }[] {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([token, count]) => ({ token, count }))
}

function bumpCounter<T>(map: Map<T, number>, key: T) {
  map.set(key, (map.get(key) || 0) + 1)
}

/* ── Token sets — competitorAdStore.extractSignals ile uyumlu ── */
const HOOK_HINTS = [
  'şimdi', 'hemen', 'sınırlı', 'bugün', 'son fırsat', 'son gün',
  'kaçırma', 'tükenmeden', 'hediye', 'fırsat', 'yeni',
]
const VALUE_PROP_HINTS = [
  'kaliteli', 'uzman', 'garanti', 'güvenilir', 'profesyonel', 'orijinal',
  'lider', 'ödüllü', 'sertifikalı', 'binlerce müşteri', 'tercih',
]
const OFFER_HINTS = [
  'indirim', 'ücretsiz', 'bedava', 'kupon', 'promosyon', 'taksit',
  'ücretsiz kargo', 'iade', 'deneme', 'kayıt ol',
]
const PHRASE_HINTS = [
  'hemen al', 'şimdi al', 'detaylı bilgi', 'iletişime geç', 'teklif al',
  'incele', 'satın al', 'rezervasyon', 'whatsapp', 'arayın',
  'kayıt ol', 'üye ol', 'abone ol',
]

/* ──────────────────────────────────────────────────────────
   generateCompetitorInsightFromAds
   Verilen rakip reklam listesinden deterministik snapshot üretir.
   Hem persisted CompetitorAdRow hem de henüz yazılmamış
   NormalizedCompetitorAd kabul eder (analyze route ham listeyi
   doğrudan da geçirebilsin diye).
   ────────────────────────────────────────────────────────── */
export type CompetitorAdLike =
  | (Pick<NormalizedCompetitorAd,
      'platform' | 'source' | 'ad_body' | 'ad_title' | 'ad_description'
      | 'call_to_action' | 'publisher_platforms' | 'campaign_type_context'
      | 'query_keyword' | 'advertiser_page_name' | 'is_active'>
      & { id?: string; ad_fingerprint?: string | null; source_ad_id?: string | null })
  | (Pick<CompetitorAdRow,
      'id' | 'platform' | 'source' | 'ad_body' | 'ad_title' | 'ad_description'
      | 'call_to_action' | 'publisher_platforms' | 'campaign_type_context'
      | 'query_keyword' | 'advertiser_page_name' | 'is_active' | 'ad_fingerprint' | 'source_ad_id'>)

export function generateCompetitorInsightFromAds(
  ads: CompetitorAdLike[],
  context: CompetitorInsightContext,
): CompetitorInsightSnapshot {
  const hookCounts = new Map<string, number>()
  const ctaCounts = new Map<string, number>()
  const valueCounts = new Map<string, number>()
  const offerCounts = new Map<string, number>()
  const phraseCounts = new Map<string, number>()
  const publisherDist = new Map<string, number>()
  const advertisers = new Set<string>()
  const rawIds: string[] = []

  for (const ad of ads) {
    if (ad.advertiser_page_name) advertisers.add(ad.advertiser_page_name)
    if ('id' in ad && ad.id) rawIds.push(ad.id)
    else if (ad.ad_fingerprint) rawIds.push(ad.ad_fingerprint)
    else if (ad.source_ad_id) rawIds.push(ad.source_ad_id)

    const text = [ad.ad_title, ad.ad_body, ad.ad_description].filter(Boolean).join(' ').toLowerCase()
    if (!text) continue

    for (const tok of HOOK_HINTS) {
      if (text.includes(tok)) bumpCounter(hookCounts, tok)
    }
    for (const tok of VALUE_PROP_HINTS) {
      if (text.includes(tok)) bumpCounter(valueCounts, tok)
    }
    for (const tok of OFFER_HINTS) {
      if (text.includes(tok)) bumpCounter(offerCounts, tok)
    }
    for (const phrase of PHRASE_HINTS) {
      if (text.includes(phrase)) bumpCounter(phraseCounts, phrase)
    }
    if (ad.call_to_action) bumpCounter(ctaCounts, ad.call_to_action)
    for (const p of ad.publisher_platforms || []) bumpCounter(publisherDist, p)
  }

  const topHooks = topN(hookCounts, 8).map((x) => ({ token: x.token, count: x.count }))
  const topCtas = topN(ctaCounts, 6).map((x) => ({ cta: x.token, count: x.count }))
  const topValueProps = topN(valueCounts, 8).map((x) => ({ token: x.token, count: x.count }))
  const offerPatterns = topN(offerCounts, 8).map((x) => ({ token: x.token, count: x.count }))
  const commonPhrases = topN(phraseCounts, 8).map((x) => x.token)

  // Confidence skoru: rakip sayısı + reklam sayısı.
  // 0 → veri yok; 100 → 20+ reklam ve 5+ farklı reklamveren.
  const adsCount = ads.length
  const advCount = advertisers.size
  let confidence = 0
  if (adsCount > 0) {
    confidence = Math.min(60, adsCount * 3) + Math.min(40, advCount * 8)
    if (confidence > 100) confidence = 100
  }

  const summaryParts: string[] = []
  summaryParts.push(`${adsCount} rakip reklam analiz edildi`)
  if (advCount > 0) summaryParts.push(`${advCount} farklı reklamveren`)
  if (topHooks.length > 0) summaryParts.push(`Sık kullanılan hook'lar: ${topHooks.slice(0, 4).map((h) => h.token).join(', ')}`)
  if (topCtas.length > 0) summaryParts.push(`En sık CTA: ${topCtas.slice(0, 3).map((c) => c.cta).join(', ')}`)
  if (offerPatterns.length > 0) summaryParts.push(`Tekrar eden teklifler: ${offerPatterns.slice(0, 3).map((o) => o.token).join(', ')}`)
  const competitor_summary = adsCount === 0
    ? 'Rakip reklam verisi bulunamadı.'
    : summaryParts.join('. ') + '.'

  return {
    platform: context.platform,
    source: context.source,
    campaign_type_context: context.campaign_type_context ?? null,
    query_keyword: context.query_keyword ?? null,
    ads_count: adsCount,
    active_advertisers_count: advCount,
    top_hooks: topHooks,
    top_ctas: topCtas,
    top_value_props: topValueProps,
    common_phrases: commonPhrases,
    creative_patterns: [], // Faz 2'de görsel/video extraction yok — boş liste, halüsinasyon yok.
    offer_patterns: offerPatterns,
    publisher_distribution: Object.fromEntries(publisherDist),
    competitor_summary,
    confidence,
    raw_ad_ids: rawIds.slice(0, 200),
    metadata: {
      generated_by: 'competitorInsightStore.generateCompetitorInsightFromAds',
      llm_used: false,
    },
  }
}

/* ──────────────────────────────────────────────────────────
   upsertCompetitorInsight
   (user_id, platform, source, campaign_type_context, query_keyword)
   tuple'ı için "en güncel snapshot" tutar.
   ────────────────────────────────────────────────────────── */
export async function upsertCompetitorInsight(
  userId: string,
  insight: CompetitorInsightSnapshot,
  options?: { ttlMinutes?: number },
): Promise<{ id: string } | null> {
  if (!supabase || !userId) return null
  const nowIso = new Date().toISOString()
  const expiresAt = options?.ttlMinutes
    ? new Date(Date.now() + options.ttlMinutes * 60_000).toISOString()
    : null

  const ctx = insight.campaign_type_context ?? ''
  const kw = insight.query_keyword ?? ''

  // PostgreSQL'in expression unique index'i COALESCE(...) ile çalıştığı için
  // upsert'in "onConflict" alanını kullanmak yerine select+update/insert pattern'ini izliyoruz.
  const { data: existing, error: selErr } = await supabase
    .from('yoai_competitor_insights')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', insight.platform)
    .eq('source', insight.source)
    .eq('campaign_type_context', insight.campaign_type_context ?? null)
    .eq('query_keyword', insight.query_keyword ?? null)
    .maybeSingle()

  if (selErr && selErr.code !== 'PGRST116') {
    if (isTableMissingError(selErr)) {
      logTableMissing('upsertCompetitorInsight.select', { userId, platform: insight.platform })
      return null
    }
    console.error('[CompetitorInsightStore] select error:', selErr)
    return null
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    platform: insight.platform,
    source: insight.source,
    campaign_type_context: insight.campaign_type_context,
    query_keyword: insight.query_keyword,
    ads_count: insight.ads_count,
    active_advertisers_count: insight.active_advertisers_count,
    top_hooks: insight.top_hooks,
    top_ctas: insight.top_ctas,
    top_value_props: insight.top_value_props,
    common_phrases: insight.common_phrases,
    creative_patterns: insight.creative_patterns,
    offer_patterns: insight.offer_patterns,
    publisher_distribution: insight.publisher_distribution,
    competitor_summary: insight.competitor_summary,
    confidence: insight.confidence,
    raw_ad_ids: insight.raw_ad_ids,
    metadata: insight.metadata,
    generated_at: nowIso,
    expires_at: expiresAt,
    updated_at: nowIso,
  }
  // ctx/kw'yi log'da gözükmesi için ayrıca tutmuyoruz — alanlar zaten payload'da.
  void ctx
  void kw

  if (existing?.id) {
    const { data, error } = await supabase
      .from('yoai_competitor_insights')
      .update(payload)
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) {
      if (isTableMissingError(error)) {
        logTableMissing('upsertCompetitorInsight.update')
        return null
      }
      console.error('[CompetitorInsightStore] update error:', error)
      return null
    }
    return data as { id: string }
  }

  const { data, error } = await supabase
    .from('yoai_competitor_insights')
    .insert(payload)
    .select('id')
    .single()
  if (error) {
    if (isTableMissingError(error)) {
      logTableMissing('upsertCompetitorInsight.insert')
      return null
    }
    console.error('[CompetitorInsightStore] insert error:', error)
    return null
  }
  return data as { id: string }
}

/* ──────────────────────────────────────────────────────────
   getLatestCompetitorInsight
   Filtreli "en güncel" snapshot. NULL filtreler için
   campaign_type_context/query_keyword 'NULL' olarak da eşleşir.
   ────────────────────────────────────────────────────────── */
export async function getLatestCompetitorInsight(
  userId: string,
  filters: {
    platform?: string
    source?: string
    campaign_type_context?: string | null
    query_keyword?: string | null
  } = {},
): Promise<CompetitorInsightRow | null> {
  if (!supabase || !userId) return null

  let q = supabase
    .from('yoai_competitor_insights')
    .select('*')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(1)

  if (filters.platform) q = q.eq('platform', filters.platform)
  if (filters.source) q = q.eq('source', filters.source)
  if (filters.campaign_type_context !== undefined) {
    if (filters.campaign_type_context === null) q = q.is('campaign_type_context', null)
    else q = q.eq('campaign_type_context', filters.campaign_type_context)
  }
  if (filters.query_keyword !== undefined) {
    if (filters.query_keyword === null) q = q.is('query_keyword', null)
    else q = q.eq('query_keyword', filters.query_keyword)
  }

  const { data, error } = await q.maybeSingle()
  if (error) {
    if (isTableMissingError(error)) {
      logTableMissing('getLatestCompetitorInsight')
      return null
    }
    if (error.code !== 'PGRST116') {
      console.error('[CompetitorInsightStore] get error:', error)
    }
    return null
  }
  return (data as CompetitorInsightRow) || null
}

/* ──────────────────────────────────────────────────────────
   buildCompetitorContextForPrompt
   AI proposal generator için kompakt, prompt-safe metin.
   Mevcut insight yoksa null döner — adCreator burayı
   "competitor insight unavailable" olarak ele alabilir.
   ────────────────────────────────────────────────────────── */
export async function buildCompetitorContextForPrompt(
  userId: string,
  campaignTypeContext?: string | null,
  queryKeyword?: string | null,
  options?: { platform?: string; maxChars?: number },
): Promise<string | null> {
  const platform = options?.platform || 'meta'
  const maxChars = options?.maxChars ?? 1200

  // 1) En spesifik kombinasyon: campaign_type + keyword
  let insight = await getLatestCompetitorInsight(userId, {
    platform,
    campaign_type_context: campaignTypeContext ?? undefined,
    query_keyword: queryKeyword ?? undefined,
  })

  // 2) Sadece campaign_type
  if (!insight && campaignTypeContext) {
    insight = await getLatestCompetitorInsight(userId, {
      platform,
      campaign_type_context: campaignTypeContext,
    })
  }

  // 3) Sadece platform
  if (!insight) {
    insight = await getLatestCompetitorInsight(userId, { platform })
  }

  if (!insight || insight.ads_count === 0) return null

  const lines: string[] = []
  lines.push(`Rakip reklam içgörüsü (kayıt: ${insight.generated_at.slice(0, 10)}, güven: ${insight.confidence}/100):`)
  lines.push(`- Analiz edilen reklam: ${insight.ads_count}, farklı reklamveren: ${insight.active_advertisers_count}`)
  if (insight.top_hooks.length > 0) {
    lines.push(`- Sık hook'lar: ${insight.top_hooks.slice(0, 5).map((h) => `${h.token}(${h.count})`).join(', ')}`)
  }
  if (insight.top_ctas.length > 0) {
    lines.push(`- Sık CTA'lar: ${insight.top_ctas.slice(0, 5).map((c) => `${c.cta}(${c.count})`).join(', ')}`)
  }
  if (insight.top_value_props.length > 0) {
    lines.push(`- Sık value-prop'lar: ${insight.top_value_props.slice(0, 5).map((v) => v.token).join(', ')}`)
  }
  if (insight.offer_patterns.length > 0) {
    lines.push(`- Tekrar eden teklifler: ${insight.offer_patterns.slice(0, 5).map((o) => o.token).join(', ')}`)
  }
  if (insight.common_phrases.length > 0) {
    lines.push(`- Yaygın ifadeler: ${insight.common_phrases.slice(0, 5).join(', ')}`)
  }

  const text = lines.join('\n')
  return text.length > maxChars ? text.slice(0, maxChars) + '…' : text
}
