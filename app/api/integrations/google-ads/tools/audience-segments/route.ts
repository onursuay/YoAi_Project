/**
 * GET /api/integrations/google-ads/tools/audience-segments
 *
 * Primary: Edge Config (prebuilt Turkish index) — near-instant.
 * Dev: In-memory fallback when NODE_ENV !== 'production' and Edge Config missing.
 * No OpenAI, no live Google Ads in request path.
 *
 * Query params:
 *   mode=search&q=keyword  — search (server-side)
 *   mode=browse            — browse tree
 *
 * When dataset not ready: returns data_not_ready: true, code: dataset_not_ready, empty results.
 * Never auto-refreshes, never calls OpenAI or Google Ads on user request.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getAudienceDataset,
  isEdgeConfigConfigured,
} from '@/lib/audience/edgeConfigStore'
import { getDevFallbackDataset } from '@/lib/audience/devFallback'
import { expandNode } from '@/lib/audience/types'
import { normalizeText, scoreMatch } from '@/lib/audience/normalize'
import type { AudienceBrowseTree, AudienceSearchItem } from '@/lib/audience/types'

const SEARCH_MAX = 30
const isProduction = process.env.NODE_ENV === 'production'

function notReadyBrowseResponse() {
  return {
    data_not_ready: true,
    code: 'dataset_not_ready' as const,
    affinity: [],
    inMarket: [],
    detailedDemographics: [],
    lifeEvents: [],
    userLists: [],
    customAudiences: [],
    combinedAudiences: [],
    state: 'data_not_ready' as const,
  }
}

function notReadySearchResponse() {
  return {
    results: [] as const,
    state: 'data_not_ready' as const,
    data_not_ready: true,
    code: 'dataset_not_ready' as const,
  }
}

function treeToBrowseResponse(tree: AudienceBrowseTree) {
  return {
    affinity: tree.affinity.map(expandNode),
    inMarket: tree.inMarket.map(expandNode),
    detailedDemographics: tree.detailedDemographics.map(expandNode),
    lifeEvents: tree.lifeEvents.map(expandNode),
    userLists: tree.userLists.map(expandNode),
    customAudiences: tree.customAudiences.map(expandNode),
    combinedAudiences: tree.combinedAudiences.map(expandNode),
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode') ?? 'browse'

    // ── Resolve data source: Edge Config or dev fallback (single read) ──
    let source: 'edge-config' | 'dev-fallback' = 'edge-config'
    let tree: AudienceBrowseTree | null = null
    let searchIndex: AudienceSearchItem[] | null = null

    const ds = await getAudienceDataset()
    if (ds) {
      tree = ds.browseTree
      searchIndex = ds.searchIndex
    } else if (!isProduction && !isEdgeConfigConfigured()) {
      const dev = getDevFallbackDataset()
      tree = dev.browseTree
      searchIndex = dev.searchIndex
      source = 'dev-fallback'
      console.log('[AUDIENCE_DEV_FALLBACK_ACTIVE] Using in-memory seeded dataset (Edge Config not configured)')
    }

    // ── mode=search ──
    if (mode === 'search') {
      const q = (searchParams.get('q') ?? '').trim()
      if (q.length < 2) {
        return NextResponse.json({ results: [], state: 'ok' })
      }

      const start = Date.now()

      if (!searchIndex || searchIndex.length === 0) {
        const elapsed = Date.now() - start
        console.log(`[AUDIENCE_SEARCH] normalizedQuery="" results=0 elapsed=${elapsed}ms source=none data_not_ready`)
        return NextResponse.json(notReadySearchResponse(), {
          headers: { 'Cache-Control': 'public, max-age=60' },
        })
      }

      const nq = normalizeText(q)
      const scored = searchIndex
        .filter(i => i.selectable)
        .map(item => ({ item, score: scoreMatch(nq, item) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, SEARCH_MAX)

      const results = scored.map(({ item }) => ({
        id: item.id,
        name: item.nameTr,
        category: item.category,
        resourceName: item.resourceName,
        parentId: item.parentId,
      }))

      const elapsed = Date.now() - start
      console.log(`[AUDIENCE_SEARCH] normalizedQuery="${nq}" results=${results.length} elapsed=${elapsed}ms source=${source}`)

      return NextResponse.json(
        { results, state: 'ok' },
        { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
      )
    }

    // ── mode=browse ──
    if (!tree) {
      console.log('[AUDIENCE_BROWSE] data_not_ready (no dataset)')
      return NextResponse.json(notReadyBrowseResponse(), {
        headers: { 'Cache-Control': 'public, max-age=60' },
      })
    }

    return NextResponse.json(treeToBrowseResponse(tree), {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=1800' },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[audience-segments]', msg)
    return NextResponse.json(
      { error: msg, data_not_ready: true, code: 'request_failed' },
      { status: (e as { status?: number })?.status ?? 500 }
    )
  }
}
