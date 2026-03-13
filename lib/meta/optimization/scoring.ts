import type { NormalizedInsights, KpiTemplate, ScoreResult, ScoreStatus, GateResult } from './types'
import { resolveMetricValue } from './kpiRegistry'

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const MIN_SPEND = 1
const MIN_IMPRESSIONS = 10

// Composite score weights
const WEIGHT_NORTH_STAR = 0.40
const WEIGHT_EFFICIENCY = 0.30
const WEIGHT_QUALITY = 0.15
const WEIGHT_SATURATION = 0.15

// Frequency thresholds
const FREQ_OPTIMAL = 2.0
const FREQ_WARNING = 4.0
const FREQ_CRITICAL = 6.0

// Industry benchmark ranges (fallback when no baseline)
// Format: [poor_threshold, average_threshold, good_threshold]
const BENCHMARKS: Record<string, [number, number, number]> = {
  ctr: [0.5, 1.0, 2.0],
  cpc: [3.0, 1.5, 0.5],           // lower is better
  cpm: [30, 15, 8],               // lower is better
  websitePurchaseRoas: [1.0, 2.0, 4.0],
  frequency: [6.0, 4.0, 2.0],    // lower is better
}

// ═══════════════════════════════════════════════════════════════════════════
// Ranking Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Parses Meta ranking strings to a numeric score 0-100. */
function rankingToScore(ranking: string): number {
  if (!ranking) return 50 // unknown = neutral
  const r = ranking.toUpperCase()
  if (r.includes('ABOVE_AVERAGE')) return 90
  if (r === 'AVERAGE') return 60
  if (r.includes('BELOW_AVERAGE_35')) return 30
  if (r.includes('BELOW_AVERAGE_20')) return 25
  if (r.includes('BELOW_AVERAGE_10')) return 15
  if (r.includes('BELOW_AVERAGE')) return 20
  return 50 // fallback
}

/** Returns true if a ranking is considered "poor" (below average). */
function isRankingPoor(ranking: string): boolean {
  if (!ranking) return false
  return ranking.toUpperCase().includes('BELOW_AVERAGE')
}

// ═══════════════════════════════════════════════════════════════════════════
// Gate Evaluators
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Delivery Gate: Is the campaign actually delivering?
 * Checks spend > 0 and impressions above threshold.
 */
function evaluateDeliveryGate(insights: NormalizedInsights): GateResult {
  // No spend = no delivery, regardless of organic impressions
  if (insights.spend <= 0) {
    return { passed: false, score: 0, label: 'delivery' }
  }

  if (insights.impressions <= 0) {
    return { passed: false, score: 0, label: 'delivery' }
  }

  let score = 100
  if (insights.spend < MIN_SPEND) score -= 30
  if (insights.impressions < MIN_IMPRESSIONS) score -= 30
  if (insights.reach < 50) score -= 20

  return { passed: score >= 40, score: Math.max(0, score), label: 'delivery' }
}

/**
 * Efficiency Gate: Are cost-per-result metrics within acceptable ranges?
 * Uses template efficiency metrics against benchmarks.
 */
function evaluateEfficiencyGate(
  insights: NormalizedInsights,
  template: KpiTemplate,
): GateResult {
  const scores: number[] = []

  // Score north star metric
  const northStarVal = resolveMetricValue(template.northStar, insights)
  if (northStarVal > 0) {
    scores.push(80) // has results = good baseline
  } else if (insights.spend > MIN_SPEND) {
    scores.push(10) // spent money but no results = poor
  }

  // Score each efficiency metric
  for (const metric of template.efficiency) {
    const value = resolveMetricValue(metric, insights)
    if (value === 0) continue

    const benchmark = BENCHMARKS[metric.key]
    if (benchmark) {
      const [poor, avg, good] = benchmark
      if (metric.higherIsBetter) {
        if (value >= good) scores.push(95)
        else if (value >= avg) scores.push(70)
        else if (value >= poor) scores.push(40)
        else scores.push(15)
      } else {
        // Lower is better (cost metrics)
        if (value <= good) scores.push(95)
        else if (value <= avg) scores.push(70)
        else if (value <= poor) scores.push(40)
        else scores.push(15)
      }
    } else {
      // No benchmark — just check if value exists
      scores.push(value > 0 ? 60 : 30)
    }
  }

  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 50
  return { passed: avg >= 30, score: Math.round(avg), label: 'efficiency' }
}

/**
 * Quality Gate: Meta ad quality rankings.
 * Evaluates quality_ranking, engagement_rate_ranking, conversion_rate_ranking.
 */
