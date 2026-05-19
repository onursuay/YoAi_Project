/* ──────────────────────────────────────────────────────────
   YoAlgoritma AI Engine — Tool Definitions + Dispatcher

   6 zorunlu tool + ek rule_engine_evidence tool'u.
   Tool'lar Meta/Google entegrasyon dosyalarını DEĞİŞTİRMEZ —
   yalnızca mevcut fetcher/rule engine çıktısını sarmalar.

   Tool input snapshot ctx üzerinden çağrılır — agentic loop
   sırasında tutarlı veri için fetcher'lar bir defaya mahsus
   çalıştırılır, sonra tool'lar in-memory snapshot'tan okur.
   ────────────────────────────────────────────────────────── */

import type Anthropic from '@anthropic-ai/sdk'
import type { DeepCampaignInsight, AdsetInsight, AdInsight } from '@/lib/yoai/analysisTypes'
import type { AiPlatform } from '../types'

/**
 * Per-account snapshot — agentic loop başında bir defa fetch edilir,
 * sonra tool çağrıları bu snapshot üzerinden çalışır. Bu sayede
 * Meta/Google API'sine N kez gitmeyiz; aynı zamanda Claude tutarlı
 * veri görür.
 */
export interface ToolContext {
  platform: AiPlatform
  accountId: string
  campaigns: DeepCampaignInsight[]
  // Sektör benchmark eşikleri için (compare_vs_benchmark)
  industry?: string
}

export type ToolName =
  | 'get_account_overview'
  | 'get_campaign_metrics'
  | 'get_adset_breakdown'
  | 'get_creative_performance'
  | 'compare_vs_benchmark'
  | 'detect_anomaly'
  | 'rule_engine_evidence'

/* ── Anthropic tool schema definitions ────────────────────── */
export function buildTools(): Anthropic.Tool[] {
  return [
    {
      name: 'get_account_overview',
      description:
        'Hesap genelinde toplu görünüm: kampanya sayısı, toplam harcama, dönüşüm, ortalama ROAS/CTR/CPC, ' +
        'platform dağılımı, son 14 gün trendi. Analize ilk olarak buradan başla — büyük resmi gör.',
      input_schema: {
        type: 'object' as const,
        properties: {
          date_range_days: {
            type: 'number',
            description: 'Kaç günlük veri (varsayılan 14). Sadece bilgi amaçlı; snapshot zaten içerir.',
          },
        },
      },
    },
    {
      name: 'get_campaign_metrics',
      description:
        'Belirli kampanyaların detaylı metrikleri: spend, impressions, clicks, CTR, CPC, conversions, ROAS, ' +
        'frequency, riskLevel, problemTags. campaign_ids verilmezse tüm aktif kampanyalar döner.',
      input_schema: {
        type: 'object' as const,
        properties: {
          campaign_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Detay istenen kampanya ID listesi. Boş bırakılırsa tüm kampanyalar.',
          },
          only_active: {
            type: 'boolean',
            description: 'Sadece aktif/enabled kampanyalar (varsayılan true)',
          },
        },
      },
    },
    {
      name: 'get_adset_breakdown',
      description:
        'Bir kampanyanın adset/ad group bazlı kırılımı: her adset için optimization_goal, destination_type, ' +
        'daily_budget ve performans metrikleri. Hangi adset/ad group para yakıyor / değer üretiyor görmek için.',
      input_schema: {
        type: 'object' as const,
        properties: {
          campaign_id: { type: 'string', description: 'Kampanya ID' },
        },
        required: ['campaign_id'],
      },
    },
    {
      name: 'get_creative_performance',
      description:
        'Bir adset altındaki reklam-creative düzeyi performans: format, ranking skorları, başlık/metin/CTA, ' +
        'CTR, conversions. Creative fatigue ve kötü performans gösteren creative tespiti için.',
      input_schema: {
        type: 'object' as const,
        properties: {
          adset_id: { type: 'string', description: 'Adset / ad group ID' },
        },
        required: ['adset_id'],
      },
    },
    {
      name: 'compare_vs_benchmark',
      description:
        'Bir metriği sektör benchmark eşiğine karşı karşılaştırır. Örn: CTR=0.8% iyi mi kötü mü Search için? ' +
        'Çıktı: status (above/within/below), distance %, severity önerisi. Eşikler currency-aware ve platform-aware.',
      input_schema: {
        type: 'object' as const,
        properties: {
          metric: {
            type: 'string',
            enum: ['ctr', 'cpc', 'roas', 'cpa', 'frequency', 'conversion_rate', 'impression_share'],
            description: 'Karşılaştırılacak metrik',
          },
          value: { type: 'number', description: 'Gözlemlenen değer (CTR % olarak, CPC tutar olarak)' },
          campaign_type: {
            type: 'string',
            description: 'Search / Display / PMax / Video / Reach / Sales (opsiyonel ama kalite artırır)',
          },
        },
        required: ['metric', 'value'],
      },
    },
    {
      name: 'detect_anomaly',
      description:
        'Bir metriğin zaman serisinde anomali tespit eder (z-score veya yüzde değişim tabanlı). ' +
        'Kritik uyarı üretmek için kullan — örn: dün ROAS 4.2 idi, bugün 0.8 → critical alert. ' +
        'time_series eksikse periodComparison snapshot\'tan okunur.',
      input_schema: {
        type: 'object' as const,
        properties: {
          target_entity_id: { type: 'string', description: 'Anomali aranan kampanya/adset/ad ID' },
          metric: {
            type: 'string',
            enum: ['spend', 'roas', 'ctr', 'cpc', 'conversions', 'impressions', 'frequency'],
          },
        },
        required: ['target_entity_id', 'metric'],
      },
    },
    {
      name: 'rule_engine_evidence',
      description:
        'Mevcut deterministic rule engine çıktısını (problemTags + evidence) çağırır. Bu hesap için zaten ' +
        'üretilmiş kural ihlallerini ham kanıt olarak görmen için. Generic template üretmek için DEĞİL — ' +
        'kendi reasoning\'inle birleştirmek için.',
      input_schema: {
        type: 'object' as const,
        properties: {
          campaign_id: { type: 'string', description: 'Kanıt istenen kampanya ID (boş = tüm hesap)' },
        },
      },
    },
  ]
}

