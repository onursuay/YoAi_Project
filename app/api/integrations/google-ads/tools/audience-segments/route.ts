import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import {
  searchAllAudiences,
  browseAllAudiences,
  listUserInterests,
  type AudienceSegment,
} from '@/lib/google-ads/audience-segments'
import {
  translateAudienceName,
  translateSegmentsBatch,
  findEnglishTermsForSearch,
} from '@/lib/google-ads/audience-translations'

/* ── In-memory browse cache (fastest layer, lost on restart) ── */
const browseCache = new Map<string, { data: any; timestamp: number }>()
const BROWSE_MEMORY_TTL = 60 * 60 * 1000 // 1 hour

/* ── File-based browse response cache (persists across restarts) ──
 * After the first successful browse+translate, the FULL translated response
 * is saved to a JSON file. Subsequent requests read from this file instantly.
 * OpenAI is only called when the file cache is missing or expired (24h). */
const BROWSE_CACHE_DIR = '/tmp/audience-cache'
const BROWSE_FILE_TTL = 24 * 60 * 60 * 1000 // 24 hours

function getBrowseCachePath(customerId: string, locale: string): string {
  return resolve(BROWSE_CACHE_DIR, `audience-browse-${customerId}-${locale}.json`)
}

function loadBrowseFileCache(customerId: string, locale: string): any | null {
  try {
    const filePath = getBrowseCachePath(customerId, locale)
    if (!existsSync(filePath)) return null
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
    if (raw?._timestamp && Date.now() - raw._timestamp < BROWSE_FILE_TTL) {
      const { _timestamp, ...data } = raw
      return data
    }
    return null // expired
  } catch {
    return null
  }
}

function saveBrowseFileCache(customerId: string, locale: string, data: any): void {
  try {
    if (!existsSync(BROWSE_CACHE_DIR)) {
      mkdirSync(BROWSE_CACHE_DIR, { recursive: true })
    }
    const filePath = getBrowseCachePath(customerId, locale)
    writeFileSync(filePath, JSON.stringify({ ...data, _timestamp: Date.now() }, null, 2))
    console.log(`[audience-segments] Browse response cache saved: ${filePath}`)
  } catch (e) {
    console.error('[audience-segments] Browse cache write failed:', e)
  }
}

