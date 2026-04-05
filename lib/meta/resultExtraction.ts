/**
 * Meta Ads "Results" column extraction helpers.
 * Maps campaign objectives / adset optimization goals to the correct action type,
 * then extracts the count from an insights actions array.
 */

export type ResultType =
  | 'lead'
  | 'purchase'
  | 'link_click'
  | 'landing_page_view'
  | 'post_engagement'
  | 'page_like'
  | 'mobile_app_install'
  | 'messaging_conversation_started'
  | 'video_view'
  | 'reach'
  | 'impressions'
  | 'unknown'

export function getResultTypeFromObjective(objective: string): ResultType {
  switch (objective) {
    case 'OUTCOME_LEADS':
    case 'LEAD_GENERATION':
      return 'lead'
    case 'OUTCOME_SALES':
    case 'CONVERSIONS':
    case 'PRODUCT_CATALOG_SALES':
      return 'purchase'
    case 'OUTCOME_TRAFFIC':
    case 'LINK_CLICKS':
      return 'landing_page_view'
    case 'OUTCOME_ENGAGEMENT':
    case 'POST_ENGAGEMENT':
    case 'PAGE_LIKES':
    case 'EVENT_RESPONSES':
      return 'post_engagement'
    case 'OUTCOME_AWARENESS':
    case 'BRAND_AWARENESS':
    case 'REACH':
      return 'reach'
    case 'OUTCOME_APP_PROMOTION':
    case 'APP_INSTALLS':
      return 'mobile_app_install'
    case 'MESSAGES':
      return 'messaging_conversation_started'
    case 'VIDEO_VIEWS':
      return 'video_view'
    default:
      return 'unknown'
  }
}

export function getResultTypeFromOptimizationGoal(goal: string): ResultType {
  switch (goal) {
    case 'LEAD_GENERATION':
    case 'QUALITY_LEAD':
      return 'lead'
    case 'OFFSITE_CONVERSIONS':
    case 'VALUE':
      return 'purchase'
    case 'LINK_CLICKS':
      return 'link_click'
    case 'LANDING_PAGE_VIEWS':
      return 'landing_page_view'
    case 'REACH':
      return 'reach'
    case 'IMPRESSIONS':
      return 'impressions'
    case 'APP_INSTALLS':
    case 'APP_INSTALLS_AND_OFFSITE_CONVERSIONS':
      return 'mobile_app_install'
    case 'REPLIES':
    case 'CONVERSATIONS':
      return 'messaging_conversation_started'
    case 'VIDEO_VIEWS':
    case 'THRUPLAY':
      return 'video_view'
    case 'PAGE_LIKES':
    case 'POST_ENGAGEMENT':
    case 'EVENT_RESPONSES':
      return 'post_engagement'
    default:
      return 'unknown'
  }
}

export function extractResultsCount(resultType: ResultType, insight: any): number {
  if (!insight) return 0
  switch (resultType) {
    case 'reach':
      return insight.reach ? parseInt(String(insight.reach), 10) : 0
    case 'impressions':
      return insight.impressions ? parseInt(String(insight.impressions), 10) : 0
    case 'lead':
      return findActionValue(insight.actions, ['lead', 'onsite_conversion.lead_grouped', 'leadgen_grouped'])
    case 'purchase':
      return findActionValue(insight.actions, ['purchase', 'omni_purchase'])
    case 'link_click':
      return findActionValue(insight.actions, ['link_click'])
    case 'landing_page_view':
      return findActionValue(insight.actions, ['landing_page_view'])
    case 'post_engagement':
      return findActionValue(insight.actions, ['post_engagement', 'page_engagement'])
    case 'page_like':
      return findActionValue(insight.actions, ['like'])
    case 'mobile_app_install':
      return findActionValue(insight.actions, ['mobile_app_install', 'app_custom_event.fb_mobile_activate_app'])
    case 'messaging_conversation_started':
      return findActionValue(insight.actions, [
        'onsite_conversion.messaging_conversation_started_7d',
        'onsite_conversion.total_messaging_connection',
      ])
    case 'video_view':
      return findActionValue(insight.actions, ['video_view'])
    default:
      return 0
  }
}

/** Best-effort: pick the most meaningful action when no objective/goal is known (e.g. ads tab). */
export function extractResultsFallback(insight: any): { resultType: ResultType; results: number } {
  if (!insight?.actions) return { resultType: 'unknown', results: 0 }
  const priority: ResultType[] = [
    'purchase', 'lead', 'messaging_conversation_started', 'mobile_app_install',
    'landing_page_view', 'link_click', 'video_view', 'post_engagement',
  ]
  for (const rt of priority) {
    const count = extractResultsCount(rt, insight)
    if (count > 0) return { resultType: rt, results: count }
  }
  return { resultType: 'unknown', results: 0 }
}

function findActionValue(actions: any[] | undefined, types: string[]): number {
  if (!Array.isArray(actions)) return 0
  for (const type of types) {
    const action = actions.find((a: any) => a?.action_type === type)
    if (action?.value) return parseInt(String(action.value), 10) || 0
  }
  return 0
}
