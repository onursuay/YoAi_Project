/* ──────────────────────────────────────────────────────────
   YoAlgoritma AI Engine — Persistence

   AI engine çıktısını ai_engine_runs / ai_alerts / ai_opportunities /
   ai_suggestions tablolarına yazar.

   Aynı zamanda yoai_daily_runs.command_center_data'ya UI-ready
   DeepAnalysisResult formatında yazarak frontend'in mevcut UI'ı
   bozulmadan yeni veriyi göstermesini sağlar.
   ────────────────────────────────────────────────────────── */

import { supabase } from '@/lib/supabase/client'
import { upsertDailyRun, getTurkeyDate } from '@/lib/yoai/dailyRunStore'
import type {
  AiEngineOutput,
  AiEngineResult,
  AiPlatform,
} from './types'
import type {
  DeepAnalysisResult,
  DeepCampaignInsight,
  DeepAction,
  AISummary,
  Platform,
} from '@/lib/yoai/analysisTypes'

export interface PersistArgs {
  userId: string
  platform: AiPlatform
  accountId: string
  result: AiEngineResult
  campaigns: DeepCampaignInsight[]   // snapshot — health overview için
  connectedPlatforms: Platform[]
  errors: string[]
}

export async function persistAiEngineResult(args: PersistArgs): Promise<{ runId: string | null }> {
  if (!supabase) {
    console.warn('[AI Engine][Persist] Supabase yok — skip')
    return { runId: null }
  }

  const today = getTurkeyDate()
  const { userId, platform, accountId, result } = args

  // 1) ai_engine_runs upsert
  const { data: runRow, error: runError } = await supabase
    .from('ai_engine_runs')
    .upsert(
      {
        user_id: userId,
        platform,
        account_id: accountId,
        run_date: today,
        status: 'completed',
        model: result.meta.model,
        input_tokens: result.meta.input_tokens,
        output_tokens: result.meta.output_tokens,
        cache_read_tokens: result.meta.cache_read_tokens,
        cache_creation_tokens: result.meta.cache_creation_tokens,
        tool_calls_count: result.meta.tool_calls_count,
        iterations: result.meta.iterations,
        duration_ms: result.meta.duration_ms,
        trace: result.meta.trace,
      },
      { onConflict: 'user_id,platform,account_id,run_date' },
    )
    .select('id')
    .single()

  if (runError || !runRow) {
    console.error('[AI Engine][Persist] ai_engine_runs upsert error:', runError)
    return { runId: null }
  }

  const runId = runRow.id as string

  // Tek tarama için eski çocuk satırları temizle (idempotent re-run)
  await Promise.all([
    supabase.from('ai_alerts').delete().eq('run_id', runId),
    supabase.from('ai_opportunities').delete().eq('run_id', runId),
    supabase.from('ai_suggestions').delete().eq('run_id', runId),
  ])

  // 2) ai_alerts
  if (result.output.critical_alerts.length > 0) {
    const rows = result.output.critical_alerts.map(a => ({
      run_id: runId,
      user_id: userId,
      platform,
      account_id: accountId,
      severity: a.severity,
      title: clamp(a.title, 500),
      reason: clamp(a.reason, 4000),
      suggested_action: a.suggested_action ? clamp(a.suggested_action, 2000) : null,
      confidence: clampInt(a.confidence, 0, 100),
      target_entity_type: a.target_entity_type ?? null,
      target_entity_id: a.target_entity_id ?? null,
      target_entity_name: a.target_entity_name ?? null,
      evidence: a.evidence ?? {},
    }))
    const { error } = await supabase.from('ai_alerts').insert(rows)
    if (error) console.error('[AI Engine][Persist] ai_alerts insert error:', error)
  }

  // 3) ai_opportunities
  if (result.output.opportunities.length > 0) {
    const rows = result.output.opportunities.map(o => ({
      run_id: runId,
      user_id: userId,
      platform,
      account_id: accountId,
      category: clamp(o.category, 100),
      title: clamp(o.title, 500),
      expected_impact: o.expected_impact ? clamp(o.expected_impact, 2000) : null,
      action_description: o.action ? clamp(o.action, 2000) : null,
      confidence: clampInt(o.confidence, 0, 100),
      target_entity_type: o.target_entity_type ?? null,
      target_entity_id: o.target_entity_id ?? null,
      target_entity_name: o.target_entity_name ?? null,
      evidence: o.evidence ?? {},
    }))
    const { error } = await supabase.from('ai_opportunities').insert(rows)
    if (error) console.error('[AI Engine][Persist] ai_opportunities insert error:', error)
  }

  // 4) ai_suggestions
  if (result.output.recommended_actions.length > 0) {
    const rows = result.output.recommended_actions.map(s => ({
      run_id: runId,
      user_id: userId,
      platform,
      account_id: accountId,
      priority: s.priority,
      action_type: clamp(s.action_type, 100),
      title: clamp(s.title, 500),
      reasoning: clamp(s.reasoning, 4000),
      expected_impact: s.expected_impact ? clamp(s.expected_impact, 2000) : null,
      confidence: clampInt(s.confidence, 0, 100),
      target_entity_type: s.target_entity_type,
      target_entity_id: s.target_entity_id,
      target_entity_name: s.target_entity_name ?? null,
      payload: s.payload ?? {},
    }))
    const { error } = await supabase.from('ai_suggestions').insert(rows)
    if (error) console.error('[AI Engine][Persist] ai_suggestions insert error:', error)
  }

  return { runId }
}

