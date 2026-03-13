import type { ObjectiveKey, ObjectiveSpec } from '../types'
import { awarenessSpec } from './awareness'
import { trafficSpec } from './traffic'
import { engagementSpec } from './engagement'
import { leadsSpec } from './leads'
import { salesSpec } from './sales'
import { appPromotionSpec } from './app_promotion'

const specs: Record<ObjectiveKey, ObjectiveSpec> = {
  AWARENESS: awarenessSpec,
  TRAFFIC: trafficSpec,
  ENGAGEMENT: engagementSpec,
  LEADS: leadsSpec,
  SALES: salesSpec,
  APP_PROMOTION: appPromotionSpec,
}

/**
 * Get objective spec by key. Used by wizard to drive visibility, required, validation.
 */
export function getSpec(objectiveKey: ObjectiveKey): ObjectiveSpec {
  return specs[objectiveKey]
}

/**
 * Get objective spec by Meta API objective id (OUTCOME_*).
 */
export function getSpecByApiObjective(apiObjective: string): ObjectiveSpec | null {
  const key = apiToKey(apiObjective)
  if (!key) return null
  return specs[key]
}

function apiToKey(api: string): ObjectiveKey | null {
  const map: Record<string, ObjectiveKey> = {
    OUTCOME_AWARENESS: 'AWARENESS',
    OUTCOME_TRAFFIC: 'TRAFFIC',
    OUTCOME_ENGAGEMENT: 'ENGAGEMENT',
    OUTCOME_LEADS: 'LEADS',
    OUTCOME_APP_PROMOTION: 'APP_PROMOTION',
    OUTCOME_SALES: 'SALES',
  }
  return map[api] ?? null
}

export { awarenessSpec, trafficSpec, engagementSpec, leadsSpec, salesSpec, appPromotionSpec }
