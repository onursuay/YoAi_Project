/**
 * Spec runtime — validate step before next/submit.
 * MISSING => do not call Meta API.
 */

import type { ObjectiveSpec, StepKey, SpecField, SpecWizardState } from '../spec/types'
import type { MetaCapabilities } from '../capabilities/types'
import { emptyCapabilities } from '../capabilities/types'
import { evaluateVisibility, evaluateRequired, getStateValue } from './evaluate'

export interface ValidateStepResult {
  ok: boolean
  missing: string[]
  messageKey: string
}

const STEP_ORDER: StepKey[] = ['CAMPAIGN', 'ADSET', 'AD']

export function stepKeyToNumber(stepKey: StepKey): 1 | 2 | 3 {
  const i = STEP_ORDER.indexOf(stepKey)
  return (i >= 0 ? i + 1 : 1) as 1 | 2 | 3
}

export function numberToStepKey(n: 1 | 2 | 3): StepKey {
  return STEP_ORDER[n - 1] ?? 'CAMPAIGN'
}

/**
 * Validate a single step: all visible required fields must have a value.
 */
export function validateStep(
  spec: ObjectiveSpec,
  stepKey: StepKey,
  state: SpecWizardState,
  caps: MetaCapabilities | null
): ValidateStepResult {
  const step = spec.steps.find((s) => s.stepKey === stepKey)
  if (!step) return { ok: true, missing: [], messageKey: 'validation.missing_fields' }

  const capsResolved = caps ?? emptyCapabilities
  const missing: string[] = []
  for (const field of step.fields) {
    if (!evaluateVisibility(field, state, capsResolved)) continue
    if (!evaluateRequired(field, state, capsResolved)) continue
    const value = getStateValue(state, field.key)
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim().length === 0)
    if (isEmpty) missing.push(field.key)
  }

  return {
    ok: missing.length === 0,
    missing,
    messageKey: 'validation.missing_fields',
  }
}

/**
 * Validate all steps up to and including the given step (e.g. before "Next").
 */
export function validateStepsUpTo(
  spec: ObjectiveSpec,
  currentStepKey: StepKey,
  state: SpecWizardState,
  caps: MetaCapabilities | null
): ValidateStepResult {
  const idx = STEP_ORDER.indexOf(currentStepKey)
  if (idx < 0) return { ok: true, missing: [], messageKey: 'validation.missing_fields' }

  const allMissing: string[] = []
  for (let i = 0; i <= idx; i++) {
    const sk = STEP_ORDER[i]
    const result = validateStep(spec, sk, state, caps ?? null)
    if (!result.ok) allMissing.push(...result.missing)
  }

  return {
    ok: allMissing.length === 0,
    missing: [...new Set(allMissing)],
    messageKey: 'validation.missing_fields',
  }
}
