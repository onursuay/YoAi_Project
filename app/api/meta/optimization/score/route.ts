import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'
import { getCacheKey, getCached, setCached } from '@/lib/meta/cache'
import { normalizeInsights, emptyInsights } from '@/lib/meta/optimization/insightsNormalizer'
import { resolveKpiTemplate } from '@/lib/meta/optimization/kpiRegistry'
import { scoreCampaign } from '@/lib/meta/optimization/scoring'
import { evaluateAlerts } from '@/lib/meta/optimization/alertEngine'
import type { OptimizationCampaign, OptimizationAdset, CampaignTriple } from '@/lib/meta/optimization/types'
import { getDefaultOptimizationGoal, getAllowedDestinations } from '@/lib/meta/spec/objectiveSpec'

export const dynamic = 'force-dynamic'

const DEBUG = process.env.NODE_ENV !== 'production'

// All insight fields needed for the full KPI system
const INSIGHT_FIELDS = [
  'campaign_id',
  'spend', 'impressions', 'reach', 'frequency',
  'cpm', 'cpc', 'ctr', 'clicks',
  'inline_link_clicks', 'unique_clicks', 'unique_ctr',
  'actions', 'action_values', 'cost_per_action_type',
  'video_thruplay_watched_actions', 'video_avg_time_watched_actions',
  'video_p25_watched_actions', 'video_p50_watched_actions',
  'video_p75_watched_actions', 'video_p100_watched_actions',
  'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking',
  'website_purchase_roas', 'purchase_roas',
  'estimated_ad_recallers', 'cost_per_estimated_ad_recallers',
].join(',')

const ADSET_INSIGHT_FIELDS = [
  'adset_id',
  'spend', 'impressions', 'reach', 'frequency',
  'cpm', 'cpc', 'ctr', 'clicks',
  'inline_link_clicks', 'unique_clicks', 'unique_ctr',
  'actions', 'action_values', 'cost_per_action_type',
].join(',')

