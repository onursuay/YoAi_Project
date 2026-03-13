/**
 * Meta list fetch: 10s TTL cache, adAccountId queue (concurrency=1), backoff+retry.
 * Used by campaigns, adsets, ads routes.
 */

import { isRateLimitError, extractFbTraceId } from './rateLimit'

const CACHE_TTL = 10_000 // 10s

declare global {
  // eslint-disable-next-line no-var
  var __metaListCache: Map<string, { exp: number; data: any }> | undefined
  // eslint-disable-next-line no-var
  var __metaLocks: Map<string, Promise<unknown>> | undefined
}

const cache = (globalThis.__metaListCache ??= new Map<string, { exp: number; data: any }>())
const locks = (globalThis.__metaLocks ??= new Map<string, Promise<unknown>>())

export function getListCacheKey(url: string, params: Record<string, string | null>, accountId: string): string {
  return `${url}:${JSON.stringify(params)}:${accountId}`
}

export function getListCached(key: string): any | null {
  const entry = cache.get(key)
  if (!entry || Date.now() > entry.exp) {
    if (entry) cache.delete(key)
    return null
  }
  return entry.data
}

export function setListCached(key: string, data: any): void {
  cache.set(key, { exp: Date.now() + CACHE_TTL, data })
}

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key)
  const run = async (): Promise<T> => {
    if (prev) await prev
    try {
      return await fn()
    } finally {
      locks.delete(key)
    }
  }
  const p = run()
  locks.set(key, p)
  return p
}

const BACKOFF_MS = [500, 1500, 3500]

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function fetchWithBackoff(
  fetchFn: () => Promise<Response>,
  maxAttempts: number = 3
): Promise<{ response: Response; errorData?: any; retryAfterMs?: number }> {
  let lastErrorData: any = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetchFn()
      if (response.ok) return { response }

      let errorData: any = {}
      try {
        const text = await response.text()
        if (text) {
          try {
            errorData = JSON.parse(text)
          } catch {
            errorData = { error: { message: text.substring(0, 200) } }
          }
        }
      } catch {
        // ignore
      }

      const isRateLimit =
        response.status === 429 ||
        isRateLimitError(errorData) ||
        (typeof errorData?.message === 'string' && errorData.message.toLowerCase().includes('rate limit'))

      if (isRateLimit && attempt < maxAttempts - 1) {
        const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]
        const jitter = Math.random() * 200
        const waitMs = base + jitter
        await sleep(waitMs)
        lastErrorData = errorData
        continue
      }

      if (isRateLimit) {
        const base = BACKOFF_MS[maxAttempts - 1] || 3500
        const retryAfterMs = base + Math.random() * 200
        return {
          response,
          errorData: errorData || lastErrorData,
          retryAfterMs,
        }
      }

      return { response, errorData }
    } catch (err) {
      if (attempt < maxAttempts - 1) {
        const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]
        await sleep(base + Math.random() * 200)
        continue
      }
      throw err
    }
  }

  return {
    response: new Response(null, { status: 429 }),
    errorData: lastErrorData,
    retryAfterMs: 4000,
  }
}

export { isRateLimitError, extractFbTraceId }