/* ──────────────────────────────────────────────────────────
   Tek-hesap AI çıktısı → kullanıcı genelinde
   DeepAnalysisResult uyumlu blob hazırla
   (yoai_daily_runs.command_center_data için).

   Multi-account birleştirme: birden fazla platform/hesap için
   bu fonksiyon birden çok kez çağrılır; persistDailyRunMerged
   tüm AI çıktılarını ve fetcher campaign listelerini birleştirir.
   ────────────────────────────────────────────────────────── */
export function buildDeepAnalysisFromAi(args: {
  campaigns: DeepCampaignInsight[]
  connectedPlatforms: Platform[]
  errors: string[]
  aiOutputs: Array<{ platform: AiPlatform; accountId: string; output: AiEngineOutput }>
}): DeepAnalysisResult {
  const { campaigns, connectedPlatforms, errors, aiOutputs } = args

  // AI alert/action target ID'lerini kullanarak campaign.riskLevel'ı boost edelim
  const criticalCampaignIds = new Set<string>()
  for (const out of aiOutputs) {
    for (const a of out.output.critical_alerts) {
      if (a.target_entity_type === 'campaign' && a.target_entity_id) {
        if (a.severity === 'critical') criticalCampaignIds.add(a.target_entity_id)
      }
    }
  }
  const boostedCampaigns = campaigns.map(c =>
    criticalCampaignIds.has(c.id) && c.riskLevel !== 'critical' ? { ...c, riskLevel: 'critical' as const } : c,
  )

  // aiSummaries — her unique campaign için en yüksek confidence'lı reasoning'i topla
  const summaryByCampaign = new Map<string, AISummary>()
  for (const out of aiOutputs) {
    for (const act of out.output.recommended_actions) {
      if (act.target_entity_type !== 'campaign' || !act.target_entity_id) continue
      const existing = summaryByCampaign.get(act.target_entity_id)
      if (!existing || act.confidence > existing.confidence) {
        summaryByCampaign.set(act.target_entity_id, {
          campaignId: act.target_entity_id,
          summary: act.title,
          recommendation: act.reasoning,
          confidence: act.confidence,
          insightStatus: act.priority === 'high' ? 'ready_for_approval' : 'review_needed',
        })
      }
    }
  }

  // actions — recommended_actions'ı DeepAction'a çevir
  const actions: DeepAction[] = []
  for (const out of aiOutputs) {
    for (const act of out.output.recommended_actions) {
      actions.push({
        id: `ai_${out.platform}_${act.target_entity_id}_${actions.length}`,
        title: act.title,
        reason: act.reasoning,
        expectedImpact: act.expected_impact ?? '—',
        requiresApproval: true,
        priority: act.priority,
        campaignName: act.target_entity_name ?? act.target_entity_id,
        campaignId: act.target_entity_id,
        platform: out.platform,
        targetEntityType: mapTargetType(act.target_entity_type),
        targetEntityId: act.target_entity_id,
        actionType: act.action_type,
      })
    }
  }

  // KPIs aggregate (mevcut deepAnalysis.aggregateKpis mantığını mirror'la)
  let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalConversions = 0
  let weightedRoas = 0, roasSpendTotal = 0
  for (const c of campaigns) {
    const m = c.metrics
    totalSpend += m.spend
    totalImpressions += m.impressions
    totalClicks += m.clicks
    totalConversions += m.conversions
    if (m.roas != null && m.spend > 0) {
      weightedRoas += m.roas * m.spend
      roasSpendTotal += m.spend
    }
  }
  const activeCount = campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED').length

  return {
    campaigns: boostedCampaigns,
    kpis: {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalConversions,
      weightedCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      weightedCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      avgRoas: roasSpendTotal > 0 ? weightedRoas / roasSpendTotal : null,
      activeCampaigns: activeCount,
      platformBreakdown: aggregatePlatformBreakdown(campaigns),
    },
    aiSummaries: Array.from(summaryByCampaign.values()),
    actions,
    drafts: [],  // approval workflow ayrı yazılır (mevcut yoai_pending_approvals)
    structuralIssues: [],
    lastAnalysis: new Date().toISOString(),
    aiGenerated: true,
    errors,
    connectedPlatforms,
  }
}

function aggregatePlatformBreakdown(campaigns: DeepCampaignInsight[]) {
  const map = new Map<Platform, { spend: number; impressions: number; clicks: number; conversions: number; count: number }>()
  for (const c of campaigns) {
    const cur = map.get(c.platform) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, count: 0 }
    cur.spend += c.metrics.spend
    cur.impressions += c.metrics.impressions
    cur.clicks += c.metrics.clicks
    cur.conversions += c.metrics.conversions
    cur.count += 1
    map.set(c.platform, cur)
  }
  return Array.from(map.entries()).map(([platform, d]) => ({
    platform,
    spend: d.spend,
    impressions: d.impressions,
    clicks: d.clicks,
    conversions: d.conversions,
    campaignCount: d.count,
  }))
}

/* yoai_daily_runs.command_center_data'ya yaz */
export async function persistDailyRunWithAi(args: {
  userId: string
  deepResult: DeepAnalysisResult
}): Promise<void> {
  await upsertDailyRun({
    user_id: args.userId,
    run_date: getTurkeyDate(),
    status: 'completed',
    command_center_data: args.deepResult,
    ad_proposals_data: null,  // ad proposals AI engine'in kapsamı dışı — eski flow korur
  })
}

/* ── helpers ──────────────────────────────────────────────── */
function clamp(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max)
}
function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.round(n)))
}
function mapTargetType(t: string): DeepAction['targetEntityType'] {
  if (t === 'campaign' || t === 'adset' || t === 'ad' || t === 'ad_group') return t
  return 'campaign'
}
