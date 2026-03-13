import type {
  NormalizedInsights,
  KpiTemplate,
  CampaignTriple,
  OptimizationAdset,
  ProblemTag,
  ProblemTagId,
  MetricEvidence,
} from './types'
import { resolveMetricValue } from './kpiRegistry'

// ═══════════════════════════════════════════════════════════════════════════
// Context passed to each rule
// ═══════════════════════════════════════════════════════════════════════════

export interface RuleContext {
  insights: NormalizedInsights
  template: KpiTemplate
  triple: CampaignTriple
  adsets: OptimizationAdset[]
  dailyBudget: number | null
  lifetimeBudget: number | null
  campaignStatus?: string
  currency?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function ev(metric: string, value: number, benchmark: number | null, format: MetricEvidence['format'], direction: MetricEvidence['direction']): MetricEvidence {
  return { metric, value, benchmark, format, direction }
}

function isRankingPoor(ranking: string): boolean {
  if (!ranking) return false
  return ranking.toUpperCase().includes('BELOW_AVERAGE')
}

function isSalesObjective(triple: CampaignTriple): boolean {
  return triple.objective === 'OUTCOME_SALES'
}

function isActiveCampaign(status?: string): boolean {
  if (!status) return true // Assume active if unknown
  return status.toUpperCase() === 'ACTIVE'
}

/**
 * Currency-aware cost thresholds.
 * Weak currencies (TRY, IDR, etc.) need higher absolute thresholds.
 * Strong currencies (USD, EUR, GBP) use base thresholds.
 */
const CURRENCY_MULTIPLIER: Record<string, number> = {
  TRY: 1.0,   // Base thresholds are tuned for TRY
  USD: 0.05,   // $0.15 CPC threshold vs ₺3.0
  EUR: 0.05,
  GBP: 0.04,
  BRL: 0.20,
  INR: 3.0,
  IDR: 50.0,
  JPY: 5.0,
}

function getCurrencyFactor(currency?: string): number {
  if (!currency) return 1.0
  return CURRENCY_MULTIPLIER[currency.toUpperCase()] ?? 1.0
}

// ═══════════════════════════════════════════════════════════════════════════
// Rule Definitions
// ═══════════════════════════════════════════════════════════════════════════

interface Rule {
  id: ProblemTagId
  severity: 'critical' | 'warning' | 'info'
  evaluate: (ctx: RuleContext) => MetricEvidence[] | null
}

const RULES: Rule[] = [
  // ── Delivery ─────────────────────────────────────────────────────
  {
    id: 'NO_DELIVERY',
    severity: 'critical',
    evaluate: (ctx) => {
      // Only flag active campaigns — paused campaigns are expected to have no delivery
      if (!isActiveCampaign(ctx.campaignStatus)) return null
      if (ctx.insights.spend <= 0 && ctx.insights.impressions <= 0) {
        return [ev('spend', ctx.insights.spend, 0, 'currency', 'below')]
      }
      return null
    },
  },
  {
    id: 'INSUFFICIENT_DATA',
    severity: 'info',
    evaluate: (ctx) => {
      // Skip if already flagged as NO_DELIVERY (spend=0 and impressions=0)
      if (ctx.insights.spend <= 0 && ctx.insights.impressions <= 0) return null
      if (ctx.insights.spend > 0 && ctx.insights.spend < 1 && ctx.insights.impressions < 10) {
        return [
          ev('spend', ctx.insights.spend, 1, 'currency', 'below'),
          ev('impressions', ctx.insights.impressions, 10, 'number', 'below'),
        ]
      }
      return null
    },
  },

  // ── CTR ──────────────────────────────────────────────────────────
  {
    id: 'LOW_CTR',
    severity: 'warning',
    evaluate: (ctx) => {
      const { ctr } = ctx.insights
      if (ctr > 0 && ctr < 0.5) return [ev('ctr', ctr, 0.5, 'percentage', 'below')]
      return null
    },
  },

  // ── Cost Metrics (currency-aware thresholds) ───────────────────
  {
    id: 'HIGH_CPC',
    severity: 'warning',
    evaluate: (ctx) => {
      const { cpc } = ctx.insights
      const threshold = 3.0 * getCurrencyFactor(ctx.currency)
      if (cpc > threshold) return [ev('cpc', cpc, threshold, 'currency', 'above')]
      return null
    },
  },
  {
    id: 'HIGH_CPM',
    severity: 'warning',
    evaluate: (ctx) => {
      const { cpm } = ctx.insights
      const threshold = 30 * getCurrencyFactor(ctx.currency)
      if (cpm > threshold) return [ev('cpm', cpm, threshold, 'currency', 'above')]
      return null
    },
  },

  // ── North Star Cost (CPL / CPA) ─────────────────────────────────
  {
    id: 'HIGH_CPL',
    severity: 'warning',
    evaluate: (ctx) => {
      const ns = ctx.template.northStar
      // Only for lead-type north stars
      if (!ns.actionType || !ns.labelKey.includes('lead')) return null
      const costMetric = ctx.template.efficiency.find(m => m.actionType === ns.actionType && m.key === 'costPerAction')
      if (!costMetric) return null
      const cost = resolveMetricValue(costMetric, ctx.insights)
      if (cost <= 0) return null
      // Currency-aware CPL threshold
      const threshold = 50 * getCurrencyFactor(ctx.currency)
      if (cost > threshold) return [ev('costPerLead', cost, threshold, 'currency', 'above')]
      return null
    },
  },
  {
    id: 'HIGH_CPA',
    severity: 'warning',
    evaluate: (ctx) => {
      const ns = ctx.template.northStar
      if (!ns.actionType || ns.labelKey.includes('lead')) return null
      const costMetric = ctx.template.efficiency.find(m => m.actionType === ns.actionType && m.key === 'costPerAction')
      if (!costMetric) return null
      const cost = resolveMetricValue(costMetric, ctx.insights)
      const results = resolveMetricValue(ns, ctx.insights)
      // Flag if spending money but getting zero or very few results
      if (ctx.insights.spend > 5 && results <= 0) {
        return [ev('costPerAction', ctx.insights.spend, 0, 'currency', 'above')]
      }
      // Flag if CPA is unreasonably high (more than 50% of daily budget per action)
      if (cost > 0 && results > 0 && ctx.dailyBudget && cost > ctx.dailyBudget * 0.5) {
        return [ev('costPerAction', cost, ctx.dailyBudget * 0.5, 'currency', 'above')]
      }
      return null
    },
  },

  // ── ROAS (Sales only) ────────────────────────────────────────────
  {
    id: 'NEGATIVE_ROAS',
    severity: 'critical',
    evaluate: (ctx) => {
      if (!isSalesObjective(ctx.triple)) return null
      const roas = ctx.insights.websitePurchaseRoas
      if (roas > 0 && roas < 1.0) return [ev('roas', roas, 1.0, 'ratio', 'below')]
      return null
    },
  },
  {
    id: 'LOW_ROAS',
    severity: 'warning',
    evaluate: (ctx) => {
      if (!isSalesObjective(ctx.triple)) return null
      const roas = ctx.insights.websitePurchaseRoas
      if (roas >= 1.0 && roas < 2.0) return [ev('roas', roas, 2.0, 'ratio', 'below')]
      return null
    },
  },

  // ── Frequency / Saturation ──────────────────────────────────────
  {
    id: 'CRITICAL_FREQUENCY',
    severity: 'critical',
    evaluate: (ctx) => {
      const freq = ctx.insights.frequency
      if (freq > 6.0) return [ev('frequency', freq, 6.0, 'ratio', 'above')]
      return null
    },
  },
  {
    id: 'HIGH_FREQUENCY',
    severity: 'warning',
    evaluate: (ctx) => {
      const freq = ctx.insights.frequency
      if (freq > 4.0 && freq <= 6.0) return [ev('frequency', freq, 4.0, 'ratio', 'above')]
      return null
    },
  },

  // ── Quality Rankings ────────────────────────────────────────────
  {
    id: 'QUALITY_BELOW_AVERAGE',
    severity: 'warning',
    evaluate: (ctx) => {
      if (isRankingPoor(ctx.insights.qualityRanking)) {
        return [ev('qualityRanking', 0, null, 'number', 'below')]
      }
      return null
    },
  },
  {
    id: 'ENGAGEMENT_BELOW_AVERAGE',
    severity: 'warning',
    evaluate: (ctx) => {
      if (isRankingPoor(ctx.insights.engagementRateRanking)) {
        return [ev('engagementRateRanking', 0, null, 'number', 'below')]
      }
      return null
    },
  },
  {
    id: 'CONVERSION_BELOW_AVERAGE',
    severity: 'warning',
    evaluate: (ctx) => {
      if (isRankingPoor(ctx.insights.conversionRateRanking)) {
        return [ev('conversionRateRanking', 0, null, 'number', 'below')]
      }
      return null
    },
  },

  // ── Landing Page View Drop ──────────────────────────────────────
  {
    id: 'LPV_DROP',
    severity: 'warning',
    evaluate: (ctx) => {
      const lpv = ctx.insights.actions['landing_page_view'] ?? 0
      const clicks = ctx.insights.actions['link_click'] ?? ctx.insights.inlineLinkClicks
      if (clicks > 10 && lpv > 0) {
        const ratio = lpv / clicks
        if (ratio < 0.5) {
          return [
            ev('landingPageViews', lpv, null, 'number', 'below'),
            ev('linkClicks', clicks, null, 'number', 'neutral'),
          ]
        }
      }
      return null
    },
  },

  // ── Funnel Bottleneck (Sales) ───────────────────────────────────
  {
    id: 'FUNNEL_BOTTLENECK',
    severity: 'warning',
    evaluate: (ctx) => {
      if (!isSalesObjective(ctx.triple)) return null
      const stages = [
        { key: 'offsite_conversion.fb_pixel_view_content', label: 'viewContent' },
        { key: 'offsite_conversion.fb_pixel_add_to_cart', label: 'addToCart' },
        { key: 'offsite_conversion.fb_pixel_initiate_checkout', label: 'initiateCheckout' },
        { key: 'offsite_conversion.fb_pixel_purchase', label: 'purchase' },
      ]
      const values = stages.map(s => ctx.insights.actions[s.key] ?? 0)
      // Find biggest drop-off
      for (let i = 0; i < values.length - 1; i++) {
        if (values[i] > 5) {
          const dropRate = 1 - (values[i + 1] / values[i])
          if (dropRate > 0.7) {
            return [
              ev(stages[i].label, values[i], null, 'number', 'neutral'),
              ev(stages[i + 1].label, values[i + 1], null, 'number', 'below'),
            ]
          }
        }
      }
      return null
    },
  },

  // ── Budget Underutilized ────────────────────────────────────────
  {
    id: 'BUDGET_UNDERUTILIZED',
    severity: 'info',
    evaluate: (ctx) => {
      const budget = ctx.dailyBudget
      if (!budget || budget <= 0) return null
      const ratio = ctx.insights.spend / budget
      if (ratio < 0.5 && ctx.insights.spend > 0) {
        return [
          ev('spend', ctx.insights.spend, budget, 'currency', 'below'),
        ]
      }
      return null
    },
  },

  // ── Ad Set Imbalance ────────────────────────────────────────────
  {
    id: 'ADSET_IMBALANCE',
    severity: 'info',
    evaluate: (ctx) => {
      if (ctx.adsets.length < 2) return null
      const spends = ctx.adsets.map(a => a.insights.spend)
      const total = spends.reduce((a, b) => a + b, 0)
      if (total <= 0) return null
      const maxSpend = Math.max(...spends)
      if (maxSpend / total > 0.8) {
        return [ev('adsetSpendShare', maxSpend / total * 100, 80, 'percentage', 'above')]
      }
      return null
    },
  },

  // ── Single Ad Set Risk ──────────────────────────────────────────
  {
    id: 'SINGLE_ADSET_RISK',
    severity: 'info',
    evaluate: (ctx) => {
      if (ctx.adsets.length === 1 && ctx.insights.spend > 0) {
        return [ev('adsetCount', 1, 2, 'number', 'below')]
      }
      return null
    },
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// Main Entry Point
// ═══════════════════════════════════════════════════════════════════════════

export function runRuleEngine(ctx: RuleContext): ProblemTag[] {
  const tags: ProblemTag[] = []

  for (const rule of RULES) {
    const evidence = rule.evaluate(ctx)
    if (evidence) {
      tags.push({
        id: rule.id,
        severity: rule.severity,
        evidence,
      })
    }
  }

  // Sort: critical first, then warning, then info
  const order = { critical: 0, warning: 1, info: 2 }
  tags.sort((a, b) => order[a.severity] - order[b.severity])

  return tags
}
