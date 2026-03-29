/* ──────────────────────────────────────────────────────────
   Google Ads Rule Engine
   Deterministic problem detection for Google campaigns.
   ────────────────────────────────────────────────────────── */

import type { GoogleProblemTag, GoogleProblemTagId, StandardMetrics } from './analysisTypes'

export interface GoogleRuleContext {
  metrics: StandardMetrics
  adGroupCount: number
  adCount: number
  optimizationScore: number | null
  biddingStrategy?: string
  channelType?: string
  impressionShareBudgetLost?: number
  impressionShareRankLost?: number
  dailyBudget: number | null
  currency?: string
}

interface Evidence {
  metric: string
  value: number
  benchmark: number | null
  format: 'number' | 'currency' | 'percentage' | 'ratio'
  direction: 'above' | 'below' | 'neutral'
}

function ev(metric: string, value: number, benchmark: number | null, format: Evidence['format'], direction: Evidence['direction']): Evidence {
  return { metric, value, benchmark, format, direction }
}

// Currency-aware cost multiplier (same as Meta engine)
function costMultiplier(currency?: string): number {
  switch (currency) {
    case 'TRY': return 6
    case 'BRL': return 3
    case 'INR': return 20
    case 'IDR': return 4000
    case 'JPY': return 30
    case 'GBP': return 0.5
    case 'EUR': return 0.6
    default: return 1 // USD
  }
}

interface Rule {
  id: GoogleProblemTagId
  evaluate: (ctx: GoogleRuleContext) => Evidence[] | null
}

const RULES: Rule[] = [
  // No delivery
  {
    id: 'NO_DELIVERY',
    evaluate: (ctx) => {
      if (ctx.metrics.spend <= 0 && ctx.metrics.impressions <= 0) {
        return [ev('spend', 0, null, 'currency', 'neutral'), ev('impressions', 0, null, 'number', 'neutral')]
      }
      return null
    },
  },

  // Insufficient data
  {
    id: 'INSUFFICIENT_DATA',
    evaluate: (ctx) => {
      if (ctx.metrics.spend > 0 && ctx.metrics.impressions < 100) {
        return [ev('impressions', ctx.metrics.impressions, 100, 'number', 'below')]
      }
      return null
    },
  },

  // Low CTR
  {
    id: 'LOW_CTR',
    evaluate: (ctx) => {
      if (ctx.metrics.impressions < 100) return null
      const threshold = ctx.channelType === 'SEARCH' ? 2.0 : 0.5
      if (ctx.metrics.ctr < threshold) {
        return [ev('ctr', ctx.metrics.ctr, threshold, 'percentage', 'below')]
      }
      return null
    },
  },

  // High CPC
  {
    id: 'HIGH_CPC',
    evaluate: (ctx) => {
      if (ctx.metrics.clicks < 10) return null
      const m = costMultiplier(ctx.currency)
      const threshold = ctx.channelType === 'SEARCH' ? 5.0 * m : 3.0 * m
      if (ctx.metrics.cpc > threshold) {
        return [ev('cpc', ctx.metrics.cpc, threshold, 'currency', 'above')]
      }
      return null
    },
  },

  // Low conversions
  {
    id: 'LOW_CONVERSIONS',
    evaluate: (ctx) => {
      if (ctx.metrics.spend < 50 * costMultiplier(ctx.currency)) return null
      if (ctx.metrics.conversions < 1) {
        return [ev('conversions', ctx.metrics.conversions, 1, 'number', 'below'), ev('spend', ctx.metrics.spend, null, 'currency', 'neutral')]
      }
      return null
    },
  },

  // Low ROAS
  {
    id: 'LOW_ROAS',
    evaluate: (ctx) => {
      if (ctx.metrics.roas == null || ctx.metrics.conversions < 1) return null
      if (ctx.metrics.roas < 1.0) {
        return [ev('roas', ctx.metrics.roas, 1.0, 'ratio', 'below')]
      }
      return null
    },
  },

  // Impression share lost (budget)
  {
    id: 'IMPRESSION_SHARE_BUDGET_LOST',
    evaluate: (ctx) => {
      if (ctx.impressionShareBudgetLost == null) return null
      if (ctx.impressionShareBudgetLost > 20) {
        return [ev('impressionShareBudgetLost', ctx.impressionShareBudgetLost, 20, 'percentage', 'above')]
      }
      return null
    },
  },

  // Impression share lost (rank)
  {
    id: 'IMPRESSION_SHARE_RANK_LOST',
    evaluate: (ctx) => {
      if (ctx.impressionShareRankLost == null) return null
      if (ctx.impressionShareRankLost > 30) {
        return [ev('impressionShareRankLost', ctx.impressionShareRankLost, 30, 'percentage', 'above')]
      }
      return null
    },
  },

  // Ad group imbalance
  {
    id: 'AD_GROUP_IMBALANCE',
    evaluate: (ctx) => {
      if (ctx.adGroupCount < 2) return null
      // Can't check per-group metrics in this context, flag if too many groups
      if (ctx.adGroupCount > 20) {
        return [ev('adGroupCount', ctx.adGroupCount, 20, 'number', 'above')]
      }
      return null
    },
  },

  // Single ad group risk
  {
    id: 'SINGLE_AD_GROUP_RISK',
    evaluate: (ctx) => {
      if (ctx.adGroupCount === 1 && ctx.metrics.spend > 10 * costMultiplier(ctx.currency)) {
        return [ev('adGroupCount', 1, 2, 'number', 'below')]
      }
      return null
    },
  },

  // Low optimization score
  {
    id: 'LOW_OPT_SCORE',
    evaluate: (ctx) => {
      if (ctx.optimizationScore == null) return null
      if (ctx.optimizationScore < 50) {
        return [ev('optimizationScore', ctx.optimizationScore, 50, 'percentage', 'below')]
      }
      return null
    },
  },
]

export function runGoogleRuleEngine(ctx: GoogleRuleContext): GoogleProblemTag[] {
  const tags: GoogleProblemTag[] = []

  for (const rule of RULES) {
    const evidence = rule.evaluate(ctx)
    if (evidence) {
      const severity = (['NO_DELIVERY', 'LOW_ROAS', 'LOW_CONVERSIONS'] as GoogleProblemTagId[]).includes(rule.id)
        ? 'critical'
        : (['LOW_CTR', 'HIGH_CPC', 'IMPRESSION_SHARE_BUDGET_LOST', 'IMPRESSION_SHARE_RANK_LOST'] as GoogleProblemTagId[]).includes(rule.id)
          ? 'warning'
          : 'info'
      tags.push({ id: rule.id, severity, evidence })
    }
  }

  // Sort: critical first, then warning, then info
  const order = { critical: 0, warning: 1, info: 2 }
  tags.sort((a, b) => order[a.severity] - order[b.severity])

  return tags
}