/**
 * GET /api/integrations/google-ads/tools/audience-segments
 *
 * Query params:
 *   mode=search&q=keyword     — search all audience types by keyword
 *   mode=browse               — browse all categories (top-level)
 *   mode=children&type=AFFINITY|IN_MARKET&parent=resourceName — get children of a category
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const cookieStore = await cookies()
    const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr'
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode') ?? 'browse'

    if (mode === 'search') {
      const q = searchParams.get('q') ?? ''
      if (q.length < 2) return NextResponse.json({ results: [] })

      let results: AudienceSegment[] = []

      if (locale === 'tr') {
        // Turkish flow: first check dictionary/OpenAI, then search with English terms only
        const englishTerms = await findEnglishTermsForSearch(q)

        if (englishTerms.length > 0) {
          // Search Google Ads with English terms (max 5 parallel)
          const uniqueTerms = englishTerms
            .map(t => t.toLowerCase().trim())
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 5)

          const batches = await Promise.all(
            uniqueTerms.map(term => searchAllAudiences(ctx, term).catch(() => []))
          )

          // Deduplicate results
          const seen = new Set<string>()
          for (const batch of batches) {
            for (const item of batch) {
              const key = `${item.category}-${item.id}`
              if (!seen.has(key)) {
                results.push(item)
                seen.add(key)
              }
            }
          }
        } else {
          // No English terms found — fallback to direct query
          results = await searchAllAudiences(ctx, q)
        }
      } else {
        // Non-Turkish: search directly with original query
        results = await searchAllAudiences(ctx, q)
      }

      const translated = await translateSegments(results, locale)
      return NextResponse.json({ results: translated }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (mode === 'children') {
      const type = (searchParams.get('type') ?? 'AFFINITY') as 'AFFINITY' | 'IN_MARKET'
      const parent = searchParams.get('parent') ?? undefined
      const results = await listUserInterests(ctx, type, parent)
      const translated = await translateSegments(results, locale)
      return NextResponse.json({ results: translated }, { headers: { 'Cache-Control': 'no-store' } })
    }

    // ── mode=browse — 3-layer cache: memory → file → Google API + OpenAI ──

    const cacheKey = `${ctx.customerId}:${locale}`
    const forceRefresh = searchParams.get('refresh') === 'true'

    if (!forceRefresh) {
      // Layer 1: In-memory cache (fastest, lost on restart)
      const memCached = browseCache.get(cacheKey)
      if (memCached && Date.now() - memCached.timestamp < BROWSE_MEMORY_TTL) {
        return NextResponse.json(memCached.data, {
          headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=1800' },
        })
      }
    }

    // Layer 2: File cache (fast, persists across restarts, 24h TTL)
    const fileData = !forceRefresh ? loadBrowseFileCache(ctx.customerId, locale) : null
    if (fileData) {
      console.log('[audience-segments] Browse loaded from file cache (instant)')
      // Populate memory cache too
      browseCache.set(cacheKey, { data: fileData, timestamp: Date.now() })
      return NextResponse.json(fileData, {
        headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=1800' },
      })
    }

    // Layer 3: Full fetch from Google API + translate via OpenAI
    // This only runs on first-ever browse or after 24h cache expiry
    console.log('[audience-segments] Cache miss — fetching from Google API + OpenAI translation...')
    const data = await browseAllAudiences(ctx)

    // Collect ALL names from all categories for a single batch translation
    const allTranslatableNames = [
      ...data.affinity.map(s => s.name),
      ...data.inMarket.map(s => s.name),
      ...data.detailedDemographics.map(s => s.name),
      ...data.lifeEvents.map(s => s.name),
    ]

    // Try OpenAI batch translation — but NEVER block data from being returned
    // If OpenAI fails/times out, data is still returned with STATIC_TR translations
    if (locale === 'tr') {
      try {
        // Overall 45-second timeout for all OpenAI work
        const translationPromise = translateSegmentsBatch(allTranslatableNames, locale)
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Translation overall timeout (45s)')), 45_000)
        )
        await Promise.race([translationPromise, timeoutPromise])
        console.log('[audience-segments] OpenAI translation completed successfully')
      } catch (translationError: any) {
        console.error('[audience-segments] OpenAI translation failed/timed-out, returning with available translations:', translationError.message)
        // Continue — STATIC_TR + dynamicCache translations will still be applied
      }
    }

    // Apply cached translations (STATIC_TR + whatever OpenAI managed to translate)
    const applyTranslation = (segments: AudienceSegment[]) =>
      locale === 'tr'
        ? segments.map(s => ({ ...s, name: translateAudienceName(s.name, locale) }))
        : segments

    const responseData = {
      affinity: applyTranslation(data.affinity),
      inMarket: applyTranslation(data.inMarket),
      detailedDemographics: applyTranslation(data.detailedDemographics),
      lifeEvents: applyTranslation(data.lifeEvents),
      userLists: data.userLists, // User-created — no translation needed
      customAudiences: data.customAudiences, // User-created
      combinedAudiences: data.combinedAudiences, // User-created
    }

    // Save to both caches
    browseCache.set(cacheKey, { data: responseData, timestamp: Date.now() })
    saveBrowseFileCache(ctx.customerId, locale, responseData)

    return NextResponse.json(responseData, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=1800' },
    })
  } catch (e: any) {
    console.error('[audience-segments]', e.message)
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}

/** Apply locale translation — calls OpenAI only for unknown names, results are cached permanently */
async function translateSegments(segments: AudienceSegment[], locale: string): Promise<AudienceSegment[]> {
  if (locale !== 'tr') return segments

  // Batch translate: only sends unknown names to OpenAI, rest comes from cache (instant)
  await translateSegmentsBatch(segments.map(s => s.name), locale)

  return segments.map(s => ({
    ...s,
    name: translateAudienceName(s.name, locale),
  }))
}