function evaluateQualityGate(insights: NormalizedInsights): GateResult {
  const rankings = [
    insights.qualityRanking,
    insights.engagementRateRanking,
    insights.conversionRateRanking,
  ].filter(Boolean)

  if (rankings.length === 0) {
    // No ranking data available (low impressions) — neutral pass
    return { passed: true, score: 50, label: 'quality' }
  }

  const avgScore = rankings.reduce((sum, r) => sum + rankingToScore(r), 0) / rankings.length
  return {
    passed: avgScore >= 30,
    score: Math.round(avgScore),
    label: 'quality',
  }
}

/**
 * Saturation Gate: Is the audience fatigued?
 * Primarily checks frequency.
 */
function evaluateSaturationGate(insights: NormalizedInsights): GateResult {
  const freq = insights.frequency

  if (freq <= 0) {
    return { passed: true, score: 50, label: 'saturation' }
  }

  let score: number
  if (freq <= FREQ_OPTIMAL) score = 100
  else if (freq <= FREQ_WARNING) {
    // Linear interpolation: 2.0→100, 4.0→50
    score = 100 - ((freq - FREQ_OPTIMAL) / (FREQ_WARNING - FREQ_OPTIMAL)) * 50
  } else if (freq <= FREQ_CRITICAL) {
    // Linear interpolation: 4.0→50, 6.0→10
    score = 50 - ((freq - FREQ_WARNING) / (FREQ_CRITICAL - FREQ_WARNING)) * 40
  } else {
    score = Math.max(0, 10 - (freq - FREQ_CRITICAL) * 5)
  }

  return {
    passed: score >= 20,
    score: Math.round(Math.max(0, Math.min(100, score))),
    label: 'saturation',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Status Mapper
// ═══════════════════════════════════════════════════════════════════════════

function scoreToStatus(score: number): ScoreStatus {
  if (score >= 80) return 'excellent'
  if (score >= 65) return 'good'
  if (score >= 45) return 'average'
  if (score >= 25) return 'poor'
  return 'critical'
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Scorer
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Scores a campaign based on its normalized insights and KPI template.
 * Returns a composite score (0-100), status, gate results, and reasons.
 */
export function scoreCampaign(
  insights: NormalizedInsights,
  template: KpiTemplate,
): ScoreResult {
  const reasons: string[] = []

  // Hard gate: zero spend = insufficient data, always
  if (insights.spend <= 0) {
    return {
      score: 0,
      status: 'insufficient_data',
      gateResults: {
        delivery: { passed: false, score: 0, label: 'delivery' },
        efficiency: { passed: false, score: 0, label: 'efficiency' },
        quality: { passed: false, score: 0, label: 'quality' },
        saturation: { passed: false, score: 0, label: 'saturation' },
      },
      reasons: ['reasons.insufficientData'],
      alerts: [],
    }
  }

  // Minimum data gate — both spend AND impressions must be below thresholds
  if (insights.spend < MIN_SPEND && insights.impressions < MIN_IMPRESSIONS) {
    return {
      score: 0,
      status: 'insufficient_data',
      gateResults: {
        delivery: { passed: false, score: 0, label: 'delivery' },
        efficiency: { passed: false, score: 0, label: 'efficiency' },
        quality: { passed: false, score: 0, label: 'quality' },
        saturation: { passed: false, score: 0, label: 'saturation' },
      },
      reasons: ['reasons.insufficientData'],
      alerts: [],
    }
  }

  // Evaluate all 4 gates
  const delivery = evaluateDeliveryGate(insights)
  const efficiency = evaluateEfficiencyGate(insights, template)
  const quality = evaluateQualityGate(insights)
  const saturation = evaluateSaturationGate(insights)

  // Collect reasons
  if (!delivery.passed) reasons.push('reasons.noDelivery')
  if (!efficiency.passed) reasons.push('reasons.lowEfficiency')
  if (!quality.passed) reasons.push('reasons.lowQuality')
  if (!saturation.passed) reasons.push('reasons.highSaturation')

  // Quality-specific reasons
  if (isRankingPoor(insights.qualityRanking)) reasons.push('reasons.qualityRankingPoor')
  if (isRankingPoor(insights.engagementRateRanking)) reasons.push('reasons.engagementRankingPoor')
  if (isRankingPoor(insights.conversionRateRanking)) reasons.push('reasons.conversionRankingPoor')
  if (insights.frequency > FREQ_WARNING) reasons.push('reasons.frequencyHigh')

  // Composite score = weighted average of gate scores
  const compositeScore = Math.round(
    delivery.score * WEIGHT_NORTH_STAR +
    efficiency.score * WEIGHT_EFFICIENCY +
    quality.score * WEIGHT_QUALITY +
    saturation.score * WEIGHT_SATURATION
  )

  // Clamp to 0-100
  const finalScore = Math.max(0, Math.min(100, compositeScore))

  return {
    score: finalScore,
    status: scoreToStatus(finalScore),
    gateResults: { delivery, efficiency, quality, saturation },
    reasons,
    alerts: [], // Alerts populated separately by alertEngine
  }
}
