import type { ChangeSet } from './types'
import { metaFetch } from '@/lib/meta/clientFetch'

// ═══════════════════════════════════════════════════════════════════════════
// Risk Assessment
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assesses the risk level of a proposed change.
 * - Status changes: pausing is low risk, resuming is medium
 * - Budget changes: proportional to the magnitude of change
 */
export function assessRisk(
  changeType: ChangeSet['changeType'],
  oldValue: string | number,
  newValue: string | number,
): ChangeSet['riskLevel'] {
  if (changeType === 'status') {
    // Pausing is safer than resuming (pausing stops spend)
    return newValue === 'PAUSED' ? 'low' : 'medium'
  }

  if (changeType === 'budget') {
    const oldNum = typeof oldValue === 'number' ? oldValue : parseFloat(String(oldValue)) || 0
    const newNum = typeof newValue === 'number' ? newValue : parseFloat(String(newValue)) || 0

    if (oldNum <= 0) return 'medium'

    const ratio = newNum / oldNum
    // Decreasing budget is lower risk than increasing
    if (ratio < 1) return 'low'
    if (ratio <= 1.5) return 'low'
    if (ratio <= 2.0) return 'medium'
    return 'high'
  }

  if (changeType === 'duplicate_adset') {
    return 'low' // Duplicating is safe — creates new entity, doesn't modify existing
  }

  return 'medium'
}

// ═══════════════════════════════════════════════════════════════════════════
// ChangeSet Factory
// ═══════════════════════════════════════════════════════════════════════════

export function createChangeSet(
  entityType: ChangeSet['entityType'],
  entityId: string,
  entityName: string,
  changeType: ChangeSet['changeType'],
  oldValue: string | number,
  newValue: string | number,
): ChangeSet {
  return {
    id: `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    entityType,
    entityId,
    entityName,
    changeType,
    oldValue,
    newValue,
    riskLevel: assessRisk(changeType, oldValue, newValue),
    status: 'pending',
    timestamp: Date.now(),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Execute ChangeSet — calls existing API endpoints
// ═══════════════════════════════════════════════════════════════════════════

export async function executeChangeSet(
  changeSet: ChangeSet,
): Promise<{ ok: boolean; error?: string }> {
  try {
    let url: string
    let body: Record<string, unknown>

    if (changeSet.entityType === 'campaign' && changeSet.changeType === 'status') {
      url = '/api/meta/campaigns/status'
      body = { campaignId: changeSet.entityId, status: changeSet.newValue }
    } else if (changeSet.entityType === 'campaign' && changeSet.changeType === 'budget') {
      url = '/api/meta/campaigns/budget'
      body = { campaignId: changeSet.entityId, dailyBudget: changeSet.newValue }
    } else if (changeSet.entityType === 'adset' && changeSet.changeType === 'status') {
      url = '/api/meta/adsets/status'
      body = { adSetId: changeSet.entityId, status: changeSet.newValue }
    } else if (changeSet.entityType === 'adset' && changeSet.changeType === 'budget') {
      url = '/api/meta/adset-budget'
      body = { adsetId: changeSet.entityId, dailyBudget: changeSet.newValue }
    } else if (changeSet.entityType === 'adset' && changeSet.changeType === 'duplicate_adset') {
      url = '/api/meta/adsets/duplicate'
      body = { adsetId: changeSet.entityId }
    } else {
      return { ok: false, error: `Unsupported change: ${changeSet.entityType}/${changeSet.changeType}` }
    }

    const response = await metaFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (data.ok || data.success) {
      changeSet.status = 'applied'
      return { ok: true }
    }

    changeSet.status = 'failed'
    return { ok: false, error: data.message || data.error || 'Unknown error' }
  } catch (err) {
    changeSet.status = 'failed'
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Rollback — executes with the old value
// ═══════════════════════════════════════════════════════════════════════════

export async function rollbackChangeSet(
  changeSet: ChangeSet,
): Promise<{ ok: boolean; error?: string }> {
  // Cannot rollback ad set duplication — the copy must be deleted manually
  if (changeSet.changeType === 'duplicate_adset') {
    return { ok: false, error: 'Cannot rollback ad set duplication. Delete the copy manually from Meta Ads.' }
  }

  const rollback = createChangeSet(
    changeSet.entityType,
    changeSet.entityId,
    changeSet.entityName,
    changeSet.changeType,
    changeSet.newValue,
    changeSet.oldValue,
  )

  const result = await executeChangeSet(rollback)

  if (result.ok) {
    changeSet.status = 'rolled_back'
  }

  return result
}