/* ── Helpers ──────────────────────────────────────────────── */
function findCampaign(ctx: ToolContext, id: string): DeepCampaignInsight | undefined {
  return ctx.campaigns.find(c => c.id === id)
}

function findAdset(ctx: ToolContext, id: string): { campaign: DeepCampaignInsight; adset: AdsetInsight } | undefined {
  for (const c of ctx.campaigns) {
    const a = c.adsets.find(as => as.id === id)
    if (a) return { campaign: c, adset: a }
  }
  return undefined
}

function summarizeCampaign(c: DeepCampaignInsight) {
  return {
    id: c.id,
    name: c.campaignName,
    platform: c.platform,
    status: c.status,
    effective_status: c.effectiveStatus,
    objective: c.objective,
    score: c.score,
    risk_level: c.riskLevel,
    daily_budget: c.dailyBudget,
    lifetime_budget: c.lifetimeBudget,
    currency: c.currency,
    metrics: c.metrics,
    period_comparison: c.periodComparison,
    problem_tags: c.problemTags?.map(t => ({ id: t.id, severity: t.severity, evidence: t.evidence })),
    adset_count: c.adsets.length,
    channel_type: c.channelType,
    bidding_strategy: c.biddingStrategy,
    campaign_type_intelligence: c.campaignTypeIntelligence,
  }
}

/* ── Benchmark tablosu — currency-agnostic relative ────── */
type BenchmarkRule = { good: number; warn: number; bad: number; direction: 'higher_better' | 'lower_better' }
const BENCHMARKS: Record<string, BenchmarkRule> = {
  ctr:                { good: 2.0, warn: 1.0, bad: 0.5, direction: 'higher_better' },
  roas:               { good: 4.0, warn: 2.0, bad: 1.0, direction: 'higher_better' },
  conversion_rate:    { good: 5.0, warn: 2.0, bad: 1.0, direction: 'higher_better' },
  impression_share:   { good: 80,  warn: 50,  bad: 30,  direction: 'higher_better' },
  cpc:                { good: 5,   warn: 15,  bad: 30,  direction: 'lower_better' },  // göreceli
  cpa:                { good: 50,  warn: 150, bad: 300, direction: 'lower_better' },
  frequency:          { good: 2.0, warn: 4.0, bad: 6.0, direction: 'lower_better' },
}

