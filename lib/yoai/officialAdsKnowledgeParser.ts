/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Official Ads Knowledge Parser (Alt-Proje B köprüsü)

   Değişen bir resmi doküman snapshot'ını AI ile "eyleme dönük
   kural değişikliği" taslaklarına çevirir ve official_ads_knowledge_items
   tablosuna review_required olarak yazar.

   GÜVENLİK: Hiçbir taslak otomatik canlıya geçmez (review_required).
   Admin onayı (officialAdsKnowledgeStore.approveKnowledgeItem) gerekir.
   ────────────────────────────────────────────────────────── */

import { claudeJson, isClaudeReady, type ClaudeTextArgs } from '../anthropic/text'
import type { OfficialAdsSource } from './officialAdsDocsRefresh'
import type { OfficialAdsKnowledgeItem } from './officialAdsKnowledgeStore'

const MAX_DOC_CHARS = 16_000
const MIN_DOC_CHARS = 50

/** DB CHECK ile uyumlu geçerli kategoriler */
export const VALID_KNOWLEDGE_CATEGORIES = [
  'campaign_type',
  'objective',
  'bidding',
  'optimization_goal',
  'creative_rule',
  'policy',
  'api_version',
  'cta',
  'destination',
  'asset_rule',
  'compatibility_matrix',
] as const

export type ChangeType = 'new' | 'update' | 'deprecate'

export interface ParsedKnowledgeItem {
  category: string
  title: string
  normalized_key: string
  summary: string
  rules_json: Record<string, unknown> | null
  allowed_values: string[] | null
  forbidden_values: string[] | null
  change_type: ChangeType
  change_explanation: string
  confidence: number
}

type ApprovedHint = Pick<OfficialAdsKnowledgeItem, 'normalized_key' | 'title' | 'summary'>
type ParserSource = Pick<OfficialAdsSource, 'platform' | 'source_type' | 'title' | 'url'>

// ── Prompt ──────────────────────────────────────────────────────────────────

export function buildParserPrompt(
  normalizedText: string,
  source: ParserSource,
  existingApproved: ApprovedHint[],
): { system: string; user: string } {
  const existingList = existingApproved.length
    ? existingApproved.map((e) => `- ${e.normalized_key}: ${e.title} — ${e.summary ?? ''}`).join('\n')
    : '(yok)'

  const system = [
    'Sen Meta ve Google reklam platformlarının resmi dokümanlarını analiz eden bir uzmansın.',
    'Sana verilen resmi doküman metninden YALNIZCA eyleme dönük kural/parametre değişikliklerini çıkarırsın.',
    '',
    'KESİN KURALLAR:',
    '- SADECE verilen doküman metninden çıkar. Dış/ezber bilgi KULLANMA, hiçbir değer UYDURMA.',
    '- "summary" sade, kullanıcı dostu Türkçe ve eyleme dönük olmalı. Ham teknik enum (OUTCOME_SALES, MAXIMIZE_CONVERSIONS vb.) summary içinde GÖSTERME — enum yalnız "rules_json"/"allowed_values" içinde veri olarak yer alır.',
    '- "MEVCUT ONAYLI BİLGİLER" ile AYNI olanı tekrar üretme; yalnızca YENİ veya DEĞİŞEN kuralları döndür (delta).',
    '- Anlamlı bir değişiklik yoksa boş "items" dizisi döndür.',
    `- "category" şu değerlerden biri olmalı: ${VALID_KNOWLEDGE_CATEGORIES.join(', ')}.`,
    '- "normalized_key" formatı: "<platform>.<category>.<kebab_anahtar>" (örn. meta.objective.outcome_sales).',
    '- "change_type": new | update | deprecate. "change_explanation": kısa Türkçe gerekçe (örn. "Min bütçe 75→90 TL oldu").',
    '- "confidence": 0 ile 1 arası.',
    '',
    'Çıktı YALNIZ şu JSON: { "items": [ { category, title, normalized_key, summary, rules_json, allowed_values, forbidden_values, change_type, change_explanation, confidence } ] }',
  ].join('\n')

  const user = [
    `Platform: ${source.platform}`,
    `Kaynak türü: ${source.source_type}`,
    `Başlık: ${source.title}`,
    `URL: ${source.url}`,
    '',
    'MEVCUT ONAYLI BİLGİLER (bunları tekrar etme, yalnız delta):',
    existingList,
    '',
    'RESMİ DOKÜMAN METNİ:',
    normalizedText.slice(0, MAX_DOC_CHARS),
  ].join('\n')

  return { system, user }
}

