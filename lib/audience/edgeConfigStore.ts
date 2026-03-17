/**
 * Edge Config store for prebuilt audience dataset.
 * Read: @vercel/edge-config (fast, CDN-backed)
 * Write: Vercel REST API (admin refresh only)
 *
 * Env required:
 *   - EDGE_CONFIG or AUDIENCE_EDGE_CONFIG: connection string for reads
 *   - VERCEL_API_TOKEN, AUDIENCE_EDGE_CONFIG_ID: for admin write
 *
 * Size: Keep dataset <512KB (Enterprise limit).
 */

import { createClient } from '@vercel/edge-config'
import type { AudienceDataset, AudienceDatasetMeta } from '@/lib/audience/types'

const EDGE_CONFIG_KEY = 'audience_dataset'

function getConnectionString(): string | null {
  return process.env.EDGE_CONFIG ?? process.env.AUDIENCE_EDGE_CONFIG ?? null
}

/**
 * Returns true if Edge Config connection is configured.
 * Does NOT check whether dataset is populated.
 */
export function isEdgeConfigConfigured(): boolean {
  return !!getConnectionString()
}

/**
 * Returns true when dataset is ready (Edge Config configured and dataset present).
 * Async because it performs a lightweight read.
 */
export async function isAudienceDatasetReady(): Promise<boolean> {
  const ds = await getAudienceDataset()
  return ds !== null && (ds.browseTree?.affinity?.length ?? 0) + (ds.browseTree?.inMarket?.length ?? 0) > 0
}

/** Read dataset from Edge Config. Returns null if config missing, key empty, or error. */
export async function getAudienceDataset(): Promise<AudienceDataset | null> {
  const conn = getConnectionString()
  if (!conn) {
    console.log('[AUDIENCE_EDGE_CONFIG_MISSING] EDGE_CONFIG or AUDIENCE_EDGE_CONFIG not set')
    return null
  }

  const start = Date.now()
  try {
    const client = createClient(conn)
    const data = await client.get<AudienceDataset>(EDGE_CONFIG_KEY)
    const elapsed = Date.now() - start

    if (data && typeof data === 'object' && data.browseTree) {
      const size = JSON.stringify(data).length
      console.log(`[AUDIENCE_EDGE_READ_OK] elapsed=${elapsed}ms size=${size} nodes=${data.stats?.totalNodes ?? 0}`)
      return data
    }

    console.log(`[AUDIENCE_EDGE_READ_MISS] elapsed=${elapsed}ms key=${EDGE_CONFIG_KEY} (empty or not populated)`)
    return null
  } catch (e: unknown) {
    const elapsed = Date.now() - start
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[AUDIENCE_EDGE_READ_FAIL] elapsed=${elapsed}ms error=${msg}`)
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

/** Write dataset to Edge Config via Vercel API. Admin/refresh only. */
export async function setAudienceDataset(dataset: AudienceDataset): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.VERCEL_API_TOKEN
  const configId = process.env.AUDIENCE_EDGE_CONFIG_ID
  if (!token || !configId) {
    const msg = 'VERCEL_API_TOKEN and AUDIENCE_EDGE_CONFIG_ID required for audience refresh'
    console.error('[AUDIENCE_REFRESH_FAIL]', msg)
    return { ok: false, error: msg }
  }
  const payload = JSON.stringify(dataset)
  if (payload.length > 450_000) {
    const msg = `Dataset too large: ${payload.length} bytes (Edge Config limit ~512KB)`
    console.error('[AUDIENCE_REFRESH_FAIL]', msg)
    return { ok: false, error: msg }
  }
  const start = Date.now()
  try {
    const teamId = process.env.VERCEL_TEAM_ID
    const url = teamId
      ? `https://api.vercel.com/v1/edge-config/${configId}/items?teamId=${teamId}`
      : `https://api.vercel.com/v1/edge-config/${configId}/items`
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ operation: 'upsert' as const, key: EDGE_CONFIG_KEY, value: dataset }],
      }),
    })
    const elapsed = Date.now() - start
    if (!res.ok) {
      const body = await res.text()
      console.error(`[AUDIENCE_REFRESH_FAIL] ${res.status} elapsed=${elapsed}ms`, body)
      return { ok: false, error: `${res.status}: ${body}` }
    }
    console.log(`[AUDIENCE_REFRESH_SUCCESS] elapsed=${elapsed}ms nodes=${dataset.stats.totalNodes} size=${payload.length}`)
    return { ok: true }
  } catch (e: unknown) {
    const elapsed = Date.now() - start
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[AUDIENCE_REFRESH_FAIL] elapsed=${elapsed}ms`, msg)
    return { ok: false, error: msg }
  }
}
