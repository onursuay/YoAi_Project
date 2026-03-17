/**
 * Edge Config store for prebuilt audience dataset.
 * Uses gzip compression to stay under 512KB total store limit.
 *
 * Key: audience_dataset - compressed payload { _z: 1, d: "<base64-gzip>" }
 *
 * Read: @vercel/edge-config (fast, CDN-backed)
 * Write: Vercel REST API (admin refresh only)
 */

import { gzipSync, gunzipSync } from 'node:zlib'
import { createClient } from '@vercel/edge-config'
import type { AudienceDataset, AudienceDatasetMeta } from '@/lib/audience/types'

const KEY = 'audience_dataset'
const MAX_BYTES = 450_000 // safe margin under 512KB total store

interface CompressedPayload {
  _z: 1
  d: string
}

function getConnectionString(): string | null {
  return process.env.EDGE_CONFIG ?? process.env.AUDIENCE_EDGE_CONFIG ?? null
}

export function isEdgeConfigConfigured(): boolean {
  return !!getConnectionString()
}

export async function isAudienceDatasetReady(): Promise<boolean> {
  const tree = await getAudienceBrowseTree()
  return tree !== null && (tree.affinity?.length ?? 0) + (tree.inMarket?.length ?? 0) > 0
}

/** Read and decompress dataset from Edge Config. */
export async function getAudienceDataset(): Promise<AudienceDataset | null> {
  const conn = getConnectionString()
  if (!conn) {
    console.log('[AUDIENCE_EDGE_CONFIG_MISSING] EDGE_CONFIG or AUDIENCE_EDGE_CONFIG not set')
    return null
  }
  const start = Date.now()
  try {
    const client = createClient(conn)
    const raw = await client.get<CompressedPayload | AudienceDataset>(KEY)
    if (!raw) {
      console.log(`[AUDIENCE_EDGE_READ_MISS] elapsed=${Date.now() - start}ms key=${KEY}`)
      return null
    }
    let data: AudienceDataset
    if (typeof raw === 'object' && '_z' in raw && raw._z === 1 && typeof raw.d === 'string') {
      const buf = Buffer.from(raw.d, 'base64')
      const decompressed = gunzipSync(buf)
      data = JSON.parse(decompressed.toString('utf8'))
    } else if (typeof raw === 'object' && 'browseTree' in raw) {
      data = raw as AudienceDataset
    } else {
      return null
    }
    const elapsed = Date.now() - start
    const size = JSON.stringify(data).length
    console.log(`[AUDIENCE_EDGE_READ_OK] elapsed=${elapsed}ms decompressed=${size}`)
    return data
  } catch (e: unknown) {
    const elapsed = Date.now() - start
    console.error(`[AUDIENCE_EDGE_READ_FAIL] elapsed=${elapsed}ms`, e instanceof Error ? e.message : String(e))
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

/** Write compressed dataset to Edge Config. */
export async function setAudienceDataset(dataset: AudienceDataset): Promise<{ ok: boolean; error?: string; storedBytes?: number }> {
  const token = process.env.VERCEL_API_TOKEN
  const configId = process.env.AUDIENCE_EDGE_CONFIG_ID
  if (!token || !configId) {
    const msg = 'VERCEL_API_TOKEN and AUDIENCE_EDGE_CONFIG_ID required for audience refresh'
    console.error('[AUDIENCE_REFRESH_FAIL]', msg)
    return { ok: false, error: msg }
  }

  const jsonStr = JSON.stringify(dataset)
  const rawSize = jsonStr.length
  const compressed = gzipSync(Buffer.from(jsonStr, 'utf8'))
  const base64 = compressed.toString('base64')
  const payload: CompressedPayload = { _z: 1, d: base64 }
  const storedSize = JSON.stringify(payload).length

  console.log(`[AUDIENCE_PAYLOAD] raw=${rawSize} compressed=${compressed.length} base64=${storedSize} bytes`)

  if (storedSize > MAX_BYTES) {
    const msg = `Compressed payload too large: ${storedSize} bytes (limit ${MAX_BYTES})`
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
        items: [{ operation: 'upsert' as const, key: KEY, value: payload }],
      }),
    })
    const elapsed = Date.now() - start
    if (!res.ok) {
      const body = await res.text()
      console.error(`[AUDIENCE_REFRESH_FAIL] ${res.status} elapsed=${elapsed}ms`, body)
      return { ok: false, error: `${res.status}: ${body}` }
    }
    console.log(`[AUDIENCE_REFRESH_SUCCESS] elapsed=${elapsed}ms nodes=${dataset.stats.totalNodes} stored=${storedSize}`)
    return { ok: true, storedBytes: storedSize }
  } catch (e: unknown) {
    const elapsed = Date.now() - start
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[AUDIENCE_REFRESH_FAIL] elapsed=', elapsed, msg)
    return { ok: false, error: msg }
  }
}