function benchmarkVerdict(metric: string, value: number): {
  status: 'above_excellent' | 'within_good' | 'within_warning' | 'below_acceptable'
  severity: 'info' | 'warning' | 'critical'
  reference: BenchmarkRule | null
} {
  const rule = BENCHMARKS[metric] ?? null
  if (!rule) return { status: 'within_good', severity: 'info', reference: null }
  if (rule.direction === 'higher_better') {
    if (value >= rule.good) return { status: 'above_excellent', severity: 'info', reference: rule }
    if (value >= rule.warn) return { status: 'within_good', severity: 'info', reference: rule }
    if (value >= rule.bad)  return { status: 'within_warning', severity: 'warning', reference: rule }
    return { status: 'below_acceptable', severity: 'critical', reference: rule }
  } else {
    if (value <= rule.good) return { status: 'above_excellent', severity: 'info', reference: rule }
    if (value <= rule.warn) return { status: 'within_good', severity: 'info', reference: rule }
    if (value <= rule.bad)  return { status: 'within_warning', severity: 'warning', reference: rule }
    return { status: 'below_acceptable', severity: 'critical', reference: rule }
  }
}

/* ── Tool dispatcher ──────────────────────────────────────── */
export async function dispatchTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    switch (name) {
      case 'get_account_overview':
        return { ok: true, data: getAccountOverview(ctx) }

      case 'get_campaign_metrics': {
        const ids = (input.campaign_ids as string[] | undefined) ?? []
        const onlyActive = (input.only_active as boolean | undefined) ?? true
        return { ok: true, data: getCampaignMetrics(ctx, ids, onlyActive) }
      }

      case 'get_adset_breakdown': {
        const cid = String(input.campaign_id ?? '')
        if (!cid) return { ok: false, error: 'campaign_id zorunlu' }
        return { ok: true, data: getAdsetBreakdown(ctx, cid) }
      }

      case 'get_creative_performance': {
        const aid = String(input.adset_id ?? '')
        if (!aid) return { ok: false, error: 'adset_id zorunlu' }
        return { ok: true, data: getCreativePerformance(ctx, aid) }
      }

      case 'compare_vs_benchmark': {
        const metric = String(input.metric ?? '')
        const value = Number(input.value ?? NaN)
        if (!metric || !Number.isFinite(value)) {
          return { ok: false, error: 'metric ve value zorunlu' }
        }
        return { ok: true, data: { metric, value, ...benchmarkVerdict(metric, value), campaign_type: input.campaign_type ?? null } }
      }

      case 'detect_anomaly': {
        const id = String(input.target_entity_id ?? '')
        const metric = String(input.metric ?? '')
        if (!id || !metric) return { ok: false, error: 'target_entity_id ve metric zorunlu' }
        return { ok: true, data: detectAnomaly(ctx, id, metric) }
      }

      case 'rule_engine_evidence': {
        const cid = (input.campaign_id as string | undefined) ?? ''
        return { ok: true, data: ruleEngineEvidence(ctx, cid) }
      }

      default:
        return { ok: false, error: `Bilinmeyen tool: ${name}` }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/* ── 1) get_account_overview ──────────────────────────────── */
function getAccountOverview(ctx: ToolContext) {
  const active = ctx.campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED')
  let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalConversions = 0
  let weightedRoas = 0, roasSpendTotal = 0
  for (const c of ctx.campaigns) {
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
  return {
    platform: ctx.platform,
    account_id: ctx.accountId,
    campaigns_total: ctx.campaigns.length,
    campaigns_active: active.length,
    spend_total: round(totalSpend, 2),
    impressions_total: totalImpressions,
    clicks_total: totalClicks,
    conversions_total: round(totalConversions, 2),
    ctr_weighted: totalImpressions > 0 ? round((totalClicks / totalImpressions) * 100, 3) : 0,
    cpc_weighted: totalClicks > 0 ? round(totalSpend / totalClicks, 2) : 0,
    roas_weighted: roasSpendTotal > 0 ? round(weightedRoas / roasSpendTotal, 3) : null,
    risk_distribution: {
      critical: ctx.campaigns.filter(c => c.riskLevel === 'critical').length,
      high:     ctx.campaigns.filter(c => c.riskLevel === 'high').length,
      medium:   ctx.campaigns.filter(c => c.riskLevel === 'medium').length,
      low:      ctx.campaigns.filter(c => c.riskLevel === 'low').length,
    },
    currency: ctx.campaigns[0]?.currency ?? 'TRY',
    industry: ctx.industry ?? null,
  }
}

/* ── 2) get_campaign_metrics ──────────────────────────────── */
function getCampaignMetrics(ctx: ToolContext, ids: string[], onlyActive: boolean) {
  let list = ctx.campaigns
  if (onlyActive) list = list.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED')
  if (ids.length > 0) list = list.filter(c => ids.includes(c.id))
  return {
    count: list.length,
    campaigns: list.map(summarizeCampaign),
  }
}

/* ── 3) get_adset_breakdown ───────────────────────────────── */
function getAdsetBreakdown(ctx: ToolContext, campaignId: string) {
  const c = findCampaign(ctx, campaignId)
  if (!c) return { error: 'Kampanya bulunamadı', campaign_id: campaignId }
  return {
    campaign_id: c.id,
    campaign_name: c.campaignName,
    adset_count: c.adsets.length,
    adsets: c.adsets.map(a => ({
      id: a.id,
      name: a.name,
      status: a.status,
      optimization_goal: a.optimizationGoal,
      destination_type: a.destinationType,
      daily_budget: a.dailyBudget,
      lifetime_budget: a.lifetimeBudget,
      metrics: a.metrics,
      ad_count: a.ads.length,
    })),
  }
}

/* ── 4) get_creative_performance ──────────────────────────── */
function getCreativePerformance(ctx: ToolContext, adsetId: string) {
  const found = findAdset(ctx, adsetId)
  if (!found) return { error: 'Adset bulunamadı', adset_id: adsetId }
  return {
    adset_id: found.adset.id,
    adset_name: found.adset.name,
    campaign_id: found.campaign.id,
    campaign_name: found.campaign.campaignName,
    ad_count: found.adset.ads.length,
    ads: found.adset.ads.map((ad: AdInsight) => ({
      id: ad.id,
      name: ad.name,
      status: ad.status,
      format: ad.format,
      quality_ranking: ad.qualityRanking,
      engagement_rate_ranking: ad.engagementRateRanking,
      conversion_rate_ranking: ad.conversionRateRanking,
      metrics: ad.metrics,
      creative_title: ad.creativeTitle,
      creative_body: ad.creativeBody,
      call_to_action: ad.callToActionType,
      link_url: ad.linkUrl,
    })),
  }
}

/* ── 5) detect_anomaly ────────────────────────────────────── */
function detectAnomaly(ctx: ToolContext, targetId: string, metric: string) {
  // 1) campaign?
  let c = findCampaign(ctx, targetId)
  let adsetMatch: { campaign: DeepCampaignInsight; adset: AdsetInsight } | undefined
  if (!c) adsetMatch = findAdset(ctx, targetId)

  const period = c?.periodComparison ?? adsetMatch?.adset?.metrics
    ? c?.periodComparison
    : undefined

  if (!period) {
    return {
      target_entity_id: targetId,
      metric,
      detected: false,
      reason: 'Period comparison verisi yok; anomali tespiti için yetersiz.',
    }
  }

  const change = (period.changes as Record<string, number | null>)[metric] ?? null
  if (change == null) {
    return {
      target_entity_id: targetId,
      metric,
      detected: false,
      reason: 'Bu metrik için değişim yüzdesi yok.',
    }
  }

  // Direction-aware severity
  const directionLowerBetter = ['cpc', 'frequency', 'cpa'].includes(metric)
  const negativeBad = directionLowerBetter ? change > 0 : change < 0
  let severity: 'info' | 'warning' | 'critical' = 'info'
  if (negativeBad) {
    if (Math.abs(change) >= 50) severity = 'critical'
    else if (Math.abs(change) >= 25) severity = 'warning'
    else if (Math.abs(change) >= 10) severity = 'info'
  }

  return {
    target_entity_id: targetId,
    metric,
    detected: severity !== 'info',
    severity,
    change_percentage: round(change, 2),
    previous: (period.previous as unknown as Record<string, number>)[metric] ?? null,
    current: (period.current as unknown as Record<string, number>)[metric] ?? null,
  }
}

/* ── 6) rule_engine_evidence ──────────────────────────────── */
function ruleEngineEvidence(ctx: ToolContext, campaignId?: string) {
  const list = campaignId ? ctx.campaigns.filter(c => c.id === campaignId) : ctx.campaigns
  return {
    campaigns: list.map(c => ({
      campaign_id: c.id,
      campaign_name: c.campaignName,
      score: c.score,
      risk_level: c.riskLevel,
      problem_tags: c.problemTags?.map(t => ({
        id: t.id,
        severity: t.severity,
        evidence: t.evidence,
      })) ?? [],
      structural: c.campaignTypeIntelligence ? {
        doctrine_name: c.campaignTypeIntelligence.doctrineName,
        fit_score: c.campaignTypeIntelligence.doctrineFitScore,
        fit_severity: c.campaignTypeIntelligence.doctrineFitSeverity,
        matched_principles: c.campaignTypeIntelligence.matchedPrinciples,
        failure_signals: c.campaignTypeIntelligence.failureSignals,
      } : null,
    })),
  }
}

function round(n: number, d: number): number {
  if (!Number.isFinite(n)) return 0
  const f = Math.pow(10, d)
  return Math.round(n * f) / f
}
