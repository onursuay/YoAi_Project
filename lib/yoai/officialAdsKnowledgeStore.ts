/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Official Ads Knowledge Store (Faz A)

   official_ads_knowledge_items tablosunu okur; tablo yoksa
   veya DB hatası olursa boş liste döndürür.
   adCreator.ts hardcoded fallback'i bu durumda devreye girer.

   Cache: 60 saniyelik modül-level in-memory önbellek.
   ────────────────────────────────────────────────────────── */

import { supabase } from '@/lib/supabase/client'

const TABLE_MIGRATION_HINT =
  'supabase/migrations/20260512000000_create_official_ads_knowledge_base.sql'

export interface OfficialAdsKnowledgeItem {
  id: string
  platform: 'google' | 'meta'
  category: string
  title: string
  normalized_key: string
  summary: string | null
  rules_json: Record<string, unknown> | null
  allowed_values: string[] | null
  forbidden_values: string[] | null
  compatibility_json: Record<string, unknown> | null
  source_id: string | null
  source_url: string | null
  source_hash: string | null
  source_last_seen_at: string | null
  effective_from: string | null
  effective_to: string | null
  confidence: number
  review_status: 'approved' | 'review_required' | 'draft' | 'deprecated' | 'auto_approved'
  approved_by: string | null
  approved_at: string | null
  version: number
  created_at: string
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000

let cachedItems: OfficialAdsKnowledgeItem[] | null = null
let cacheLoadedAt = 0
let warnedTableMissing = false

function isCacheValid(): boolean {
  return cachedItems !== null && Date.now() - cacheLoadedAt < CACHE_TTL_MS
}

function isTableMissingError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  return err.code === '42P01' || /relation .* does not exist/i.test(err.message || '')
}

// ── DB Loader ─────────────────────────────────────────────────────────────────

async function loadFromDB(): Promise<OfficialAdsKnowledgeItem[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('official_ads_knowledge_items')
    .select('*')
    .in('review_status', ['approved', 'auto_approved'])
    .is('effective_to', null)
    .order('platform')
    .order('category')

  if (error) {
    if (isTableMissingError(error)) {
      if (!warnedTableMissing) {
        console.warn(
          `[OfficialAdsKnowledge] official_ads_knowledge_items tablosu yok — ` +
            `adCreator.ts hardcoded fallback kullanılacak. ` +
            `Migration uygulayın: ${TABLE_MIGRATION_HINT}`,
        )
        warnedTableMissing = true
      }
      return []
    }
    console.error('[OfficialAdsKnowledge] list error:', error)
    return []
  }

  return (data || []) as OfficialAdsKnowledgeItem[]
}

// ── Cache Management ──────────────────────────────────────────────────────────

export function clearKnowledgeCache(): void {
  cachedItems = null
  cacheLoadedAt = 0
}

export async function refreshKnowledgeCache(): Promise<void> {
  try {
    const items = await loadFromDB()
    cachedItems = items
    cacheLoadedAt = Date.now()
  } catch (e) {
    console.error('[OfficialAdsKnowledge] cache refresh failed:', e)
    if (cachedItems === null) cachedItems = []
    cacheLoadedAt = Date.now()
  }
}

// ── Internal helper ───────────────────────────────────────────────────────────

async function ensureCache(): Promise<OfficialAdsKnowledgeItem[]> {
  if (!isCacheValid()) await refreshKnowledgeCache()
  return cachedItems ?? []
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listOfficialAdsKnowledge(params?: {
  platform?: 'google' | 'meta'
  category?: string
}): Promise<OfficialAdsKnowledgeItem[]> {
  let items = await ensureCache()
  if (params?.platform) items = items.filter(i => i.platform === params.platform)
  if (params?.category) items = items.filter(i => i.category === params.category)
  return items
}

export async function getApprovedKnowledgeByPlatform(
  platform: 'google' | 'meta',
): Promise<OfficialAdsKnowledgeItem[]> {
  return listOfficialAdsKnowledge({ platform })
}

export async function getKnowledgeItem(
  normalizedKey: string,
): Promise<OfficialAdsKnowledgeItem | null> {
  const items = await ensureCache()
  return items.find(i => i.normalized_key === normalizedKey) ?? null
}

export async function getKnowledgeByCategory(
  platform: 'google' | 'meta',
  category: string,
): Promise<OfficialAdsKnowledgeItem[]> {
  return listOfficialAdsKnowledge({ platform, category })
}

export async function getKnowledgeSnapshotForProposal(
  platform: 'google' | 'meta',
  campaignTypeOrObjective: string,
): Promise<{
  objectives: OfficialAdsKnowledgeItem[]
  bidding: OfficialAdsKnowledgeItem[]
  creative: OfficialAdsKnowledgeItem[]
}> {
  const all = await getApprovedKnowledgeByPlatform(platform)
  const keyFragment = campaignTypeOrObjective.toLowerCase().replace(/_/g, '.')
  return {
    objectives: all.filter(
      i =>
        (i.category === 'objective' || i.category === 'campaign_type') &&
        i.normalized_key.includes(keyFragment),
    ),
    bidding: all.filter(i => i.category === 'bidding'),
    creative: all.filter(i => i.category === 'creative_rule' || i.category === 'asset_rule'),
  }
}
