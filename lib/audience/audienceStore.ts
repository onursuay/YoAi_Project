/**
 * Audience dataset store backed by Supabase.
 * Replaces Edge Config: no VERCEL_API_TOKEN, VERCEL_TEAM_ID, or AUDIENCE_EDGE_CONFIG_ID required.
 *
 * Read: audience_cache table (latest ready row by key)
 * Write: admin refresh upserts to audience_cache
 */

import { supabase } from '@/lib/supabase/client'
import type { AudienceDataset, AudienceDatasetMeta } from '@/lib/audience/types'

const DEFAULT_KEY = 'google_ads_audience_tr'

export function isAudienceStorageConfigured(): boolean {
  return !!supabase
}

export async function isAudienceDatasetReady(): Promise<boolean> {
  const tree = await getAudienceBrowseTree()
  return tree !== null && (tree.affinity?.length ?? 0) + (tree.inMarket?.length ?? 0) > 0
}

/** Read dataset from Supabase audience_cache. */
export async function getAudienceDataset(): Promise<AudienceDataset | null> {
  if (!supabase) {
    console.log('[AUDIENCE_SUPABASE_MISSING] Supabase client not configured')
    return null
  }
  const start = Date.now()
  try {
    const { data, error } = await supabase
      .from('audience_cache')
      .select('payload_json')
      .eq('key', DEFAULT_KEY)
      .eq('status', 'ready')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[AUDIENCE_SUPABASE_READ_FAIL]', error.message)
      return null
    }
    if (!data?.payload_json) {
      console.log(`[AUDIENCE_SUPABASE_READ_MISS] elapsed=${Date.now() - start}ms key=${DEFAULT_KEY}`)
      return null
    }
    const dataset = data.payload_json as unknown as AudienceDataset
    if (!dataset || typeof dataset !== 'object' || !('browseTree' in dataset)) {
      return null
    }
    const elapsed = Date.now() - start
    const size = JSON.stringify(dataset).length
    console.log(`[AUDIENCE_SUPABASE_READ_OK] elapsed=${elapsed}ms size=${size}`)
    return dataset
  } catch (e: unknown) {
    const elapsed = Date.now() - start
    console.error(`[AUDIENCE_SUPABASE_READ_FAIL] elapsed=${elapsed}ms`, e instanceof Error ? e.message : String(e))
    return null
  }
}

export async function getAudienceBrowseTree(): Promise<AudienceDataset['browseTree'] | null> {
  const ds = await getAudienceDataset()
  return ds?.browseTree ?? null
}

export async function getAudienceSearchIndex(): Promise<AudienceDataset['searchIndex'] | null> {
  const ds = await getAudienceDataset()
  return ds?.searchIndex ?? null
}

export async function getAudienceDatasetMeta(): Promise<AudienceDatasetMeta | null> {
  const ds = await getAudienceDataset()
  if (!ds) return null
  return {
    version: ds.version,
    updatedAt: ds.updatedAt,
    totalNodes: ds.stats.totalNodes,
    totalSearchTerms: ds.stats.totalSearchTerms,
  }
}

/** Write dataset to Supabase audience_cache. No Vercel token/team/config needed. */
export async function setAudienceDataset(
  dataset: AudienceDataset
): Promise<{ ok: boolean; error?: string; rawBytes?: number; storedBytes?: number }> {
  if (!supabase) {
    const msg = 'Supabase not configured — SUPABASE_URL and SUPABASE_SERVICE_KEY required'
    console.error('[AUDIENCE_REFRESH_FAIL]', msg)
    return { ok: false, error: msg }
  }

  const jsonStr = JSON.stringify(dataset)
  const rawBytes = jsonStr.length

  const row = {
    key: DEFAULT_KEY,
    payload_json: dataset as unknown as Record<string, unknown>,
    payload_gzip_base64: null,
    version: dataset.version,
    locale: dataset.locale ?? 'tr',
    status: 'ready',
    raw_bytes: rawBytes,
    stored_bytes: rawBytes,
    updated_at: new Date().toISOString(),
  }

  const start = Date.now()
  try {
    const { error } = await supabase
      .from('audience_cache')
      .upsert(row, { onConflict: 'key' })

    if (error) {
      const elapsed = Date.now() - start
      console.error('[AUDIENCE_REFRESH_FAIL]', error.message, 'elapsed=', elapsed)
      return { ok: false, error: error.message }
    }
    const elapsed = Date.now() - start
    console.log(`[AUDIENCE_REFRESH_SUCCESS] elapsed=${elapsed}ms nodes=${dataset.stats.totalNodes} rawBytes=${rawBytes} storage=supabase`)
    return { ok: true, rawBytes, storedBytes: rawBytes }
  } catch (e: unknown) {
    const elapsed = Date.now() - start
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[AUDIENCE_REFRESH_FAIL] elapsed=', elapsed, msg)
    return { ok: false, error: msg }
  }
}
