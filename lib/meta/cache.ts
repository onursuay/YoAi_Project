// In-memory cache for Meta API responses
// Cache key: platform_accountId_datePreset_entityLevel
// TTL: 60 seconds

interface CacheEntry {
  data: any
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 60 * 1000 // 60 seconds

export function getCacheKey(
  platform: string,
  accountId: string,
  datePreset: string | null,
  entityLevel?: string
): string {
  const parts = [platform, accountId, datePreset || 'default']
  if (entityLevel) parts.push(entityLevel)
  return parts.join('_')
}

export function getCached(key: string): any | null {
  const entry = cache.get(key)
  if (!entry) return null

  const age = Date.now() - entry.timestamp
  if (age > CACHE_TTL) {
    cache.delete(key)
    return null
  }

  return entry.data
}

export function setCached(key: string, data: any): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  })
}

// Cleanup old entries periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        cache.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}
