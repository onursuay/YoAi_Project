/**
 * Spec runtime — evaluate visibility, required, and resets from RuleExpr.
 */

import type { RuleExpr, SpecField, ObjectiveSpec, SpecWizardState } from '../spec/types'
import type { MetaCapabilities } from '../capabilities/types'

/** Get value at dot path from state (campaign.name, adset.conversionLocation, etc.) */
export function getStateValue(state: SpecWizardState, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = state
  for (const p of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[p]
  }
  return current
}

function evaluateRule(rule: RuleExpr, state: SpecWizardState, caps: MetaCapabilities): boolean {
  if ('any' in rule) {
    return rule.any.some((r) => evaluateRule(r, state, caps))
  }
  if ('all' in rule) {
    return rule.all.every((r) => evaluateRule(r, state, caps))
  }
  if ('not' in rule) {
    return !evaluateRule(rule.not, state, caps)
  }
  if ('eq' in rule) {
    const [path, value] = rule.eq
    const v = getStateValue(state, path)
    return v === value
  }
  if ('in' in rule) {
    const [path, arr] = rule.in
    const v = getStateValue(state, path)
    if (!Array.isArray(arr)) return false
    return arr.includes(v)
  }
  if ('exists' in rule) {
    const v = getStateValue(state, rule.exists)
    if (v === undefined || v === null) return false
    if (typeof v === 'string') return v.trim().length > 0
    return true
  }
  return false
}

/**
 * True if the field should be visible given current state and capabilities.
 */
export function evaluateVisibility(
  specField: SpecField,
  state: SpecWizardState,
  caps: MetaCapabilities
): boolean {
  if (!specField.visibility || specField.visibility.length === 0) return true
  return specField.visibility.every((r) => evaluateRule(r, state, caps))
}

/**
 * True if the field is required given current state and capabilities.
 */
export function evaluateRequired(
  specField: SpecField,
  state: SpecWizardState,
  caps: MetaCapabilities
): boolean {
  if (!specField.required || specField.required.length === 0) return false
  return specField.required.some((r) => evaluateRule(r, state, caps))
}

/**
 * Given a changed field key, apply resets from spec: clear any fields listed in resets when the rule matches.
 * Returns a list of field keys that should be cleared (caller applies to state).
 */
export function getResetsToApply(
  changedFieldKey: string,
  state: SpecWizardState,
  _caps: MetaCapabilities,
  spec: ObjectiveSpec
): FieldKey[] {
  const toClear = new Set<string>()
  for (const step of spec.steps) {
    for (const field of step.fields) {
      if (field.key !== changedFieldKey || !field.resets) continue
      for (const reset of field.resets) {
        if (evaluateRule(reset.when, state, _caps as MetaCapabilities)) {
          reset.clear.forEach((k) => toClear.add(k))
        }
      }
    }
  }
  return Array.from(toClear)
}

type FieldKey = string

/**
 * Apply resets on change: return updates to apply to state (only for paths that exist in state).
 * Caller merges: setState(prev => ({ ...prev, campaign: { ...prev.campaign, [key]: undefined }, ... }))
 */
export function applyResetsOnChange(
  changedFieldKey: string,
  state: SpecWizardState,
  caps: MetaCapabilities,
  spec: ObjectiveSpec
): Partial<SpecWizardState> {
  const keysToClear = getResetsToApply(changedFieldKey, state, caps, spec)
  if (keysToClear.length === 0) return {}

  const updates: Partial<SpecWizardState> = {
    campaign: { ...state.campaign },
    adset: { ...state.adset },
    ad: { ...state.ad },
  }

  for (const path of keysToClear) {
    const [level, key] = path.split('.') as [keyof SpecWizardState, string]
    if (level && key && updates[level] && key in updates[level]!) {
      ;(updates[level] as Record<string, unknown>)[key] = undefined
    }
  }

  return updates
}
