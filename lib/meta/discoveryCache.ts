/**
 * Meta Discovery cache — Supabase/Postgres (REST API).
 * 24h TTL per key. Optional: if env not set, cache is skipped.
 */

const CACHE_TTL_HOURS = 24

export interface CachedPatch {
  requiredFieldsAdded: string[]
  invalidCombination?: boolean
  notes?: string
  meta_error?: Record<string, unknown>
}

function getSupabaseConfig(): { url: string; serviceKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return { url: url.replace(/\/$/, ''), serviceKey: key }
}

export async function getDiscoveryCached(cacheKey: string): Promise<CachedPatch | null> {
  const config = getSupabaseConfig()
  if (!config) return null
  try {
    const res = await fetch(
      `${config.url}/rest/v1/meta_discovery_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=spec_patch,cached_at`,
      {
        headers: {
          apikey: config.serviceKey,
          Authorization: `Bearer ${config.serviceKey}`,
          'Content-Type': 'application/json',
        },
      }
    )
    if (!res.ok) return null
    const rows = await res.json()
    const row = Array.isArray(rows) ? rows[0] : null
    if (!row?.spec_patch) return null
    const cachedAt = row.cached_at ? new Date(row.cached_at).getTime() : 0
    if (Date.now() - cachedAt > CACHE_TTL_HOURS * 60 * 60 * 1000) return null
    return row.spec_patch as CachedPatch
  } catch {
    return null
  }
}

export async function setDiscoveryCached(cacheKey: string, specPatch: CachedPatch): Promise<void> {
  const config = getSupabaseConfig()
  if (!config) return
  try {
    await fetch(`${config.url}/rest/v1/meta_discovery_cache`, {
      method: 'POST',
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        cache_key: cacheKey,
        spec_patch: specPatch,
        cached_at: new Date().toISOString(),
      }),
    })
  } catch {
    // ignore
  }
}
