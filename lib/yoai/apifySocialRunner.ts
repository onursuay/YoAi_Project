/* ──────────────────────────────────────────────────────────
   YoAi — Apify Social Actor Runner

   Starts an Apify actor run, polls for completion, fetches
   dataset items. Handles timeout, rate-limit, and empty
   dataset as distinct error states. Token never logged.
   ────────────────────────────────────────────────────────── */

const APIFY_BASE = 'https://api.apify.com/v2'
const SYNC_TIMEOUT_MS = 90_000
const POLL_INTERVAL_MS = 3_000
const POLL_MAX = 25

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

function maskToken(url: string): string {
  return url.replace(/token=[^&]+/, 'token=***')
}

async function startRun(
  token: string,
  actorId: string,
  input: Record<string, unknown>,
): Promise<{ ok: true; runId: string; datasetId: string } | { ok: false; error: ApifyRunError; detail?: string }> {
  const url = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${token}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    clearTimeout(timer)
    if (res.status === 429) return { ok: false, error: 'apify_rate_limited' }
    if (!res.ok) return { ok: false, error: 'apify_run_failed', detail: `start_http_${res.status}` }
    const body = await res.json() as any
    const runId: string | undefined = body?.data?.id
    const datasetId: string | undefined = body?.data?.defaultDatasetId
    if (!runId) return { ok: false, error: 'apify_run_failed', detail: 'no_run_id' }
    return { ok: true, runId, datasetId: datasetId || '' }
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

async function pollUntilFinished(
  token: string,
  actorId: string,
  runId: string,
  deadlineMs: number,
): Promise<{ ok: true; datasetId: string } | { ok: false; error: ApifyRunError }> {
  const url = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs/${runId}?token=${token}`
  for (let i = 0; i < POLL_MAX; i++) {
    if (Date.now() > deadlineMs) return { ok: false, error: 'apify_timeout' }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const body = await res.json() as any
      const status: string = body?.data?.status || ''
      if (status === 'SUCCEEDED') {
        const datasetId: string = body?.data?.defaultDatasetId || ''
        return { ok: true, datasetId }
      }
      if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        return { ok: false, error: 'apify_run_failed' }
      }
      // RUNNING / READY → keep polling
    } catch {
      // transient poll error — keep trying
    }
  }
  return { ok: false, error: 'apify_timeout' }
}

async function fetchDatasetItems(
  token: string,
  datasetId: string,
  limit = 5,
): Promise<{ ok: true; items: unknown[] } | { ok: false; error: ApifyRunError }> {
  if (!datasetId) return { ok: false, error: 'apify_dataset_empty' }
  const url = `${APIFY_BASE}/datasets/${encodeURIComponent(datasetId)}/items?token=${token}&format=json&limit=${limit}`
  try {
    const res = await fetch(url)
    if (!res.ok) return { ok: false, error: 'apify_run_failed' }
    const items = await res.json()
    if (!Array.isArray(items) || items.length === 0) return { ok: false, error: 'apify_dataset_empty' }
    return { ok: true, items }
  } catch {
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

  void maskToken // ensure no URL with token is ever logged

  const deadline = Date.now() + SYNC_TIMEOUT_MS

  const startResult = await startRun(token, actorId, input)
  if (!startResult.ok) return startResult

  const pollResult = await pollUntilFinished(token, actorId, startResult.runId, deadline)
  if (!pollResult.ok) return pollResult

  const datasetId = pollResult.datasetId || startResult.datasetId
  return fetchDatasetItems(token, datasetId)
}
