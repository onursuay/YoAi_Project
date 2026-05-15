/* ──────────────────────────────────────────────────────────
   YoAi — Apify Social Actor Runner

   Apify actor ID encoding: slashes must be replaced with "~"
   (not URL-encoded). encodeURIComponent breaks actor IDs.
   Uses waitForFinish for synchronous response — avoids the
   90s polling loop that exceeds Vercel's 60s maxDuration.
   Token never logged.
   ────────────────────────────────────────────────────────── */

const APIFY_BASE = 'https://api.apify.com/v2'
// Apify waits synchronously up to this many seconds before returning.
// Must stay below Vercel maxDuration (60s) leaving buffer for dataset fetch.
const WAIT_FOR_FINISH_SECS = 50
const DATASET_TIMEOUT_MS = 8_000

export type ApifyRunError =
  | 'apify_token_missing'
  | 'apify_actor_missing'
  | 'apify_run_failed'
  | 'apify_dataset_empty'
  | 'apify_timeout'
  | 'apify_rate_limited'

export type ApifyRunResult =
  | { ok: true; items: unknown[] }
  | { ok: false; error: ApifyRunError; detail?: string }

// Apify API requires "/" in actor IDs to be replaced with "~", NOT URL-encoded.
// e.g. "apify/instagram-profile-scraper" → "apify~instagram-profile-scraper"
function encodeActorId(actorId: string): string {
  return actorId.replace(/\//g, '~')
}

async function fetchDatasetItems(
  token: string,
  datasetId: string,
  limit = 5,
): Promise<ApifyRunResult> {
  if (!datasetId) return { ok: false, error: 'apify_dataset_empty' }
  const url = `${APIFY_BASE}/datasets/${encodeURIComponent(datasetId)}/items?token=${token}&format=json&limit=${limit}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DATASET_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return { ok: false, error: 'apify_run_failed' }
    const items = await res.json()
    if (!Array.isArray(items) || items.length === 0) return { ok: false, error: 'apify_dataset_empty' }
    return { ok: true, items }
  } catch {
    clearTimeout(timer)
    return { ok: false, error: 'apify_run_failed' }
  }
}

export async function runApifyActor(
  token: string,
  actorId: string,
  input: Record<string, unknown>,
): Promise<ApifyRunResult> {
  if (!token) return { ok: false, error: 'apify_token_missing' }
  if (!actorId) return { ok: false, error: 'apify_actor_missing' }

  // waitForFinish: Apify holds the HTTP connection open until the run completes
  // or the timeout is reached — no polling loop needed.
  const url = `${APIFY_BASE}/acts/${encodeActorId(actorId)}/runs?token=${token}&waitForFinish=${WAIT_FOR_FINISH_SECS}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), (WAIT_FOR_FINISH_SECS + 8) * 1000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    clearTimeout(timer)

    if (res.status === 429) return { ok: false, error: 'apify_rate_limited' }
    if (!res.ok) return { ok: false, error: 'apify_run_failed', detail: `http_${res.status}` }

    const body = await res.json() as { data?: { status?: string; defaultDatasetId?: string } }
    const status = body?.data?.status ?? ''
    const datasetId = body?.data?.defaultDatasetId ?? ''

    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      return { ok: false, error: 'apify_run_failed', detail: `actor_status_${status.toLowerCase()}` }
    }

    // SUCCEEDED or still RUNNING (waitForFinish expired) — try to fetch whatever is in the dataset
    return fetchDatasetItems(token, datasetId)
  } catch (e) {
    clearTimeout(timer)
    const msg = e instanceof Error ? e.message : ''
    return {
      ok: false,
      error: msg.includes('abort') ? 'apify_timeout' : 'apify_run_failed',
      detail: msg.slice(0, 120),
    }
  }
}