export async function GET(request: Request) {
  try {
    const ctx = await resolveMetaContext()
    if (!ctx) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'No access token or ad account selected' },
        { status: 401 }
      )
    }

    // Parse query params
    const url = new URL(request.url)
    const datePreset = url.searchParams.get('datePreset') || 'last_7d'
    const since = url.searchParams.get('since') || ''
    const until = url.searchParams.get('until') || ''
    const showInactive = url.searchParams.get('showInactive') === 'true'

    // Check cache
    const cacheKey = getCacheKey('optimization', ctx.accountId, datePreset, showInactive ? 'all' : 'active')
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json({ ok: true, data: cached, cached: true })
    }

    // ── Step 1: Fetch campaigns ──────────────────────────────────────────
    const statusFilter = showInactive
      ? '["ACTIVE","PAUSED"]'
      : '["ACTIVE"]'

    const campaignsRes = await ctx.client.get<{ data: any[] }>(
      `/${ctx.accountId}/campaigns`,
      {
        fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
        filtering: `[{"field":"effective_status","operator":"IN","value":${statusFilter}}]`,
        limit: '200',
      },
    )

    if (!campaignsRes.ok || !campaignsRes.data?.data) {
      if (DEBUG) console.error('[Optimization Score] Campaigns fetch failed:', campaignsRes.error)
      return NextResponse.json(
        { ok: false, error: 'meta_api_error', message: campaignsRes.error?.message || 'Failed to fetch campaigns' },
        { status: 502 }
      )
    }

    const campaigns = campaignsRes.data.data
    if (campaigns.length === 0) {
      setCached(cacheKey, [])
      return NextResponse.json({ ok: true, data: [] })
    }

    const campaignIds = campaigns.map((c: any) => c.id)

    // ── Step 2: Fetch adsets (for triple resolution) ─────────────────────
    // Fetch ALL adsets for the account (filtering by campaign_id is unreliable)
    // then group by campaign_id client-side
    const campaignIdSet = new Set(campaignIds)
    const adsetsByCampaign: Record<string, any[]> = {}

    let adsetsAfter: string | undefined
    let adsetPageCount = 0
    const MAX_ADSET_PAGES = 5

    do {
      const adsetParams: Record<string, string> = {
        fields: 'id,name,status,campaign_id,optimization_goal,destination_type,daily_budget,lifetime_budget',
        limit: '200',
      }
      if (adsetsAfter) adsetParams.after = adsetsAfter

      const adsetsRes = await ctx.client.get<{ data: any[]; paging?: { cursors?: { after?: string } } }>(
        `/${ctx.accountId}/adsets`,
        adsetParams,
      )

      if (!adsetsRes.ok || !adsetsRes.data?.data) {
        if (DEBUG) console.error('[Optimization Score] Adsets fetch failed:', adsetsRes.error)
        break
      }

      for (const adset of adsetsRes.data.data) {
        const cid = adset.campaign_id
        if (cid && campaignIdSet.has(cid)) {
          if (!adsetsByCampaign[cid]) adsetsByCampaign[cid] = []
          adsetsByCampaign[cid].push(adset)
        }
      }

      adsetsAfter = adsetsRes.data.paging?.cursors?.after
      adsetPageCount++
    } while (adsetsAfter && adsetPageCount < MAX_ADSET_PAGES)

    if (DEBUG) {
      const totalAdsets = Object.values(adsetsByCampaign).reduce((sum, arr) => sum + arr.length, 0)
      console.log(`[Optimization Score] Fetched ${totalAdsets} adsets for ${campaignIds.length} campaigns`)
    }

    // ── Step 3: Fetch campaign-level insights ────────────────────────────
    const dateParams: Record<string, string> = since && until
      ? { time_range: JSON.stringify({ since, until }) }
      : { date_preset: datePreset }

    const campaignInsightsRes = await ctx.client.get<{ data: any[] }>(
      `/${ctx.accountId}/insights`,
      {
        level: 'campaign',
        fields: INSIGHT_FIELDS,
        ...dateParams,
        limit: '200',
      },
    )

    // Build campaign→insights lookup
    const insightsByCampaign: Record<string, any> = {}
    if (campaignInsightsRes.ok && campaignInsightsRes.data?.data) {
      for (const row of campaignInsightsRes.data.data) {
        insightsByCampaign[row.campaign_id] = row
      }
    }

    // ── Step 4: Fetch adset-level insights ───────────────────────────────
    const adsetInsightsRes = await ctx.client.get<{ data: any[] }>(
      `/${ctx.accountId}/insights`,
      {
        level: 'adset',
        fields: ADSET_INSIGHT_FIELDS,
        ...dateParams,
        limit: '500',
      },
    )

    const insightsByAdset: Record<string, any> = {}
    if (adsetInsightsRes.ok && adsetInsightsRes.data?.data) {
      for (const row of adsetInsightsRes.data.data) {
        insightsByAdset[row.adset_id] = row
      }
    }

    // ── Step 4.5: Fetch ad-level rankings ──────────────────────────────
    // quality_ranking, engagement_rate_ranking, conversion_rate_ranking
    // are only available at the ad level in Meta API
    const adRankingsRes = await ctx.client.get<{ data: any[] }>(
      `/${ctx.accountId}/insights`,
      {
        level: 'ad',
        fields: 'campaign_id,spend,quality_ranking,engagement_rate_ranking,conversion_rate_ranking',
        ...dateParams,
        limit: '500',
      },
    )

    // Pick the highest-spend ad's rankings per campaign
    const rankingsByCampaign: Record<string, { spend: number; quality_ranking: string; engagement_rate_ranking: string; conversion_rate_ranking: string }> = {}
    if (adRankingsRes.ok && adRankingsRes.data?.data) {
      for (const row of adRankingsRes.data.data) {
        const cid = row.campaign_id
        if (!cid) continue
        const spend = parseFloat(row.spend || '0') || 0
        const existing = rankingsByCampaign[cid]
        if (!existing || spend > existing.spend) {
          rankingsByCampaign[cid] = {
            spend,
            quality_ranking: row.quality_ranking || '',
            engagement_rate_ranking: row.engagement_rate_ranking || '',
            conversion_rate_ranking: row.conversion_rate_ranking || '',
          }
        }
      }
    }

    if (DEBUG) {
      const withRankings = Object.values(rankingsByCampaign).filter(r => r.quality_ranking && r.quality_ranking !== 'UNKNOWN').length
      console.log(`[Optimization Score] Ad-level rankings: ${Object.keys(rankingsByCampaign).length} campaigns, ${withRankings} with valid rankings`)
    }

    // ── Step 5: Assemble scored campaigns ────────────────────────────────
    const result: OptimizationCampaign[] = []

    for (const campaign of campaigns) {
      const adsets = adsetsByCampaign[campaign.id] || []

      // Resolve triple: pick first adset that HAS optimization_goal + destination_type
      const objective = campaign.objective || 'UNKNOWN'
      const validAdset = adsets.find((a: any) => a.optimization_goal && a.destination_type) || adsets[0]

      let optimizationGoal = validAdset?.optimization_goal || ''
      let destination = validAdset?.destination_type || ''

      // Fallback: derive from objectiveSpec when adset data is missing
      if (!optimizationGoal && objective !== 'UNKNOWN') {
        const defaultDest = getAllowedDestinations(objective)[0] || 'WEBSITE'
        if (!destination) destination = defaultDest
        optimizationGoal = getDefaultOptimizationGoal(objective, destination)
      }

      const triple: CampaignTriple = {
        objective,
        optimizationGoal: optimizationGoal || 'UNKNOWN',
        destination: destination || 'UNKNOWN',
      }

      // Normalize insights
      const rawInsights = insightsByCampaign[campaign.id]
      const insights = rawInsights ? normalizeInsights(rawInsights) : emptyInsights()

      // Merge ad-level rankings (only available at ad level in Meta API)
      const adRankings = rankingsByCampaign[campaign.id]
      if (adRankings) {
        if (adRankings.quality_ranking && adRankings.quality_ranking !== 'UNKNOWN') {
          insights.qualityRanking = adRankings.quality_ranking
        }
        if (adRankings.engagement_rate_ranking && adRankings.engagement_rate_ranking !== 'UNKNOWN') {
          insights.engagementRateRanking = adRankings.engagement_rate_ranking
        }
        if (adRankings.conversion_rate_ranking && adRankings.conversion_rate_ranking !== 'UNKNOWN') {
          insights.conversionRateRanking = adRankings.conversion_rate_ranking
        }
      }

      // Resolve KPI template from triple
      const kpiTemplate = resolveKpiTemplate(triple)

      // Score campaign
      const scoreResult = scoreCampaign(insights, kpiTemplate)

      // Evaluate alerts and attach to score
      const alerts = evaluateAlerts(insights, kpiTemplate)
      scoreResult.alerts = alerts

      // Build adset objects
      const enrichedAdsets: OptimizationAdset[] = adsets.map((as: any) => {
        const asRaw = insightsByAdset[as.id]
        return {
          id: as.id,
          name: as.name,
          status: as.status,
          optimizationGoal: as.optimization_goal || '',
          destinationType: as.destination_type || '',
          dailyBudget: as.daily_budget ? parseFloat(as.daily_budget) / 100 : null,
          lifetimeBudget: as.lifetime_budget ? parseFloat(as.lifetime_budget) / 100 : null,
          insights: asRaw ? normalizeInsights(asRaw) : emptyInsights(),
        }
      })

      result.push({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        effectiveStatus: campaign.effective_status,
        triple,
        insights,
        adsets: enrichedAdsets,
        kpiTemplate,
        scoreResult,
        dailyBudget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
        lifetimeBudget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
        currency: 'TRY', // Will be resolved from account if needed
      })
    }

    // Sort by score descending (best first, insufficient data last)
    result.sort((a, b) => {
      if (a.scoreResult.status === 'insufficient_data' && b.scoreResult.status !== 'insufficient_data') return 1
      if (b.scoreResult.status === 'insufficient_data' && a.scoreResult.status !== 'insufficient_data') return -1
      return b.scoreResult.score - a.scoreResult.score
    })

    setCached(cacheKey, result)

    return NextResponse.json({ ok: true, data: result }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (error) {
    console.error('[Optimization Score] Server error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: 'server_error',
        message: 'Server error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
