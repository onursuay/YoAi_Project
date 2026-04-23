/**
 * GET /api/integrations/google-ads/tools/audience-segments
 *
 * SaaS per-user mimari:
 *   - Global taksonomi (affinity / in-market / detailed-demo / life-event) → tek ortak cache.
 *     Cache boşsa ilk kullanıcının credentials'ıyla OTO-İYİLEŞİR (global veri herkes için aynıdır).
 *   - Per-customer (user_list / custom_audience / combined_audience) → her request'te çağıran
 *     kullanıcının Google Ads hesabından CANLI çekilir. Cache'e asla yazılmaz.
 *
 * Query params:
 *   mode=search&q=keyword  — arama (server-side)
 *   mode=browse            — browse tree
 *
 * Kullanıcı Google Ads'e bağlı değilse ve cache boşsa "data_not_ready" döner.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAudienceDataset, setAudienceDataset } from '@/lib/audience/audienceStore'
import { getDevFallbackDataset } from '@/lib/audience/devFallback'
import { expandNode } from '@/lib/audience/types'
import { normalizeText, scoreMatch } from '@/lib/audience/normalize'
import type { AudienceBrowseTree, AudienceSearchItem, AudienceDataset } from '@/lib/audience/types'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import type { GoogleAdsRequestContext } from '@/lib/googleAdsAuth'
import { browseGlobalAudiences, browseUserAudiences } from '@/lib/google-ads/audience-segments'
import { buildAudienceDataset, buildPerCustomerAddenda } from '@/lib/audience/buildAudienceDataset'

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

/** Cache'i çağıranın credentials'ıyla oto-iyileştir — yalnızca global kategoriler. */
async function tryAutoHeal(ctx: GoogleAdsRequestContext): Promise<AudienceDataset | null> {
  const start = Date.now()
  try {
    const raw = await browseGlobalAudiences(ctx)
    const dataset = buildAudienceDataset(raw, 'tr')
    const writeResult = await setAudienceDataset(dataset)
    if (!writeResult.ok) {
      console.warn('[AUDIENCE_AUTOHEAL_WRITE_FAIL]', writeResult.error)
    }
    console.log(`[AUDIENCE_AUTOHEAL_OK] elapsed=${Date.now() - start}ms nodes=${dataset.stats.totalNodes}`)
    return dataset
  } catch (e: unknown) {
    console.warn(`[AUDIENCE_AUTOHEAL_FAIL] elapsed=${Date.now() - start}ms`, e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Kullanıcıya özel segmentleri canlı çek (best-effort) */
async function tryFetchPerCustomer(ctx: GoogleAdsRequestContext) {
  const start = Date.now()
  try {
    const seg = await browseUserAudiences(ctx)
    console.log(`[AUDIENCE_PER_CUSTOMER_OK] elapsed=${Date.now() - start}ms userLists=${seg.userLists.length} custom=${seg.customAudiences.length} combined=${seg.combinedAudiences.length}`)
    return seg
  } catch (e: unknown) {
    console.warn(`[AUDIENCE_PER_CUSTOMER_FAIL] elapsed=${Date.now() - start}ms`, e instanceof Error ? e.message : String(e))
    return { userLists: [], customAudiences: [], combinedAudiences: [] }
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode') ?? 'browse'

    // ── Çağıran kullanıcının Google Ads context'ini çöz ──
    let ctx: GoogleAdsRequestContext | null = null
    try {
      ctx = await getGoogleAdsContext()
    } catch {
      // Kullanıcı Google Ads'e bağlı değil — global cache yeterliyse onu döneriz.
    }

    // ── Global dataset: cache → yoksa oto-iyileşme ──
    let dataset: AudienceDataset | null = await getAudienceDataset()
    let source: 'supabase' | 'auto-heal' | 'dev-fallback' = 'supabase'

    if (!dataset && ctx) {
      const healed = await tryAutoHeal(ctx)
      if (healed) {
        dataset = healed
        source = 'auto-heal'
      }
    }

    if (!dataset && !isProduction) {
      const dev = getDevFallbackDataset()
      dataset = dev
      source = 'dev-fallback'
      console.log('[AUDIENCE_DEV_FALLBACK_ACTIVE] Using in-memory seeded dataset (dataset missing)')
    }

    // ── Per-customer: canlı çek (ctx varsa) ──
    const perCustomer = ctx
      ? await tryFetchPerCustomer(ctx)
      : { userLists: [], customAudiences: [], combinedAudiences: [] }

    const addenda = buildPerCustomerAddenda(perCustomer, 'tr')

    // ── mode=search ──
    if (mode === 'search') {
      const q = (searchParams.get('q') ?? '').trim()
      if (q.length < 2) {
        return NextResponse.json({ results: [], state: 'ok' })
      }

      const start = Date.now()

      const globalIndex = dataset?.searchIndex ?? []
      const mergedIndex: AudienceSearchItem[] = [...globalIndex, ...addenda.searchItems]

      if (mergedIndex.length === 0) {
        console.log(`[AUDIENCE_SEARCH] q="${q}" results=0 elapsed=${Date.now() - start}ms data_not_ready`)
        return NextResponse.json(notReadySearchResponse(), {
          headers: { 'Cache-Control': 'private, max-age=30' },
        })
      }

      const nq = normalizeText(q)
      const scored = mergedIndex
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

      console.log(`[AUDIENCE_SEARCH] q="${nq}" results=${results.length} elapsed=${Date.now() - start}ms source=${source} perCustomer=${addenda.searchItems.length}`)

      return NextResponse.json(
        { results, state: 'ok' },
        { headers: { 'Cache-Control': 'private, max-age=30' } }
      )
    }

    // ── mode=browse ──
    const tree: AudienceBrowseTree = dataset?.browseTree ?? {
      affinity: [], inMarket: [], detailedDemographics: [], lifeEvents: [],
      userLists: [], customAudiences: [], combinedAudiences: [],
    }

    const hasAnyGlobal = (tree.affinity.length + tree.inMarket.length + tree.detailedDemographics.length + tree.lifeEvents.length) > 0

    if (!hasAnyGlobal && addenda.userListsNodes.length === 0 && addenda.customAudiencesNodes.length === 0 && addenda.combinedAudiencesNodes.length === 0) {
      console.log('[AUDIENCE_BROWSE] data_not_ready (no dataset, no per-customer, user not connected)')
      return NextResponse.json(notReadyBrowseResponse(), {
        headers: { 'Cache-Control': 'private, max-age=30' },
      })
    }

    // Global kategoriler cache'ten, per-customer kategoriler canlıdan
    const mergedTree = {
      affinity: tree.affinity.map(expandNode),
      inMarket: tree.inMarket.map(expandNode),
      detailedDemographics: tree.detailedDemographics.map(expandNode),
      lifeEvents: tree.lifeEvents.map(expandNode),
      userLists: addenda.userListsNodes.map(expandNode),
      customAudiences: addenda.customAudiencesNodes.map(expandNode),
      combinedAudiences: addenda.combinedAudiencesNodes.map(expandNode),
    }

    return NextResponse.json(mergedTree, {
      // Per-customer kısım kişiye özel → private + short TTL
      headers: { 'Cache-Control': 'private, max-age=60' },
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