// ── Parse (AI) ──────────────────────────────────────────────────────────────

export interface ParseDeps {
  callJson?: (args: ClaudeTextArgs) => Promise<unknown>
  claudeReady?: () => boolean
}

export async function parseSnapshotToKnowledge(
  params: { normalizedText: string; source: ParserSource; existingApproved: ApprovedHint[] },
  deps: ParseDeps = {},
): Promise<ParsedKnowledgeItem[]> {
  const ready = deps.claudeReady ?? isClaudeReady
  const call: (args: ClaudeTextArgs) => Promise<unknown> =
    deps.callJson ?? ((args) => claudeJson(args))
  if (!ready()) return []
  const text = (params.normalizedText || '').trim()
  if (text.length < MIN_DOC_CHARS) return []

  const { system, user } = buildParserPrompt(text, params.source, params.existingApproved)
  const raw = (await call({ system, user, maxTokens: 3500, temperature: 0.2 })) as {
    items?: ParsedKnowledgeItem[]
  } | null

  const items = raw?.items
  if (!Array.isArray(items)) return []

  return items.filter(
    (i): i is ParsedKnowledgeItem =>
      !!i &&
      typeof i.normalized_key === 'string' &&
      typeof i.title === 'string' &&
      typeof i.summary === 'string' &&
      (VALID_KNOWLEDGE_CATEGORIES as readonly string[]).includes(i.category),
  )
}

// ── Persist (versiyonlu + idempotent) ────────────────────────────────────────

/**
 * Taslakları official_ads_knowledge_items'a review_required olarak yazar.
 * - Idempotent: aynı normalized_key + source_hash için bekleyen taslak varsa atlar.
 * - Versiyonlu: mevcut max version + 1.
 * Eklenen taslak sayısını döndürür. Tablo yoksa / hata olursa 0 (job patlamaz).
 */
export async function persistKnowledgeDrafts(
  supabase: any,
  source: Pick<OfficialAdsSource, 'id' | 'platform'>,
  sourceHash: string,
  items: ParsedKnowledgeItem[],
): Promise<number> {
  if (!supabase || !items.length) return 0
  const now = new Date().toISOString()
  let created = 0

  for (const item of items) {
    try {
      // Idempotency: aynı key + hash için bekleyen taslak var mı?
      const { data: existing } = await supabase
        .from('official_ads_knowledge_items')
        .select('id')
        .eq('normalized_key', item.normalized_key)
        .eq('source_hash', sourceHash)
        .eq('review_status', 'review_required')
        .limit(1)
      if (Array.isArray(existing) && existing.length > 0) continue

      // Versiyon: mevcut max version
      const { data: versions } = await supabase
        .from('official_ads_knowledge_items')
        .select('version')
        .eq('normalized_key', item.normalized_key)
        .order('version', { ascending: false })
        .limit(1)
      const maxVersion =
        Array.isArray(versions) && versions[0] && typeof versions[0].version === 'number'
          ? versions[0].version
          : 0

      const { error } = await supabase.from('official_ads_knowledge_items').insert({
        platform: source.platform,
        category: item.category,
        title: item.title,
        normalized_key: item.normalized_key,
        summary: item.summary,
        rules_json: item.rules_json ?? null,
        allowed_values: item.allowed_values ?? null,
        forbidden_values: item.forbidden_values ?? null,
        source_id: source.id,
        source_hash: sourceHash,
        source_last_seen_at: now,
        confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.6)),
        review_status: 'review_required',
        version: maxVersion + 1,
        created_at: now,
      })
      if (!error) created++
    } catch {
      // tek item hatası diğerlerini engellemez
    }
  }

  return created
}
