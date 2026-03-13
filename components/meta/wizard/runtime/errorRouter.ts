/**
 * Wizard error router — maps Meta API errors to step + field.
 * Wraps lib/meta/spec/errorRouter and adds stepKey/fieldKey for spec-driven UI.
 */

import { routeMetaError, type ErrorRoute } from '@/lib/meta/spec/errorRouter'
import { numberToStepKey } from './validate'

export type { ErrorRoute }

/**
 * Route Meta API error to wizard step and field.
 * Returns step (1-4), field key for setStepErrors, and message.
 */
export function routeMetaErrorToWizard(
  errorCode: number | undefined,
  errorSubcode: number | undefined,
  errorMessage: string,
  objective: string
): ErrorRoute & { stepKey: 'CAMPAIGN' | 'ADSET' | 'AD' | 'SUMMARY'; fieldKey?: string } {
  const route = routeMetaError(errorCode, errorSubcode, errorMessage, objective)
  const stepKey = route.step <= 3 ? numberToStepKey(route.step as 1 | 2 | 3) : 'SUMMARY'
  const fieldKey = route.field
  return {
    ...route,
    stepKey: stepKey as 'CAMPAIGN' | 'ADSET' | 'AD' | 'SUMMARY',
    fieldKey,
  }
}

export { routeMetaError } from '@/lib/meta/spec/errorRouter'
