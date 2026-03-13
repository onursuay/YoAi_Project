import type { NormalizedInsights } from './types'

/**
 * Flattens a Meta API actions/cost_per_action_type/action_values array
 * into a Record<string, number> map keyed by action_type.
 */
function flattenActionArray(arr: any[] | undefined): Record<string, number> {
  if (!arr || !Array.isArray(arr)) return {}
  const map: Record<string, number> = {}
  for (const item of arr) {
    if (item.action_type && item.value != null) {
      map[item.action_type] = parseFloat(String(item.value)) || 0
    }
  }
  return map
}

/**
 * Extracts first numeric value from a video metric array.
 * Meta returns video metrics as arrays like [{ action_type: "video_view", value: "123" }]
 */
function extractVideoMetric(arr: any[] | undefined): number {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return 0
  return parseFloat(String(arr[0]?.value ?? 0)) || 0
}

/**
 * Parses Meta's purchase_roas field which can be an array, number, or string.
 */
function parseRoas(raw: any): number {
  if (!raw) return 0
  if (Array.isArray(raw) && raw.length > 0) {
    return parseFloat(String(raw[0]?.value ?? 0)) || 0
  }
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') return parseFloat(raw) || 0
  return 0
}

/**
 * Takes raw Meta Insights API response (single data item) and normalizes
 * all fields into a flat, type-safe structure.
 *
 * Handles:
 * - Base metrics (spend, impressions, reach, etc.)
 * - Actions array → flat Record<action_type, value>
 * - Cost per action array → flat Record<action_type, cost>
 * - Action values array → flat Record<action_type, monetary_value>
 * - Video metrics (thruplay, p25/50/75/100, avg watch time)
 * - Rankings (quality, engagement_rate, conversion_rate)
 * - ROAS (multiple possible formats)
 * - Brand metrics (ad recall lift)
 */
export function normalizeInsights(raw: any): NormalizedInsights {
  if (!raw || typeof raw !== 'object') {
    return emptyInsights()
  }

  return {
    // Base delivery
    spend: parseFloat(String(raw.spend ?? 0)) || 0,
    impressions: parseInt(String(raw.impressions ?? 0), 10) || 0,
    reach: parseInt(String(raw.reach ?? 0), 10) || 0,
    frequency: parseFloat(String(raw.frequency ?? 0)) || 0,
    cpm: parseFloat(String(raw.cpm ?? 0)) || 0,
    cpc: parseFloat(String(raw.cpc ?? 0)) || 0,
    ctr: parseFloat(String(raw.ctr ?? 0)) || 0,
    clicks: parseInt(String(raw.clicks ?? 0), 10) || 0,
    inlineLinkClicks: parseInt(String(raw.inline_link_clicks ?? 0), 10) || 0,
    uniqueClicks: parseInt(String(raw.unique_clicks ?? 0), 10) || 0,
    uniqueCtr: parseFloat(String(raw.unique_ctr ?? 0)) || 0,

    // Flattened action arrays
    actions: flattenActionArray(raw.actions),
    costPerAction: flattenActionArray(raw.cost_per_action_type),
    actionValues: flattenActionArray(raw.action_values),

    // Video
    videoThruplayWatched: extractVideoMetric(raw.video_thruplay_watched_actions),
    videoAvgTimeWatched: extractVideoMetric(raw.video_avg_time_watched_actions),
    videoP25: extractVideoMetric(raw.video_p25_watched_actions),
    videoP50: extractVideoMetric(raw.video_p50_watched_actions),
    videoP75: extractVideoMetric(raw.video_p75_watched_actions),
    videoP100: extractVideoMetric(raw.video_p100_watched_actions),

    // Rankings (string values like BELOW_AVERAGE_10, AVERAGE, ABOVE_AVERAGE)
    qualityRanking: String(raw.quality_ranking ?? ''),
    engagementRateRanking: String(raw.engagement_rate_ranking ?? ''),
    conversionRateRanking: String(raw.conversion_rate_ranking ?? ''),

    // ROAS
    websitePurchaseRoas: parseRoas(raw.website_purchase_roas || raw.purchase_roas),

    // Brand
    estimatedAdRecallers: parseInt(String(raw.estimated_ad_recallers ?? 0), 10) || 0,
    costPerEstimatedAdRecaller: parseFloat(String(raw.cost_per_estimated_ad_recallers ?? 0)) || 0,
  }
}

/** Returns an empty NormalizedInsights object with all fields at zero/empty. */
export function emptyInsights(): NormalizedInsights {
  return {
    spend: 0,
    impressions: 0,
    reach: 0,
    frequency: 0,
    cpm: 0,
    cpc: 0,
    ctr: 0,
    clicks: 0,
    inlineLinkClicks: 0,
    uniqueClicks: 0,
    uniqueCtr: 0,
    actions: {},
    costPerAction: {},
    actionValues: {},
    videoThruplayWatched: 0,
    videoAvgTimeWatched: 0,
    videoP25: 0,
    videoP50: 0,
    videoP75: 0,
    videoP100: 0,
    qualityRanking: '',
    engagementRateRanking: '',
    conversionRateRanking: '',
    websitePurchaseRoas: 0,
    estimatedAdRecallers: 0,
    costPerEstimatedAdRecaller: 0,
  }
}
