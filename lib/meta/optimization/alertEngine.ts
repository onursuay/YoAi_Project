import type { NormalizedInsights, KpiTemplate, Alert, AlertRule, CorrectiveAction } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// Ranking Helper
// ═══════════════════════════════════════════════════════════════════════════

/** Returns true if the Meta ranking string indicates below average. */
function isRankingPoor(ranking: string): boolean {
  if (!ranking) return false
  return ranking.toUpperCase().includes('BELOW_AVERAGE')
}

// ═══════════════════════════════════════════════════════════════════════════
// Metric Resolver (for alert rules)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolves a metric value from NormalizedInsights using an alert rule's metricKey.
 * Supports direct field access and action-based lookups via actionType.
 */
function resolveAlertMetric(rule: AlertRule, insights: NormalizedInsights): number | string {
  const key = rule.metricKey

  // Ranking metrics return string values
  if (key === 'qualityRanking') return insights.qualityRanking
  if (key === 'engagementRateRanking') return insights.engagementRateRanking
  if (key === 'conversionRateRanking') return insights.conversionRateRanking

  // Action-based metrics
  if (rule.actionType) {
    if (key === 'actions' || key.startsWith('actions.')) return insights.actions[rule.actionType] ?? 0
    if (key === 'costPerAction' || key.startsWith('costPerAction.')) return insights.costPerAction[rule.actionType] ?? 0
    if (key === 'actionValues' || key.startsWith('actionValues.')) return insights.actionValues[rule.actionType] ?? 0
  }

  // Direct field access
  const val = (insights as any)[key]
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val) || 0
  return 0
}

// ═══════════════════════════════════════════════════════════════════════════
// Condition Evaluators
// ═══════════════════════════════════════════════════════════════════════════

function evaluateCondition(rule: AlertRule, value: number | string): boolean {
  switch (rule.condition) {
    case 'below_threshold':
      return typeof value === 'number' && rule.threshold != null && value < rule.threshold && value > 0

    case 'above_threshold':
      return typeof value === 'number' && rule.threshold != null && value > rule.threshold

    case 'ranking_poor':
      return typeof value === 'string' && isRankingPoor(value)

    case 'trend_declining':
      // Trend analysis requires historical data — not evaluated in single-snapshot mode
      return false

    default:
      return false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Corrective Action Resolver
// ═══════════════════════════════════════════════════════════════════════════

function findCorrectiveActions(
  alertId: string,
  template: KpiTemplate,
): CorrectiveAction[] {
  return template.correctiveActions.filter(a => a.triggerAlertId === alertId)
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Alert Evaluator
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Evaluates all alert rules from a KPI template against normalized insights.
 * Returns an array of triggered alerts with corrective actions.
 */
export function evaluateAlerts(
  insights: NormalizedInsights,
  template: KpiTemplate,
): Alert[] {
  const alerts: Alert[] = []

  for (const rule of template.alerts) {
    const value = resolveAlertMetric(rule, insights)
    const triggered = evaluateCondition(rule, value)

    if (triggered) {
      alerts.push({
        id: rule.id,
        severity: rule.severity,
        messageKey: rule.messageKey,
        metricKey: rule.metricKey,
        currentValue: typeof value === 'number' ? value : 0,
        threshold: rule.threshold,
        correctiveActions: findCorrectiveActions(rule.id, template),
      })
    }
  }

  // Sort: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return alerts
}
